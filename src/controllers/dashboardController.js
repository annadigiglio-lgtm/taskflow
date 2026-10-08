import { Op } from "sequelize";
import { Project, ProjectMember, Task } from "../models/index.js";

// GET /api/dashboard -> la dashboard personale dell'utente loggato
export async function getDashboard(req, res, next) {
    try {
        const userId = req.user.id;

        // 1) Progetti creati da me
        const ownedProjects = await Project.findAll({
            where: { ownerId: userId },
            order: [["createdAt", "DESC"]]
        });

        // 2) Progetti di altri di cui sono membro
        //    Prima prendo gli id dei progetti dalla tabella ponte...
        const memberships = await ProjectMember.findAll({ where: { userId } });
        const projectIds = memberships.map(m => m.projectId);
        //    ...poi i progetti, escludendo quelli creati da me (già nella lista sopra)
        const memberProjects = await Project.findAll({
            where: {
                id: projectIds,               // equivale a: id IN (...)
                ownerId: { [Op.ne]: userId }  // Op.ne = "diverso da"
            },
            order: [["createdAt", "DESC"]]
        });

        // 3) Task assegnati a me, ordinati per scadenza (la più vicina per prima)
        const assignedTasks = await Task.findAll({
            where: { assigneeId: userId },
            include: [{ model: Project, attributes: ["id", "title"] }],
            order: [["dueDate", "ASC"]]
        });

        res.json({ ownedProjects, memberProjects, assignedTasks });
    } catch (err) {
        next(err);
    }
}
