import { Sequelize } from "sequelize";
import "dotenv/config"; // carica le variabili dal file .env

// Le credenziali NON sono scritte nel codice ma lette dal file .env
// (vedi slide "Esposizione di Credenziali")
const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        dialect: "mysql",
        logging: false // nasconde le query SQL generate da Sequelize
    }
);

export default sequelize;
