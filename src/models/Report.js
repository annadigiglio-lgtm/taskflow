import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

// Modello Report -> tabella "Reports" (segnalazioni di progetti da moderare)
const Report = sequelize.define("Report", {
    reason: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
            notNull: { msg: "Il motivo della segnalazione è obbligatorio" },
            notEmpty: { msg: "Il motivo della segnalazione è obbligatorio" }
        }
    },
    // "open" = da gestire, "resolved" = gestita da un admin
    status: {
        type: DataTypes.ENUM("open", "resolved"),
        defaultValue: "open"
    }
    // projectId e userId (chi segnala) vengono aggiunti dalle relazioni in models/index.js
});

export default Report;
