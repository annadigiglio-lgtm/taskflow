import express from "express";
import { getMessages, sendMessage } from "../controllers/messageController.js";

// Montato dentro projectRoutes su /api/projects/:projectId/messages
const router = express.Router({ mergeParams: true });

router.get("/", getMessages);
router.post("/", sendMessage);

export default router;
