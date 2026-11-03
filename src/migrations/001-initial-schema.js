import { DataTypes as D } from "sequelize";

// Snapshot dello schema iniziale: non dipende dai modelli che evolveranno in futuro.
const timestamps = () => ({ createdAt: { type: D.DATE, allowNull: false }, updatedAt: { type: D.DATE, allowNull: false } });
const id = () => ({ type: D.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false });
const ref = (model, onDelete = "SET NULL") => ({ type: D.INTEGER, references: { model, key: "id" }, onDelete, onUpdate: "CASCADE" });
const schema = {
    Users: { id: id(), name: { type: D.STRING, allowNull: false }, email: { type: D.STRING, allowNull: false, unique: true }, password: { type: D.STRING, allowNull: false }, role: { type: D.ENUM("user", "admin"), defaultValue: "user" }, isBlocked: { type: D.BOOLEAN, defaultValue: false }, resetToken: D.STRING, resetTokenExpires: D.DATE, ...timestamps() },
    Projects: { id: id(), title: { type: D.STRING, allowNull: false }, description: D.TEXT, category: D.STRING, technologies: D.STRING, visibility: { type: D.ENUM("public", "private"), defaultValue: "private" }, coverImage: D.STRING, status: { type: D.ENUM("active", "archived"), defaultValue: "active" }, isHidden: { type: D.BOOLEAN, defaultValue: false }, ownerId: ref("Users"), ...timestamps() },
    ProjectMembers: { projectId: { ...ref("Projects", "CASCADE"), primaryKey: true, allowNull: false }, userId: { ...ref("Users", "CASCADE"), primaryKey: true, allowNull: false }, ...timestamps() },
    Tasks: { id: id(), title: { type: D.STRING, allowNull: false }, description: D.TEXT, dueDate: D.DATEONLY, priority: { type: D.ENUM("low", "medium", "high"), defaultValue: "medium" }, status: { type: D.ENUM("todo", "in_progress", "done"), defaultValue: "todo" }, projectId: ref("Projects", "CASCADE"), assigneeId: ref("Users"), ...timestamps() },
    Messages: { id: id(), content: { type: D.TEXT, allowNull: false }, projectId: ref("Projects", "CASCADE"), userId: ref("Users"), ...timestamps() },
    Reports: { id: id(), reason: { type: D.TEXT, allowNull: false }, status: { type: D.ENUM("open", "resolved"), defaultValue: "open" }, projectId: ref("Projects", "CASCADE"), userId: ref("Users"), ...timestamps() }
};

export const name = "001-initial-schema";
export async function up(queryInterface) {
    const existing = await queryInterface.showAllTables();
    for (const [table, columns] of Object.entries(schema)) {
        if (!existing.includes(table)) {
            await queryInterface.createTable(table, columns);
            continue;
        }
        // Adozione di installazioni create con sync(): nessuna modifica ai dati.
        const actual = await queryInterface.describeTable(table);
        for (const [column, definition] of Object.entries(columns)) {
            if (!actual[column]) throw new Error(`Schema incompatibile: manca ${table}.${column}`);
            const options = definition.type ? definition : { type: definition };
            const type = typeof options.type === "function" ? options.type() : options.type;
            const expected = (type.key === "ENUM" ? `ENUM(${type.values.map(value => `'${value}'`).join(",")})` : type.toSql()).toUpperCase();
            const found = actual[column].type.toUpperCase();
            const compatible = expected === found || (expected === "INTEGER" && /^INT(?:EGER)?(?:\(\d+\))?$/.test(found)) || (expected === "TINYINT(1)" && found === "TINYINT(1)");
            if (!compatible || (options.allowNull === false && actual[column].allowNull) || (options.primaryKey && !actual[column].primaryKey)) {
                throw new Error(`Schema incompatibile: ${table}.${column} (${found}, atteso ${expected})`);
            }
        }
    }
}
