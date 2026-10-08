import express from "express";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { listUsers, blockUser, listReports, hideProject, resolveReport } from "../controllers/adminController.js";

const router = express.Router();

// Tutte le rotte admin: prima login, poi controllo del ruolo
router.use(authenticate, requireAdmin);

router.get("/users", listUsers);
router.patch("/users/:userId/block", blockUser);
router.get("/reports", listReports);
router.patch("/reports/:reportId/resolve", resolveReport);
router.patch("/projects/:projectId/hide", hideProject);

export default router;
