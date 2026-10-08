import express from "express";
import { getBoard, createTask, updateTask, moveTask, assignTask, deleteTask } from "../controllers/taskController.js";

// Questo router è "montato" dentro projectRoutes su /api/projects/:projectId/tasks
// mergeParams: true -> ci permette di leggere anche :projectId dell'URL "padre"
const router = express.Router({ mergeParams: true });

router.get("/", getBoard);
router.post("/", createTask);
router.put("/:taskId", updateTask);
router.patch("/:taskId/status", moveTask);
router.patch("/:taskId/assign", assignTask);
router.delete("/:taskId", deleteTask);

export default router;
