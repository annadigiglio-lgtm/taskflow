import { createHash } from "node:crypto";
import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";
import * as initial from "./001-initial-schema.js";
import * as indexes from "./002-list-indexes.js";

export const migrations = [initial, indexes];

export async function runMigrations() {
    const connection = await sequelize.connectionManager.getConnection();
    const lock = `taskflow_migrations_${createHash("sha256").update(sequelize.config.database).digest("hex").slice(0, 32)}`;
    const raw = connection.promise();
    let locked = false;
    try {
        const [[result]] = await raw.query("SELECT GET_LOCK(?, 10) AS acquired", [lock]);
        if (Number(result.acquired) !== 1) throw new Error("Un'altra istanza sta aggiornando il database; riprova tra poco");
        locked = true;
        const queryInterface = sequelize.getQueryInterface();
        await queryInterface.createTable("SequelizeMeta", { name: { type: DataTypes.STRING, primaryKey: true, allowNull: false } });
        const [rows] = await raw.query("SELECT name FROM SequelizeMeta");
        const applied = new Set(rows.map(row => row.name));
        for (const migration of migrations) {
            if (applied.has(migration.name)) continue;
            await migration.up(queryInterface);
            await raw.query("INSERT INTO SequelizeMeta (name) VALUES (?)", [migration.name]);
            console.log(`Migrazione applicata: ${migration.name}`);
        }
    } finally {
        try { if (locked) await raw.query("SELECT RELEASE_LOCK(?)", [lock]); }
        finally { await sequelize.connectionManager.releaseConnection(connection); }
    }
}
