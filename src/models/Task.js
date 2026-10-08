import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

// Valori ammessi, esportati così li riusiamo anche nei controller
// Le 3 colonne della bacheca: "Da fare", "In corso", "Completato"
export const TASK_STATUSES = ["todo", "in_progress", "done"];
export const TASK_PRIORITIES = ["low", "medium", "high"];

// Modello Task -> tabella "Tasks"
const Task = sequelize.define("Task", {
    title: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notNull: { msg: "Il titolo è obbligatorio" },
            notEmpty: { msg: "Il titolo è obbligatorio" }
        }
    },
    description: {
        type: DataTypes.TEXT
    },
    // Scadenza: solo la data, senza ora (es. "2026-11-08")
    dueDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        validate: {
            isDate: { msg: "dueDate deve essere una data valida (AAAA-MM-GG)" }
        }
    },
    priority: {
        type: DataTypes.ENUM(...TASK_PRIORITIES),
        defaultValue: "medium",
        validate: {
            isIn: { args: [TASK_PRIORITIES], msg: "La priorità deve essere low, medium o high" }
        }
    },
    status: {
        type: DataTypes.ENUM(...TASK_STATUSES),
        defaultValue: "todo",
        validate: {
            isIn: { args: [TASK_STATUSES], msg: "Lo stato deve essere todo, in_progress o done" }
        }
    }
    // projectId e assigneeId vengono aggiunti dalle relazioni in models/index.js
});

export default Task;
