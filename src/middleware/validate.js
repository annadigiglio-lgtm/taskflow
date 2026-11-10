import httpError from "../utils/httpError.js";
import { isValidDateOnly } from "../utils/date.js";
import { positiveInteger } from "../utils/pagination.js";

// Funzioni normali: ricevono un valore e restituiscono true o false.
function isText(value, min, max) {
    if (typeof value !== "string") return false;
    return value.trim().length >= min && value.length <= max;
}

function isId(value) {
    return Number.isSafeInteger(value) && value > 0;
}

function isTechnologies(value) {
    if (typeof value === "string") return value.length <= 255;
    if (!Array.isArray(value)) return false;
    for (const technology of value) {
        if (!isText(technology, 1, 50)) return false;
    }
    return value.join(",").length <= 255;
}

function isImageUrl(value) {
    if (!isText(value, 1, 255)) return false;
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}

// Ogni campo ha un controllo esplicito. null è ammesso solo per i campi facoltativi.
function isValidField(name, value, isLogin) {
    const optionalFields = ["description", "category", "technologies", "coverImage", "dueDate", "assigneeId"];
    if (value === null && optionalFields.includes(name)) return true;

    switch (name) {
        case "name":
        case "title":
            return isText(value, 1, 255);
        case "email":
            return isText(value, 3, 254) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        case "password":
            if (isLogin) return isText(value, 1, 1024);
            return typeof value === "string" && value.length >= 8 && Buffer.byteLength(value, "utf8") <= 72;
        case "newPassword":
            return typeof value === "string" && value.length >= 8 && Buffer.byteLength(value, "utf8") <= 72;
        case "token":
            return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
        case "description":
            return isText(value, 0, 20000);
        case "category":
            return isText(value, 0, 255);
        case "technologies":
            return isTechnologies(value);
        case "coverImage":
            return isImageUrl(value);
        case "visibility":
            return value === "public" || value === "private";
        case "dueDate":
            return isValidDateOnly(value);
        case "priority":
            return ["low", "medium", "high"].includes(value);
        case "status":
            return ["todo", "in_progress", "done"].includes(value);
        case "assigneeId":
            return isId(value);
        case "archived":
        case "blocked":
        case "hidden":
            return typeof value === "boolean";
        case "reason":
        case "content":
            return isText(value, 1, 10000);
        default:
            return false;
    }
}

function checkBody(body, fields, required, isLogin) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw httpError(400, "Il body deve essere un oggetto JSON");
    }
    for (const name of required) {
        if (!Object.hasOwn(body, name)) throw httpError(400, `Il campo '${name}' è obbligatorio`);
    }
    for (const name of fields) {
        if (Object.hasOwn(body, name) && !isValidField(name, body[name], isLogin)) {
            throw httpError(400, `Il campo '${name}' non è valido`);
        }
    }
}

export function validateApiInput(req, res, next) {
    try {
        // /projects/3/tasks diventa ["projects", "3", "tasks"].
        const parts = req.path.toLowerCase().split("/").filter(Boolean);
        const method = req.method;
        for (let i = 0; i < parts.length - 1; i++) {
            if (["projects", "tasks", "members", "users", "reports"].includes(parts[i])) {
                const value = parts[i + 1];
                if (parts[i] === "projects" && value === "public") continue;
                if (!/^[1-9]\d*$/.test(value) || !isId(Number(value))) {
                    throw httpError(400, "ID non valido nel percorso");
                }
            }
        }
        for (const name of Object.keys(req.query)) {
            const value = req.query[name];
            if (typeof value !== "string" || value.length > 255) {
                throw httpError(400, `Parametro '${name}' non valido`);
            }
        }
        positiveInteger(req.query.page, "page", 1, 1000000);
        positiveInteger(req.query.limit, "limit", 25, 100);
        positiveInteger(req.query.before, "before");

        let fields = [];
        let required = [];
        const isLogin = parts[0] === "auth" && parts[1] === "login";
        if (parts[0] === "auth" && parts.length === 2 && method === "POST") {
            switch (parts[1]) {
                case "register":
                    fields = ["name", "email", "password"];
                    break;
                case "login":
                    fields = ["email", "password"];
                    break;
                case "forgot-password":
                    fields = ["email"];
                    break;
                case "reset-password":
                    fields = ["token", "newPassword"];
                    break;
            }
            required = fields;
        }
        if (parts[0] === "projects") {
            if ((parts.length === 1 && method === "POST") || (parts.length === 2 && method === "PUT")) {
                fields = ["title", "description", "category", "technologies", "visibility", "coverImage"];
                if (method === "POST") required = ["title"];
            }
            if (parts.length === 3) {
                if (parts[2] === "archive" && method === "PATCH") fields = ["archived"];
                if (parts[2] === "members" && method === "POST") fields = ["email"];
                if (parts[2] === "reports" && method === "POST") fields = ["reason"];
                if (parts[2] === "messages" && method === "POST") fields = ["content"];
                required = fields;
                if (parts[2] === "tasks" && method === "POST") {
                    fields = ["title", "description", "dueDate", "priority", "status", "assigneeId"];
                    required = ["title"];
                }
            }
            if (parts[2] === "tasks" && parts.length === 4 && method === "PUT") {
                fields = ["title", "description", "dueDate", "priority"];
            }
            if (parts[2] === "tasks" && parts.length === 5 && method === "PATCH") {
                if (parts[4] === "status") fields = ["status"];
                if (parts[4] === "assign") fields = ["assigneeId"];
                required = fields;
            }
        }
        if (parts[0] === "admin" && parts.length === 4 && method === "PATCH") {
            if (parts[1] === "users" && parts[3] === "block") fields = ["blocked"];
            if (parts[1] === "projects" && parts[3] === "hide") fields = ["hidden"];
            required = fields;
        }
        if (fields.length > 0) checkBody(req.body, fields, required, isLogin);
        next();
    } catch (err) {
        next(err);
    }
}
