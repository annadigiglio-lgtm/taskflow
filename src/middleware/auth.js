import { verifyToken } from "../utils/jwt.js";
import httpError from "../utils/httpError.js";
import { loadSessionUser } from "../utils/session.js";

// AUTENTICAZIONE: "chi sei?"
// Legge il token dall'header  Authorization: Bearer <token>
// Se è valido, salva l'utente in req.user così i controller sanno chi sta facendo la richiesta.
export async function authenticate(req, res, next) {
    try {
        const header = req.headers.authorization;
        if (!header || !header.startsWith("Bearer ")) {
            throw httpError(401, "Token mancante: effettua il login");
        }
        const token = header.split(" ")[1];

        let payload;
        try {
            payload = verifyToken(token);
        } catch {
            throw httpError(401, "Token non valido o scaduto: effettua di nuovo il login");
        }

        // Rileggiamo l'utente dal database: così se un admin lo blocca,
        // il blocco vale subito, anche se il token non è ancora scaduto
        const user = await loadSessionUser(payload);
        if (!user) {
            throw httpError(401, "Sessione non valida: effettua di nuovo il login");
        }
        if (user.isBlocked) {
            throw httpError(403, "Il tuo account è stato bloccato da un amministratore");
        }

        req.user = user;
        req.token = token; // serve al logout
        next();
    } catch (err) {
        next(err);
    }
}

// AUTORIZZAZIONE: "cosa puoi fare?"
// Da usare DOPO authenticate: lascia passare solo gli amministratori
export function requireAdmin(req, res, next) {
    if (req.user.role !== "admin") {
        return next(httpError(403, "Operazione riservata agli amministratori"));
    }
    next();
}
