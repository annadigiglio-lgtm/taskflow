// Script da lanciare UNA volta con:  npm run seed
// Crea le tabelle (se mancano) e l'utente amministratore con i dati del file .env.
// Serve perché con /register ci si può registrare solo come utente base.
import "dotenv/config";
import bcrypt from "bcryptjs";
import sequelize from "./config/db.js";
import { User } from "./models/index.js";

async function seed() {
    try {
        await sequelize.sync();

        const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
        if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
            throw new Error("Imposta ADMIN_EMAIL e ADMIN_PASSWORD nel file .env");
        }

        const existing = await User.findOne({ where: { email: ADMIN_EMAIL } });
        if (existing) {
            console.log(`L'admin ${ADMIN_EMAIL} esiste già`);
        } else {
            await User.create({
                name: ADMIN_NAME || "Admin",
                email: ADMIN_EMAIL,
                password: await bcrypt.hash(ADMIN_PASSWORD, 10),
                role: "admin"
            });
            console.log(`Admin creato: ${ADMIN_EMAIL}`);
        }
    } catch (err) {
        console.error("Errore nel seed:", err.message);
    } finally {
        await sequelize.close(); // chiudiamo la connessione così lo script termina
    }
}

seed();
