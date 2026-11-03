import "dotenv/config"; // carica le variabili dal file .env
import http from "http";
import app from "./app.js";
import sequelize from "./config/db.js";
import "./models/index.js"; // carica i modelli e le relazioni prima del sync
import { initSocket } from "./socket/index.js";
import { runMigrations } from "./migrations/index.js";

const PORT = process.env.PORT || 3000;

// Senza la chiave segreta non possiamo creare né verificare i JWT
if (!process.env.JWT_SECRET) {
    console.error("Manca JWT_SECRET nel file .env");
    process.exit(1);
}

// Creiamo un server HTTP "a mano" (invece di app.listen) perché
// lo stesso server deve essere usato sia da Express che da Socket.io
const server = http.createServer(app);
initSocket(server);

// Errore all'avvio del server (es. porta già usata da un altro programma)
server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
        console.error(`La porta ${PORT} è già in uso: chiudi l'altro programma o cambia PORT nel file .env`);
    } else {
        console.error("Errore del server:", err.message);
    }
    process.exit(1);
});

async function start() {
    try {
        // 1) Verifica la connessione al database
        await sequelize.authenticate();
        console.log("Connesso al database MySQL!");

        // 2) Applica le migrazioni mancanti senza ricreare le tabelle esistenti
        await runMigrations();
        console.log("Database aggiornato");

        // 3) Avvia il server
        server.listen(PORT, () => {
            console.log(`Server in ascolto su http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error("Impossibile avviare il server:", err.message);
        process.exit(1);
    }
}

start();
