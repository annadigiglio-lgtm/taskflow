import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

// Modello Message -> tabella "Messages" (messaggi della chat di un progetto)
const Message = sequelize.define("Message", {
    content: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
            notNull: { msg: "Il messaggio non può essere vuoto" },
            notEmpty: { msg: "Il messaggio non può essere vuoto" }
        }
    }
    // projectId e userId (autore) vengono aggiunti dalle relazioni in models/index.js
});

export default Message;
