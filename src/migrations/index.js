import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";
import * as initial from "./001-initial-schema.js";
import * as indexes from "./002-list-indexes.js";
import * as sessionVersion from "./003-token-version.js";

export const migrations = [initial, indexes, sessionVersion];

// Le migrazioni si eseguono in ordine all'avvio di una singola istanza del server.
export async function runMigrations() {
    const queryInterface = sequelize.getQueryInterface();
    await queryInterface.createTable("SequelizeMeta", {
        name: { type: DataTypes.STRING, primaryKey: true, allowNull: false }
    });
    const [rows] = await sequelize.query("SELECT name FROM SequelizeMeta");
    const appliedNames = [];
    for (const row of rows) appliedNames.push(row.name);

    for (const migration of migrations) {
        if (appliedNames.includes(migration.name)) continue;
        await migration.up(queryInterface);
        await sequelize.query("INSERT INTO SequelizeMeta (name) VALUES (?)", {
            replacements: [migration.name]
        });
        console.log(`Migrazione applicata: ${migration.name}`);
    }
}
