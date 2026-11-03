import { Task, User, ProjectMember } from "../models/index.js";
import { TASK_STATUSES } from "../models/Task.js";
import { emitToProject, notifyUser } from "../socket/index.js";
import httpError from "../utils/httpError.js";
import pick from "../utils/pick.js";
import { isValidDateOnly } from "../utils/date.js";

// NB: tutte queste rotte passano prima da loadProject + requireMember,
// quindi qui req.project esiste già e l'utente è sicuramente un membro.

const USER_FIELDS = ["id", "name", "email"];

// Cerca un task dentro il progetto corrente (404 se non c'è)
async function findTask(req) {
    const task = await Task.findOne({
        where: { id: req.params.taskId, projectId: req.project.id }
    });
    if (!task) {
        throw httpError(404, "Task non trovato");
    }
    return task;
}

// Controlla che l'assegnatario sia un membro del progetto
async function checkAssignee(projectId, assigneeId) {
    if (assigneeId === null || assigneeId === undefined) return; // nessun assegnatario: ok
    if (!Number.isInteger(assigneeId)) {
        throw httpError(400, "assigneeId deve essere un numero (l'id dell'utente)");
    }
    const membership = await ProjectMember.findOne({ where: { projectId, userId: assigneeId } });
    if (!membership) {
        throw httpError(400, "L'assegnatario deve essere un membro del progetto");
    }
}

// Controlla che la scadenza sia nel formato AAAA-MM-GG (es. "2026-11-08")
function checkDueDate(dueDate) {
    if (dueDate === null || dueDate === undefined) return; // scadenza facoltativa
    if (!isValidDateOnly(dueDate)) {
        throw httpError(400, "dueDate deve essere una data valida nel formato AAAA-MM-GG");
    }
}

// Rilegge il task con i dati dell'assegnatario (per le risposte e gli eventi live)
function loadTaskWithAssignee(id) {
    return Task.findByPk(id, {
        include: [{ model: User, as: "assignee", attributes: USER_FIELDS }]
    });
}

// GET /api/projects/:projectId/tasks
// Restituisce la bacheca: i task divisi nelle 3 colonne
export async function getBoard(req, res, next) {
    try {
        const tasks = await Task.findAll({
            where: { projectId: req.project.id },
            include: [{ model: User, as: "assignee", attributes: USER_FIELDS }],
            order: [["createdAt", "ASC"]]
        });

        const board = { todo: [], in_progress: [], done: [] };
        for (const task of tasks) {
            board[task.status].push(task);
        }
        res.json(board);
    } catch (err) {
        next(err);
    }
}

// POST /api/projects/:projectId/tasks
export async function createTask(req, res, next) {
    try {
        const data = pick(req.body, ["title", "description", "dueDate", "priority", "status", "assigneeId"]);
        checkDueDate(data.dueDate);
        await checkAssignee(req.project.id, data.assigneeId);

        const created = await Task.create({ ...data, projectId: req.project.id });
        const task = await loadTaskWithAssignee(created.id);

        // Aggiornamento live della bacheca per tutti i membri
        emitToProject(req.project.id, "taskCreated", task);
        // Notifica all'assegnatario (se non si è assegnato il task da solo)
        if (task.assigneeId && task.assigneeId !== req.user.id) {
            notifyUser(task.assigneeId, `Ti è stato assegnato il task "${task.title}"`, {
                type: "taskAssigned",
                projectId: req.project.id,
                taskId: task.id
            });
        }

        res.status(201).json(task);
    } catch (err) {
        next(err);
    }
}

// PUT /api/projects/:projectId/tasks/:taskId  -> modifica dei dati del task
export async function updateTask(req, res, next) {
    try {
        const data = pick(req.body, ["title", "description", "dueDate", "priority"]);
        checkDueDate(data.dueDate);

        const task = await findTask(req);
        await task.update(data);

        const updated = await loadTaskWithAssignee(task.id);
        emitToProject(req.project.id, "taskUpdated", updated);
        res.json(updated);
    } catch (err) {
        next(err);
    }
}

// PATCH /api/projects/:projectId/tasks/:taskId/status  -> sposta il task in un'altra colonna
// Body: { "status": "in_progress" }
export async function moveTask(req, res, next) {
    try {
        const { status } = req.body;
        if (!TASK_STATUSES.includes(status)) {
            throw httpError(400, `Lo stato deve essere uno tra: ${TASK_STATUSES.join(", ")}`);
        }

        const task = await findTask(req);
        await task.update({ status });

        const updated = await loadTaskWithAssignee(task.id);
        emitToProject(req.project.id, "taskUpdated", updated);
        // Avvisiamo l'assegnatario che il suo task ha cambiato stato
        if (task.assigneeId && task.assigneeId !== req.user.id) {
            notifyUser(task.assigneeId, `Il task "${task.title}" è passato a "${status}"`, {
                type: "taskStatusChanged",
                projectId: req.project.id,
                taskId: task.id
            });
        }
        res.json(updated);
    } catch (err) {
        next(err);
    }
}

// PATCH /api/projects/:projectId/tasks/:taskId/assign  -> riassegna il task
// Body: { "assigneeId": 2 }  oppure  { "assigneeId": null } per togliere l'assegnatario
export async function assignTask(req, res, next) {
    try {
        const { assigneeId } = req.body;
        if (assigneeId === undefined) {
            throw httpError(400, "Il campo 'assigneeId' è obbligatorio (anche null)");
        }
        await checkAssignee(req.project.id, assigneeId);

        const task = await findTask(req);
        await task.update({ assigneeId });

        const updated = await loadTaskWithAssignee(task.id);
        emitToProject(req.project.id, "taskUpdated", updated);
        if (assigneeId && assigneeId !== req.user.id) {
            notifyUser(assigneeId, `Ti è stato assegnato il task "${task.title}"`, {
                type: "taskAssigned",
                projectId: req.project.id,
                taskId: task.id
            });
        }
        res.json(updated);
    } catch (err) {
        next(err);
    }
}

// DELETE /api/projects/:projectId/tasks/:taskId
export async function deleteTask(req, res, next) {
    try {
        const task = await findTask(req);
        await task.destroy();

        emitToProject(req.project.id, "taskDeleted", { id: task.id });
        res.status(204).send();
    } catch (err) {
        next(err);
    }
}
