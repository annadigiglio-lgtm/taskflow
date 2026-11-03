import { Op } from "sequelize";
import { Project, User, Task } from "../models/index.js";
import { pagination } from "../utils/pagination.js";

export async function getDashboard(req, res, next) {
    try {
        const userId = req.user.id;
        const paging = pagination(req.query);
        const ownedWhere = { ownerId: userId };
        const memberWhere = { ownerId: { [Op.ne]: userId } };
        const membership = [{ model: User, as: "members", attributes: [], through: { attributes: [] }, where: { id: userId }, required: true }];
        const [owned, member, assigned, activeOwned, activeMember, openTasks] = await Promise.all([
            Project.findAndCountAll({ ...paging, where: ownedWhere, order: [["createdAt", "DESC"], ["id", "DESC"]] }),
            Project.findAndCountAll({ ...paging, distinct: true, where: memberWhere, include: membership, order: [["createdAt", "DESC"], ["id", "DESC"]] }),
            Task.findAndCountAll({ ...paging, where: { assigneeId: userId }, include: [{ model: Project, attributes: ["id", "title"] }], order: [["dueDate", "ASC"], ["id", "ASC"]] }),
            Project.count({ where: { ...ownedWhere, status: "active" } }),
            Project.count({ distinct: true, where: { ...memberWhere, status: "active" }, include: membership }),
            Task.count({ where: { assigneeId: userId, status: { [Op.ne]: "done" } } })
        ]);
        res.json({
            ownedProjects: owned.rows, memberProjects: member.rows, assignedTasks: assigned.rows,
            pagination: { page: paging.page, limit: paging.limit, hasMore: [owned, member, assigned].some(result => paging.page * paging.limit < result.count) },
            totals: { activeProjects: activeOwned + activeMember, assignedTasks: assigned.count, openTasks }
        });
    } catch (err) { next(err); }
}
