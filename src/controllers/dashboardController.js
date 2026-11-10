import { Op } from "sequelize";
import { Project, ProjectMember, Task } from "../models/index.js";
import { pagination } from "../utils/pagination.js";

export async function getDashboard(req, res, next) {
    try {
        const userId = req.user.id;
        const paging = pagination(req.query);

        // 1. Progetti creati dall'utente.
        const ownedProjects = await Project.findAndCountAll({
            where: { ownerId: userId },
            limit: paging.limit,
            offset: paging.offset,
            order: [["createdAt", "DESC"], ["id", "DESC"]]
        });

        // 2. Leggiamo gli ID dei progetti dalla tabella ponte.
        const memberships = await ProjectMember.findAll({
            where: { userId: userId },
            attributes: ["projectId"]
        });
        const projectIds = [];
        for (const membership of memberships) {
            projectIds.push(membership.projectId);
        }

        // Op.in = uno degli ID elencati; Op.ne = diverso dall'utente corrente.
        const memberProjects = await Project.findAndCountAll({
            where: {
                id: { [Op.in]: projectIds },
                ownerId: { [Op.ne]: userId }
            },
            limit: paging.limit,
            offset: paging.offset,
            order: [["createdAt", "DESC"], ["id", "DESC"]]
        });

        // 3. Attività assegnate all'utente, con il titolo del progetto collegato.
        const assignedTasks = await Task.findAndCountAll({
            where: { assigneeId: userId },
            include: [{ model: Project, attributes: ["id", "title"] }],
            limit: paging.limit,
            offset: paging.offset,
            order: [["dueDate", "ASC"], ["id", "ASC"]]
        });

        // 4. I contatori riguardano tutti i dati, non solo la pagina visualizzata.
        const activeOwned = await Project.count({
            where: { ownerId: userId, status: "active" }
        });
        const activeMember = await Project.count({
            where: {
                id: { [Op.in]: projectIds },
                ownerId: { [Op.ne]: userId },
                status: "active"
            }
        });
        const openTasks = await Task.count({
            where: { assigneeId: userId, status: { [Op.ne]: "done" } }
        });

        // Se almeno una lista contiene altri risultati, mostriamo "Carica altri".
        const loadedCount = paging.page * paging.limit;
        let hasMore = false;
        if (loadedCount < ownedProjects.count) hasMore = true;
        if (loadedCount < memberProjects.count) hasMore = true;
        if (loadedCount < assignedTasks.count) hasMore = true;

        res.json({
            ownedProjects: ownedProjects.rows,
            memberProjects: memberProjects.rows,
            assignedTasks: assignedTasks.rows,
            pagination: {
                page: paging.page,
                limit: paging.limit,
                hasMore: hasMore
            },
            totals: {
                activeProjects: activeOwned + activeMember,
                assignedTasks: assignedTasks.count,
                openTasks: openTasks
            }
        });
    } catch (err) {
        next(err);
    }
}
