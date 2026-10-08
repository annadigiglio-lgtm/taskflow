import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

// Modello Project -> tabella "Projects"
const Project = sequelize.define("Project", {
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
    category: {
        type: DataTypes.STRING
    },
    // Le tecnologie arrivano come array (es. ["node", "mysql"]) ma nel database
    // le salviamo come una semplice stringa separata da virgole: "node,mysql".
    // Il "setter" trasforma l'array in stringa quando salviamo,
    // il "getter" trasforma la stringa in array quando leggiamo.
    technologies: {
        type: DataTypes.STRING,
        set(value) {
            if (Array.isArray(value)) {
                this.setDataValue("technologies", value.map(t => String(t).trim().toLowerCase()).join(","));
            } else {
                this.setDataValue("technologies", value);
            }
        },
        get() {
            const value = this.getDataValue("technologies");
            return value ? value.split(",") : [];
        }
    },
    visibility: {
        type: DataTypes.ENUM("public", "private"),
        defaultValue: "private",
        validate: {
            isIn: { args: [["public", "private"]], msg: "La visibilità deve essere 'public' o 'private'" }
        }
    },
    // Immagine di copertina: salviamo l'URL dell'immagine
    coverImage: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
            isUrl: { msg: "coverImage deve essere un URL valido" }
        }
    },
    // "active" = progetto attivo, "archived" = archiviato dal proprietario
    status: {
        type: DataTypes.ENUM("active", "archived"),
        defaultValue: "active"
    },
    // Un admin può nascondere un progetto segnalato: sparisce dal catalogo pubblico
    isHidden: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
    // ownerId viene aggiunto dalla relazione in models/index.js
});

export default Project;
