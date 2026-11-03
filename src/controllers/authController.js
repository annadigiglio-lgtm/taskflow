import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Op } from "sequelize";
import { User } from "../models/index.js";
import { generateToken, revokedTokens } from "../utils/jwt.js";
import httpError from "../utils/httpError.js";
import { disconnectToken, disconnectUser } from "../socket/index.js";

// Controlla che un valore sia una stringa non vuota.
// Serve anche contro le injection: se qualcuno manda un oggetto
// (es. { "$ne": null }) al posto di una stringa, lo rifiutiamo.
function isNonEmptyString(value) {
    return typeof value === "string" && value.trim() !== "";
}

// POST /api/auth/register
export async function register(req, res, next) {
    try {
        const { name, email, password } = req.body;

        if (!isNonEmptyString(name) || !isNonEmptyString(email) || !isNonEmptyString(password)) {
            throw httpError(400, "name, email e password sono obbligatori");
        }
        if (password.length < 8) {
            throw httpError(400, "La password deve avere almeno 8 caratteri");
        }

        const existing = await User.findOne({ where: { email } });
        if (existing) {
            throw httpError(409, "Email già registrata");
        }

        // Salviamo l'hash della password, non la password in chiaro
        const hashedPassword = await bcrypt.hash(password, 10);

        // Il ruolo NON lo prendiamo dal body: chi si registra è sempre un utente base
        const user = await User.create({ name, email, password: hashedPassword });

        // 201 Created. Rispondiamo senza la password
        res.status(201).json({
            message: "Registrazione completata",
            user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });
    } catch (err) {
        next(err);
    }
}

// POST /api/auth/login
export async function login(req, res, next) {
    try {
        const { email, password } = req.body;

        if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
            throw httpError(400, "email e password sono obbligatori");
        }

        // unscoped() perché qui ci serve anche il campo password (escluso di default)
        const user = await User.unscoped().findOne({ where: { email } });

        // Messaggio generico: non diciamo se è sbagliata l'email o la password
        if (!user || !(await bcrypt.compare(password, user.password))) {
            throw httpError(401, "Credenziali non valide");
        }
        if (user.isBlocked) {
            throw httpError(403, "Il tuo account è stato bloccato da un amministratore");
        }

        const token = generateToken(user);
        res.json({
            token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });
    } catch (err) {
        next(err);
    }
}

// POST /api/auth/logout
// Aggiungiamo il token alla lista dei token revocati: da ora non sarà più accettato
export function logout(req, res) {
    revokedTokens.add(req.token);
    disconnectToken(req.token);
    res.json({ message: "Logout effettuato" });
}

// GET /api/auth/me -> i dati dell'utente loggato
export function me(req, res) {
    res.json(req.user);
}

// POST /api/auth/forgot-password
// Genera un codice di reset valido 1 ora.
// In un'app reale verrebbe inviato via email (es. con la libreria nodemailer):
// qui, per semplicità, lo stampiamo nella console del server.
export async function forgotPassword(req, res, next) {
    try {
        const { email } = req.body;
        if (!isNonEmptyString(email)) {
            throw httpError(400, "L'email è obbligatoria");
        }

        const user = await User.findOne({ where: { email } });
        if (user) {
            const resetToken = crypto.randomBytes(32).toString("hex"); // stringa casuale
            await user.update({
                resetToken: crypto.createHash("sha256").update(resetToken).digest("hex"),
                resetTokenExpires: new Date(Date.now() + 60 * 60 * 1000) // tra 1 ora
            });
            console.log(`[EMAIL SIMULATA] Reset password per ${email} - token: ${resetToken}`);
        }

        // Rispondiamo sempre allo stesso modo, così non riveliamo quali email sono registrate
        res.json({ message: "Se l'email è registrata, riceverai le istruzioni per il reset" });
    } catch (err) {
        next(err);
    }
}

// POST /api/auth/reset-password
export async function resetPassword(req, res, next) {
    try {
        const { token, newPassword } = req.body;
        if (!isNonEmptyString(token) || !isNonEmptyString(newPassword)) {
            throw httpError(400, "token e newPassword sono obbligatori");
        }
        if (newPassword.length < 8) {
            throw httpError(400, "La password deve avere almeno 8 caratteri");
        }

        // Cerchiamo l'utente con quel token e con la scadenza non ancora passata
        const resetTokenHash = crypto.createHash("sha256").update(token).digest("hex");
        const user = await User.unscoped().findOne({
            where: {
                resetToken: resetTokenHash,
                resetTokenExpires: { [Op.gt]: new Date() } // Op.gt = "maggiore di"
            }
        });
        if (!user) {
            throw httpError(400, "Token di reset non valido o scaduto");
        }

        // Compare-and-set: due richieste concorrenti non possono consumare lo stesso token.
        const [updated] = await User.update({
            password: await bcrypt.hash(newPassword, 10),
            resetToken: null,
            resetTokenExpires: null
        }, {
            where: { id: user.id, resetToken: resetTokenHash, resetTokenExpires: { [Op.gt]: new Date() } }
        });
        if (updated !== 1) throw httpError(400, "Token di reset non valido o scaduto");
        disconnectUser(user.id);
        res.json({ message: "Password aggiornata, ora puoi fare il login" });
    } catch (err) {
        next(err);
    }
}
