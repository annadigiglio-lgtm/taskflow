import { User, Project, Report } from "../models/index.js";
import httpError from "../utils/httpError.js";

// Tutte queste funzioni sono raggiungibili solo dagli admin
// (vedi authenticate + requireAdmin in routes/adminRoutes.js)

// GET /api/admin/users
export async function listUsers(req, res, next) {
    try {
        const users = await User.findAll({ order: [["id", "ASC"]] });
        res.json(users);
    } catch (err) {
        next(err);
    }
}

// PATCH /api/admin/users/:userId/block
// Body: { "blocked": true }  oppure  { "blocked": false } per sbloccare
export async function blockUser(req, res, next) {
    try {
        const { blocked } = req.body;
        if (typeof blocked !== "boolean") {
            throw httpError(400, "Il campo 'blocked' deve essere true o false");
        }

        const user = await User.findByPk(req.params.userId);
        if (!user) {
            throw httpError(404, "Utente non trovato");
        }
        if (user.role === "admin") {
            throw httpError(400, "Non puoi bloccare un amministratore");
        }

        await user.update({ isBlocked: blocked });
        res.json(user);
    } catch (err) {
        next(err);
    }
}

// GET /api/admin/reports?status=open
export async function listReports(req, res, next) {
    try {
        const where = {};
        if (req.query.status === "open" || req.query.status === "resolved") {
            where.status = req.query.status;
        }

        const reports = await Report.findAll({
            where,
            include: [
                { model: Project, attributes: ["id", "title", "isHidden"] },
                { model: User, as: "reporter", attributes: ["id", "name", "email"] }
            ],
            order: [["createdAt", "DESC"]]
        });
        res.json(reports);
    } catch (err) {
        next(err);
    }
}

// PATCH /api/admin/projects/:projectId/hide
// Body: { "hidden": true }  oppure  { "hidden": false } per renderlo di nuovo visibile
export async function hideProject(req, res, next) {
    try {
        const { hidden } = req.body;
        if (typeof hidden !== "boolean") {
            throw httpError(400, "Il campo 'hidden' deve essere true o false");
        }

        const project = await Project.findByPk(req.params.projectId);
        if (!project) {
            throw httpError(404, "Progetto non trovato");
        }

        await project.update({ isHidden: hidden });

        // Se nascondiamo il progetto, le sue segnalazioni aperte sono gestite
        if (hidden) {
            await Report.update(
                { status: "resolved" },
                { where: { projectId: project.id, status: "open" } }
            );
        }
        res.json(project);
    } catch (err) {
        next(err);
    }
}

// PATCH /api/admin/reports/:reportId/resolve
// Per chiudere una segnalazione senza nascondere il progetto (es. segnalazione infondata)
export async function resolveReport(req, res, next) {
    try {
        const report = await Report.findByPk(req.params.reportId);
        if (!report) {
            throw httpError(404, "Segnalazione non trovata");
        }
        await report.update({ status: "resolved" });
        res.json(report);
    } catch (err) {
        next(err);
    }
}
