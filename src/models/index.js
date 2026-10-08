// In questo file importiamo tutti i modelli e definiamo le RELAZIONI tra le tabelle.
// Gli altri file importano i modelli da qui, così le relazioni sono sempre attive.
import User from "./User.js";
import Project from "./Project.js";
import ProjectMember from "./ProjectMember.js";
import Task from "./Task.js";
import Message from "./Message.js";
import Report from "./Report.js";

// --- Proprietario del progetto (Uno-a-Molti) ---
// Un utente può creare tanti progetti, un progetto ha un solo proprietario
User.hasMany(Project, { foreignKey: "ownerId", as: "ownedProjects" });
Project.belongsTo(User, { foreignKey: "ownerId", as: "owner" });

// --- Membri del progetto (Molti-a-Molti tramite la tabella ProjectMember) ---
Project.belongsToMany(User, { through: ProjectMember, foreignKey: "projectId", as: "members" });
User.belongsToMany(Project, { through: ProjectMember, foreignKey: "userId", as: "memberProjects" });

// --- Task (Uno-a-Molti) ---
// Se il progetto viene cancellato, vengono cancellati anche i suoi task (CASCADE)
Project.hasMany(Task, { foreignKey: "projectId", onDelete: "CASCADE" });
Task.belongsTo(Project, { foreignKey: "projectId" });
// L'assegnatario del task (può essere vuoto = task non assegnato)
Task.belongsTo(User, { foreignKey: "assigneeId", as: "assignee" });

// --- Messaggi della chat ---
Project.hasMany(Message, { foreignKey: "projectId", onDelete: "CASCADE" });
Message.belongsTo(User, { foreignKey: "userId", as: "author" });

// --- Segnalazioni ---
Project.hasMany(Report, { foreignKey: "projectId", onDelete: "CASCADE" });
Report.belongsTo(Project, { foreignKey: "projectId" });
Report.belongsTo(User, { foreignKey: "userId", as: "reporter" });

export { User, Project, ProjectMember, Task, Message, Report };
