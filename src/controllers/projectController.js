import { Op } from "sequelize";
import { Project, ProjectMember, User, Task, Report } from "../models/index.js";
import { emitToProject, notifyUser, notifyAdmins, removeUserFromProject } from "../socket/index.js";
import httpError from "../utils/httpError.js";
import pick from "../utils/pick.js";
import sequelize from "../config/db.js";
import { isValidDateOnly } from "../utils/date.js";
import { pagination, pageHeaders } from "../utils/pagination.js";
import { projectChanged, closeProjectRoom } from "../socket/index.js";

// Campi che l'utente può inviare quando crea/modifica un progetto
const PROJECT_FIELDS = ["title", "description", "category", "technologies", "visibility", "coverImage"];

// Campi "pubblici" di un utente da mostrare nelle risposte
const USER_FIELDS = ["id", "name", "email"];

// GET /api/projects/public?category=web&technology=node&from=2026-01-01&to=2026-12-31
// Catalogo pubblico: solo progetti pubblici, attivi e non nascosti da un admin
export async function listPublicProjects(req, res, next) {
    try {
        const { category, technology, from, to } = req.query;
        for (const [name, value] of Object.entries({ from, to })) {
            if (value !== undefined && !isValidDateOnly(value)) {
                throw httpError(400, `Il parametro '${name}' deve essere una data valida AAAA-MM-GG`);
            }
        }
        if (from && to && from > to) {
            throw httpError(400, "La data 'from' deve precedere o coincidere con 'to'");
        }

        const where = { visibility: "public", status: "active", isHidden: false };

        // Aggiungiamo i filtri solo se sono stati passati (e sono stringhe)
        if (typeof category === "string") {
            where.category = category;
        }
        if (typeof technology === "string") {
            // Op.like = "contiene": cerca la tecnologia dentro "node,express,mysql"
            where.technologies = { [Op.like]: `%${technology.toLowerCase()}%` };
        }
        if (from || to) {
            where.createdAt = {};
            if (from) {
                const fromDate = new Date(from);
                if (isNaN(fromDate)) throw httpError(400, "Il parametro 'from' non è una data valida");
                where.createdAt[Op.gte] = fromDate; // >= from
            }
            if (to) {
                const toDate = new Date(to);
                if (isNaN(toDate)) throw httpError(400, "Il parametro 'to' non è una data valida");
                toDate.setHours(23, 59, 59, 999); // includiamo tutto il giorno "to"
                where.createdAt[Op.lte] = toDate; // <= to
            }
        }

        if (req.query.q) {
            where[Op.or] = ["title", "description", "category", "technologies"].map(field => ({ [field]: { [Op.like]: `%${req.query.q}%` } }));
        }
        const paging = pagination(req.query);
        const { rows: projects, count } = await Project.findAndCountAll({
            ...paging,
            where,
            include: [{ model: User, as: "owner", attributes: USER_FIELDS }],
            order: [["createdAt", "DESC"], ["id", "DESC"]]
        });
        pageHeaders(res, paging, count);
        res.json(projects);
    } catch (err) {
        next(err);
    }
}

// POST /api/projects
export async function createProject(req, res, next) {
    try {
        const data = pick(req.body, PROJECT_FIELDS);
        const project = await sequelize.transaction(async (transaction) => {
            const created = await Project.create({ ...data, ownerId: req.user.id }, { transaction });
            // Progetto e primo membro devono essere salvati insieme.
            await created.addMember(req.user, { transaction });
            return created;
        });

        await projectChanged(project.id);
        res.status(201).json(project);
    } catch (err) {
        next(err);
    }
}

// GET /api/projects/:projectId
// Visibile se: il progetto è pubblico (e non nascosto), oppure sei membro, oppure sei admin
export async function getProject(req, res, next) {
    try {
        const project = req.project;
        const isPublic = project.visibility === "public" && !project.isHidden;

        if (!isPublic && !req.isMember && req.user.role !== "admin") {
            throw httpError(403, "Non hai accesso a questo progetto");
        }

        const fullProject = await Project.findByPk(project.id, {
            include: [
                { model: User, as: "owner", attributes: USER_FIELDS },
                // through: { attributes: [] } -> non mostriamo i campi della tabella ponte
                { model: User, as: "members", attributes: USER_FIELDS, through: { attributes: [] } }
            ]
        });
        res.json(fullProject);
    } catch (err) {
        next(err);
    }
}

// PUT /api/projects/:projectId  (solo proprietario)
export async function updateProject(req, res, next) {
    try {
        const data = pick(req.body, PROJECT_FIELDS);
        await req.project.update(data);
        await projectChanged(req.project.id);
        res.json(req.project);
    } catch (err) {
        next(err);
    }
}

// PATCH /api/projects/:projectId/archive  (solo proprietario)
// Body: { "archived": true }  oppure  { "archived": false } per riattivarlo
export async function archiveProject(req, res, next) {
    try {
        const { archived } = req.body;
        if (typeof archived !== "boolean") {
            throw httpError(400, "Il campo 'archived' deve essere true o false");
        }
        await req.project.update({ status: archived ? "archived" : "active" });
        await projectChanged(req.project.id);
        res.json(req.project);
    } catch (err) {
        next(err);
    }
}

// DELETE /api/projects/:projectId  (solo proprietario)
export async function deleteProject(req, res, next) {
    try {
        // Grazie a onDelete: "CASCADE" vengono cancellati anche task, messaggi e segnalazioni
        const members = await ProjectMember.findAll({ where: { projectId: req.project.id }, attributes: ["userId"] });
        await req.project.destroy();
        await projectChanged(req.project.id, "projectDeleted", members.map(member => member.userId));
        closeProjectRoom(req.project.id);
        res.status(204).send(); // 204 No Content: tutto ok, nessun contenuto da restituire
    } catch (err) {
        next(err);
    }
}

// POST /api/projects/:projectId/members  (solo proprietario)
// Body: { "email": "marco@email.it" }
export async function addMember(req, res, next) {
    try {
        const { email } = req.body;
        if (typeof email !== "string") {
            throw httpError(400, "L'email dell'utente da invitare è obbligatoria");
        }

        const user = await User.findOne({ where: { email } });
        if (!user) {
            throw httpError(404, "Nessun utente registrato con questa email");
        }

        const alreadyMember = await ProjectMember.findOne({
            where: { projectId: req.project.id, userId: user.id }
        });
        if (alreadyMember) {
            throw httpError(409, "L'utente è già membro del progetto");
        }

        await req.project.addMember(user);
        await projectChanged(req.project.id);

        // Notifiche in tempo reale:
        // - ai membri del progetto (che vedono il nuovo membro)
        // - al nuovo membro (che scopre di essere stato aggiunto)
        const newMember = { id: user.id, name: user.name, email: user.email };
        emitToProject(req.project.id, "memberJoined", { projectId: req.project.id, user: newMember });
        notifyUser(user.id, `Sei stato aggiunto al progetto "${req.project.title}"`, {
            type: "addedToProject",
            projectId: req.project.id
        });

        res.status(201).json({ message: "Membro aggiunto", user: newMember });
    } catch (err) {
        next(err);
    }
}

// DELETE /api/projects/:projectId/members/:userId  (solo proprietario)
export async function removeMember(req, res, next) {
    try {
        const userId = Number(req.params.userId);

        if (userId === req.project.ownerId) {
            throw httpError(400, "Il proprietario non può essere rimosso dal progetto");
        }

        const membership = await ProjectMember.findOne({
            where: { projectId: req.project.id, userId }
        });
        if (!membership) {
            throw httpError(404, "L'utente non è membro del progetto");
        }

        await sequelize.transaction(async transaction => {
            await membership.destroy({ transaction });
            await Task.update(
                { assigneeId: null },
                { where: { projectId: req.project.id, assigneeId: userId }, transaction }
            );
        });

        emitToProject(req.project.id, "memberLeft", { projectId: req.project.id, userId });
        removeUserFromProject(userId, req.project.id);
        await projectChanged(req.project.id, "projectUpdated", [userId]);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
}

// POST /api/projects/:projectId/reports  (qualsiasi utente loggato)
// Body: { "reason": "Contenuto inappropriato" }
export async function reportProject(req, res, next) {
    try {
        const report = await Report.create({
            reason: req.body.reason,
            projectId: req.project.id,
            userId: req.user.id
        });

        // Notifica live a tutti gli admin collegati
        notifyAdmins("newReport", {
            reportId: report.id,
            projectId: req.project.id,
            projectTitle: req.project.title,
            reason: report.reason,
            reportedBy: req.user.name
        });

        res.status(201).json(report);
    } catch (err) {
        next(err);
    }
}
