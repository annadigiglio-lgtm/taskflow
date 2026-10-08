import express from "express";
import { authenticate } from "../middleware/auth.js";
import { loadProject, requireMember, requireOwner } from "../middleware/projectAccess.js";
import {
    listPublicProjects, createProject, getProject, updateProject, archiveProject,
    deleteProject, addMember, removeMember, reportProject
} from "../controllers/projectController.js";
import taskRoutes from "./taskRoutes.js";
import messageRoutes from "./messageRoutes.js";

const router = express.Router();

// Catalogo pubblico: accessibile anche senza login
router.get("/public", listPublicProjects);

// Da qui in poi TUTTE le rotte richiedono il login
router.use(authenticate);

router.post("/", createProject);

// I middleware vengono eseguiti in ordine, da sinistra a destra:
// loadProject (carica il progetto) -> requireOwner (controlla i permessi) -> controller
router.get("/:projectId", loadProject, getProject);
router.put("/:projectId", loadProject, requireOwner, updateProject);
router.patch("/:projectId/archive", loadProject, requireOwner, archiveProject);
router.delete("/:projectId", loadProject, requireOwner, deleteProject);

// Gestione membri (solo proprietario)
router.post("/:projectId/members", loadProject, requireOwner, addMember);
router.delete("/:projectId/members/:userId", loadProject, requireOwner, removeMember);

// Segnalazione (qualsiasi utente loggato)
router.post("/:projectId/reports", loadProject, reportProject);

// Task e chat: solo per i membri del progetto
router.use("/:projectId/tasks", loadProject, requireMember, taskRoutes);
router.use("/:projectId/messages", loadProject, requireMember, messageRoutes);

export default router;
