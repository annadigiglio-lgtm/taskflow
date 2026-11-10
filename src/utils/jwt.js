import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";

// Token "revocati" con il logout.
// Un JWT è valido finché non scade, quindi per fare il logout lato server
// salviamo qui i token che non devono più essere accettati.
// NB: è un Set in memoria, quindi si svuota quando il server si riavvia
// (in un progetto reale si userebbe un database o Redis).
export const revokedTokens = new Set();

// Crea un token JWT con dentro l'id e il ruolo dell'utente
export function generateToken(user) {
    const payload = {
        id: user.id,
        role: user.role,
        tokenVersion: user.tokenVersion || 0
    };
    return jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "1d", jwtid: randomUUID() }
    );
}

// Controlla il token: se è valido restituisce il contenuto (payload),
// altrimenti lancia un errore (token falso, scaduto o revocato)
export function verifyToken(token) {
    if (revokedTokens.has(token)) {
        throw new Error("Token revocato");
    }
    return jwt.verify(token, process.env.JWT_SECRET);
}
