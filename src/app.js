import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { fileURLToPath } from "node:url";
import { validateApiInput } from "./middleware/validate.js";

import authRoutes from "./routes/authRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

const app = express();

// --- Middleware globali (l'ordine è importante!) ---

// 1) Sicurezza: helmet imposta header HTTP di sicurezza, cors permette
//    le chiamate da altri domini (es. un frontend separato)
app.use(helmet());
app.use(cors({ exposedHeaders: ["X-Page", "X-Limit", "X-Total-Count", "X-Has-More", "X-Before", "X-Blocked-Count"] }));

// 2) Logging: stampa metodo, URL e data/ora di ogni richiesta
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleString()}] ${req.method} ${req.originalUrl}`);
    next(); // passa al middleware successivo
});

// 3) Rate limiting su tutte le API: max 300 richieste ogni 15 minuti per IP
app.use("/api", rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    message: { error: "Troppe richieste! Riprova più tardi." }
}));

// 4) Parsing del body JSON -> disponibile in req.body
app.use(express.json());
app.use("/api", validateApiInput);

// 5) File statici dell'interfaccia web (HTML, CSS, JavaScript e immagini)
app.use(express.static(fileURLToPath(new URL("../public/", import.meta.url))));

// --- Rotte (routing modulare) ---
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/admin", adminRoutes);

// --- Gestione errori (SEMPRE alla fine) ---
app.use(notFound);      // nessuna rotta ha risposto -> 404
app.use(errorHandler);  // qualcuno ha chiamato next(err) -> errore gestito qui

export default app;
