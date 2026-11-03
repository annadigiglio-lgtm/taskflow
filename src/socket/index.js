import { Server } from "socket.io";
import { ProjectMember } from "../models/index.js";
import { verifyToken } from "../utils/jwt.js";
import { loadSessionUser } from "../utils/session.js";

// Istanza di Socket.io condivisa con il resto dell'applicazione
let io;

// Usiamo le "stanze" (room) di Socket.io per mandare i messaggi solo a chi interessa:
//  - "user:<id>"     -> la stanza personale di ogni utente (notifiche personali)
//  - "project:<id>"  -> i membri di un progetto (bacheca live + chat)
//  - "admins"        -> tutti gli amministratori connessi (segnalazioni)

export function initSocket(httpServer) {
    io = new Server(httpServer, {
        cors: { origin: "*" }
    });

    // Middleware di autenticazione: il client deve mandare il JWT al momento della connessione
    //   io("http://localhost:3000", { auth: { token: "..." } })
    io.use(async (socket, next) => {
        try {
            const payload = verifyToken(socket.handshake.auth.token);
            const user = await loadSessionUser(payload);
            if (!user || user.isBlocked) {
                return next(new Error("Non autorizzato"));
            }
            socket.user = user; // salviamo l'utente sul socket
            socket.sessionToken = socket.handshake.auth.token;
            socket.tokenExpiresAt = payload.exp * 1000;
            next();
        } catch {
            next(new Error("Token non valido"));
        }
    });

    io.on("connection", (socket) => {
        // La scadenza del JWT vale anche per una connessione già aperta.
        let expiryTimer;
        function checkExpiry() {
            const remaining = socket.tokenExpiresAt - Date.now();
            if (remaining <= 0) return socket.disconnect(true);
            expiryTimer = setTimeout(checkExpiry, Math.min(remaining, 2 ** 31 - 1));
            expiryTimer.unref();
        }
        checkExpiry();
        socket.on("disconnect", () => clearTimeout(expiryTimer));
        console.log(`Socket connesso: ${socket.id} (utente ${socket.user.email})`);

        // Ogni utente entra subito nella sua stanza personale
        socket.join(`user:${socket.user.id}`);

        // Gli admin entrano anche nella stanza degli admin
        if (socket.user.role === "admin") {
            socket.join("admins");
        }

        // Il client chiede di "aprire" un progetto per ricevere bacheca e chat live.
        // Controlliamo che sia davvero un membro prima di farlo entrare nella stanza.
        socket.on("joinProject", async (projectId) => {
            try {
                const membership = await ProjectMember.findOne({
                    where: { projectId, userId: socket.user.id }
                });
                if (!membership) {
                    return socket.emit("errorMessage", "Non sei membro di questo progetto");
                }
                socket.join(`project:${projectId}`);
                socket.emit("joinedProject", { projectId });
            } catch {
                socket.emit("errorMessage", "Impossibile entrare nel progetto");
            }
        });

        socket.on("leaveProject", (projectId) => {
            socket.leave(`project:${projectId}`);
        });

        socket.on("disconnect", () => {
            console.log(`Socket disconnesso: ${socket.id}`);
        });
    });
    return io;
}

// --- Funzioni usate dai controller per inviare eventi in tempo reale ---

// Invia un evento a tutti i membri collegati a un progetto
export function emitToProject(projectId, event, data) {
    if (io) io.to(`project:${projectId}`).emit(event, data);
}

// Invia una notifica a un singolo utente
export function notifyUser(userId, message, data = {}) {
    if (io) io.to(`user:${userId}`).emit("notification", { message, ...data });
}

// Fa uscire un utente dalla stanza di un progetto (es. quando viene rimosso dai membri),
// così smette subito di ricevere bacheca e chat di quel progetto
export function removeUserFromProject(userId, projectId) {
    if (io) io.in(`user:${userId}`).socketsLeave(`project:${projectId}`);
}

// Invia un evento a tutti gli admin collegati
export function notifyAdmins(event, data) {
    if (io) io.to("admins").emit(event, data);
}

// Chiude subito le connessioni live di un utente bloccato da un admin.
export function disconnectUser(userId) {
    if (io) io.in(`user:${userId}`).disconnectSockets(true);
}

// Revoca solo la sessione che ha effettuato il logout, anche su più schede.
export function disconnectToken(token) {
    if (!io) return;
    for (const socket of io.sockets.sockets.values()) {
        if (socket.sessionToken === token) socket.disconnect(true);
    }
}
