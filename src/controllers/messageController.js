import { Message, User } from "../models/index.js";
import { emitToProject } from "../socket/index.js";

// Chat del progetto.
// Scelta implementativa: i messaggi si INVIANO con una richiesta REST (POST)
// e si RICEVONO in tempo reale con Socket.io (evento "chatMessage").
// Così usiamo gli stessi controlli di sicurezza delle altre API
// (login + membro del progetto) e il messaggio viene sempre salvato nel database.

// GET /api/projects/:projectId/messages -> storico della chat
export async function getMessages(req, res, next) {
    try {
        const messages = await Message.findAll({
            where: { projectId: req.project.id },
            include: [{ model: User, as: "author", attributes: ["id", "name"] }],
            order: [["createdAt", "ASC"]] // dal più vecchio al più recente
        });
        res.json(messages);
    } catch (err) {
        next(err);
    }
}

// POST /api/projects/:projectId/messages
// Body: { "content": "Ciao a tutti!" }
export async function sendMessage(req, res, next) {
    try {
        const created = await Message.create({
            content: req.body.content,
            projectId: req.project.id,
            userId: req.user.id
        });
        const message = await Message.findByPk(created.id, {
            include: [{ model: User, as: "author", attributes: ["id", "name"] }]
        });

        // Il messaggio arriva in tempo reale a tutti i membri collegati
        emitToProject(req.project.id, "chatMessage", message);

        res.status(201).json(message);
    } catch (err) {
        next(err);
    }
}
