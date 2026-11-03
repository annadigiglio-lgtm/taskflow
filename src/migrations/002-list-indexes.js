export const name = "002-list-indexes";
export async function up(queryInterface) {
    const indexes = [
        ["Messages", "messages_project_id", ["projectId", "id"]],
        ["Projects", "projects_catalog", ["visibility", "status", "isHidden", "createdAt", "id"]],
        ["Projects", "projects_owner_created", ["ownerId", "createdAt", "id"]],
        ["Tasks", "tasks_assignee_due", ["assigneeId", "dueDate", "id"]],
        ["Reports", "reports_status_created", ["status", "createdAt", "id"]]
    ];
    for (const [table, indexName, fields] of indexes) {
        const existing = await queryInterface.showIndex(table);
        if (!existing.some(index => index.name === indexName)) await queryInterface.addIndex(table, fields, { name: indexName });
    }
}
