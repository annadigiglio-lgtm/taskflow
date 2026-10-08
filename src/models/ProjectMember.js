import sequelize from "../config/db.js";

// Tabella "ponte" della relazione Molti-a-Molti tra User e Project:
// un utente può essere membro di tanti progetti e un progetto ha tanti membri.
// Le colonne projectId e userId vengono create da Sequelize (vedi models/index.js),
// createdAt ci dice quando l'utente è entrato nel progetto.
const ProjectMember = sequelize.define("ProjectMember", {});

export default ProjectMember;
