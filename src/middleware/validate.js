import httpError from "../utils/httpError.js";
import { isValidDateOnly } from "../utils/date.js";

const text = (max, min = 0) => value => typeof value === "string" && value.trim().length >= min && value.length <= max;
const email = value => text(254, 3)(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const password = value => typeof value === "string" && value.length >= 8 && Buffer.byteLength(value, "utf8") <= 72;
const id = value => Number.isSafeInteger(value) && value > 0;
const nullable = check => value => value === null || check(value);
const oneOf = values => value => values.includes(value);
const boolean = value => typeof value === "boolean";
const project = {
    title: text(255, 1), description: nullable(text(20000)), category: nullable(text(255)),
    technologies: nullable(value => (typeof value === "string" && value.length <= 255) ||
        (Array.isArray(value) && value.every(text(50, 1)) && value.join(",").length <= 255)),
    visibility: oneOf(["public", "private"]),
    coverImage: nullable(value => {
        if (!text(255, 1)(value)) return false;
        try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
    })
};
const task = {
    title: text(255, 1), description: nullable(text(20000)), dueDate: nullable(isValidDateOnly),
    priority: oneOf(["low", "medium", "high"]), status: oneOf(["todo", "in_progress", "done"]), assigneeId: nullable(id)
};
// Metodo, percorso, campi ammessi e campi obbligatori. Gli extra restano ignorati dai controller.
const rules = [
    ["POST", /^\/auth\/register\/?$/, { name: text(255, 1), email, password }, ["name", "email", "password"]],
    ["POST", /^\/auth\/login\/?$/, { email, password: text(1024, 1) }, ["email", "password"]],
    ["POST", /^\/auth\/forgot-password\/?$/, { email }, ["email"]],
    ["POST", /^\/auth\/reset-password\/?$/, { token: value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value), newPassword: password }, ["token", "newPassword"]],
    ["POST", /^\/projects\/?$/, project, ["title"]],
    ["PUT", /^\/projects\/[^/]+\/?$/, project, []],
    ["PATCH", /^\/projects\/[^/]+\/archive\/?$/, { archived: boolean }, ["archived"]],
    ["POST", /^\/projects\/[^/]+\/members\/?$/, { email }, ["email"]],
    ["POST", /^\/projects\/[^/]+\/reports\/?$/, { reason: text(10000, 1) }, ["reason"]],
    ["POST", /^\/projects\/[^/]+\/messages\/?$/, { content: text(10000, 1) }, ["content"]],
    ["POST", /^\/projects\/[^/]+\/tasks\/?$/, task, ["title"]],
    ["PUT", /^\/projects\/[^/]+\/tasks\/[^/]+\/?$/, { title: task.title, description: task.description, dueDate: task.dueDate, priority: task.priority }, []],
    ["PATCH", /^\/projects\/[^/]+\/tasks\/[^/]+\/status\/?$/, { status: task.status }, ["status"]],
    ["PATCH", /^\/projects\/[^/]+\/tasks\/[^/]+\/assign\/?$/, { assigneeId: task.assigneeId }, ["assigneeId"]],
    ["PATCH", /^\/admin\/users\/[^/]+\/block\/?$/, { blocked: boolean }, ["blocked"]],
    ["PATCH", /^\/admin\/projects\/[^/]+\/hide\/?$/, { hidden: boolean }, ["hidden"]]
];

export function validateApiInput(req, res, next) {
    try {
        const path = req.path.toLowerCase(); // Express usa rotte senza distinzione maiuscole/minuscole.
        const parts = path.split("/").filter(Boolean);
        for (let i = 0; i < parts.length - 1; i++) {
            if (["projects", "tasks", "members", "users", "reports"].includes(parts[i])) {
                const value = parts[i + 1];
                if (parts[i] === "projects" && value === "public") continue;
                if (!/^[1-9]\d*$/.test(value) || !id(Number(value))) throw httpError(400, "ID non valido nel percorso");
            }
        }
        for (const [name, value] of Object.entries(req.query)) {
            if (typeof value !== "string" || value.length > 255) throw httpError(400, `Parametro '${name}' non valido`);
        }
        const rule = rules.find(([method, pattern]) => method === req.method && pattern.test(path));
        if (rule) {
            const [, , fields, required] = rule;
            if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) throw httpError(400, "Il body deve essere un oggetto JSON");
            for (const name of required) {
                if (!Object.hasOwn(req.body, name)) throw httpError(400, `Il campo '${name}' è obbligatorio`);
            }
            for (const [name, check] of Object.entries(fields)) {
                if (Object.hasOwn(req.body, name) && !check(req.body[name])) throw httpError(400, `Il campo '${name}' non è valido`);
            }
        }
        next();
    } catch (err) { next(err); }
}
