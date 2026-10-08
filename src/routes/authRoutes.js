import express from "express";
import rateLimit from "express-rate-limit";
import { authenticate } from "../middleware/auth.js";
import { register, login, logout, me, forgotPassword, resetPassword } from "../controllers/authController.js";

const router = express.Router();

// Rate limiting sul login: max 10 tentativi SBAGLIATI ogni 15 minuti per IP
// (protezione dagli attacchi brute-force, vedi slide "Rate Limiting per API")
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minuti
    limit: 10,
    skipSuccessfulRequests: true, // i login riusciti non vengono contati
    message: { error: "Troppi tentativi di login, riprova tra 15 minuti" }
});

// Rotte pubbliche (non serve essere loggati)
router.post("/register", register);
router.post("/login", loginLimiter, login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Rotte protette (serve il token)
router.post("/logout", authenticate, logout);
router.get("/me", authenticate, me);

export default router;
