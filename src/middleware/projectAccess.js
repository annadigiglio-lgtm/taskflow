import { Project, ProjectMember } from "../models/index.js";
import httpError from "../utils/httpError.js";

// Questi middleware gestiscono i permessi "per progetto".
// Vanno usati DOPO authenticate (serve req.user).

// 1) Carica il progetto indicato nell'URL (:projectId) e lo salva in req.project.
//    Calcola anche se l'utente è membro e/o proprietario del progetto.
export async function loadProject(req, res, next) {
    try {
        const project = await Project.findByPk(req.params.projectId);
        if (!project) {
            throw httpError(404, "Progetto non trovato");
        }

        const membership = await ProjectMember.findOne({
            where: { projectId: project.id, userId: req.user.id }
        });

        req.project = project;
        req.isOwner = project.ownerId === req.user.id;
        req.isMember = membership !== null;
        next();
    } catch (err) {
        next(err);
    }
}

// 2) Lascia passare solo i membri del progetto (task, chat...)
export function requireMember(req, res, next) {
    if (!req.isMember) {
        return next(httpError(403, "Non sei membro di questo progetto"));
    }
    next();
}

// 3) Lascia passare solo il proprietario del progetto (modifica, membri, archiviazione...)
export function requireOwner(req, res, next) {
    if (!req.isOwner) {
        return next(httpError(403, "Solo il proprietario del progetto può farlo"));
    }
    next();
}
