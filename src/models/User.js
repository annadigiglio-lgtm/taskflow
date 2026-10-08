import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

// Modello User -> tabella "Users"
const User = sequelize.define("User", {
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notNull: { msg: "Il nome è obbligatorio" },
            notEmpty: { msg: "Il nome è obbligatorio" }
        }
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            notNull: { msg: "L'email è obbligatoria" },
            isEmail: { msg: "Email non valida" }
        }
    },
    // Qui salviamo l'HASH della password (bcrypt), mai la password in chiaro
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    // Ruolo globale: "user" (utente base) oppure "admin" (amministratore).
    // Il "proprietario" invece NON è un ruolo globale: dipende dal progetto
    // (è l'utente che lo ha creato, vedi Project.ownerId)
    role: {
        type: DataTypes.ENUM("user", "admin"),
        defaultValue: "user"
    },
    // Un admin può bloccare un utente: un utente bloccato non può più usare l'app
    isBlocked: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    // Campi per il recupero password
    resetToken: {
        type: DataTypes.STRING,
        allowNull: true
    },
    resetTokenExpires: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    // Lo "scope di default" viene applicato a TUTTE le query sugli utenti:
    // escludiamo i campi sensibili così non finiscono mai per sbaglio in una risposta.
    // Quando ci servono (login, reset password) usiamo User.unscoped()
    defaultScope: {
        attributes: { exclude: ["password", "resetToken", "resetTokenExpires"] }
    }
});

export default User;
