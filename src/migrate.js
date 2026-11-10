import sequelize from "./config/db.js";
import { runMigrations, migrations } from "./migrations/index.js";

try {
    await sequelize.authenticate();
    if (process.argv.includes("--status")) {
        const tables = await sequelize.getQueryInterface().showAllTables();
        let rows = [];
        if (tables.includes("SequelizeMeta")) {
            const result = await sequelize.query("SELECT name FROM SequelizeMeta");
            rows = result[0];
        }
        const appliedNames = [];
        for (const row of rows) appliedNames.push(row.name);
        for (const migration of migrations) {
            let status = "da applicare";
            if (appliedNames.includes(migration.name)) status = "applicata";
            console.log(`${status} ${migration.name}`);
        }
    } else {
        await runMigrations();
        console.log("Database aggiornato");
    }
} catch (err) {
    console.error("Migrazione non riuscita:", err.message);
    process.exitCode = 1;
} finally { await sequelize.close(); }
