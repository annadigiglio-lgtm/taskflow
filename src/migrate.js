import sequelize from "./config/db.js";
import { runMigrations, migrations } from "./migrations/index.js";

try {
    await sequelize.authenticate();
    if (process.argv.includes("--status")) {
        const tables = await sequelize.getQueryInterface().showAllTables();
        const [rows] = tables.includes("SequelizeMeta") ? await sequelize.query("SELECT name FROM SequelizeMeta") : [[]];
        for (const migration of migrations) console.log(`${rows.some(row => row.name === migration.name) ? "applicata" : "da applicare"} ${migration.name}`);
    } else {
        await runMigrations();
        console.log("Database aggiornato");
    }
} catch (err) {
    console.error("Migrazione non riuscita:", err.message);
    process.exitCode = 1;
} finally { await sequelize.close(); }
