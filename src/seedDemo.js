// Crea account e dati dimostrativi per provare TaskFlow con piu' persone.
// Eseguire con: npm run seed:demo
import "dotenv/config";
import bcrypt from "bcryptjs";
import sequelize from "./config/db.js";
import { Message, Project, ProjectMember, Task, User } from "./models/index.js";
import { runMigrations } from "./migrations/index.js";

const DEMO_PASSWORD = "TaskFlow2026!";
const people = [
    {
        name: "Anna Demo", email: "demo.anna@example.com",
        title: "Portfolio di classe", category: "Design",
        description: "Un portfolio condiviso per raccontare i progetti del corso.",
        technologies: ["figma", "html", "css"]
    },
    {
        name: "Marco Demo", email: "demo.marco@example.com",
        title: "EcoMarket", category: "E-commerce",
        description: "Un piccolo marketplace per prodotti locali e sostenibili.",
        technologies: ["node", "express", "mysql"]
    },
    {
        name: "Giulia Demo", email: "demo.giulia@example.com",
        title: "App eventi ITS", category: "Applicazioni",
        description: "Un'app per organizzare eventi, iscrizioni e comunicazioni.",
        technologies: ["javascript", "node", "socket.io"]
    },
    {
        name: "Luca Demo", email: "demo.luca@example.com",
        title: "Dashboard IoT", category: "Data",
        description: "Una dashboard per visualizzare dati e stato dei dispositivi.",
        technologies: ["node", "mysql", "charts"]
    },
    {
        name: "Sara Demo", email: "demo.sara@example.com",
        title: "TaskFlow per il team", category: "Organizzazione",
        description: "Una raccolta di idee per migliorare la collaborazione del team.",
        technologies: ["express", "sequelize", "socket.io"]
    }
];

function dateInDays(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
}

async function seedDemo() {
    try {
        await sequelize.authenticate();
        await runMigrations();

        const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
        const users = [];
        for (const person of people) {
            const [user, created] = await User.findOrCreate({
                where: { email: person.email },
                defaults: { name: person.name, password: passwordHash, role: "user" }
            });
            if (!created && user.role !== "user") {
                throw new Error(`L'email demo ${person.email} e' gia' usata da un account non demo.`);
            }
            users.push(user);
        }

        const projects = [];
        for (let index = 0; index < people.length; index++) {
            const person = people[index];
            const owner = users[index];
            const [project] = await Project.findOrCreate({
                where: { title: person.title, ownerId: owner.id },
                defaults: {
                    description: person.description,
                    category: person.category,
                    technologies: person.technologies,
                    visibility: index === 2 ? "private" : "public"
                }
            });
            projects.push(project);

            const ownerMembership = await ProjectMember.findOne({
                where: { projectId: project.id, userId: owner.id }
            });
            if (!ownerMembership) await project.addMember(owner);

            // Ogni progetto ha il proprietario e due collaboratori, cosi' la demo
            // mostra sia i progetti creati sia quelli ricevuti come invito.
            for (const offset of [1, 2]) {
                const member = users[(index + offset) % users.length];
                const existingMembership = await ProjectMember.findOne({
                    where: { projectId: project.id, userId: member.id }
                });
                if (!existingMembership) await project.addMember(member);
            }

            const sampleTasks = [
                { title: "Raccogliere le idee del team", status: "todo", priority: "medium", dueDate: dateInDays(2), assignee: owner },
                { title: "Preparare la prima bozza", status: "in_progress", priority: "high", dueDate: dateInDays(4), assignee: users[(index + 1) % users.length] },
                { title: "Condividere il risultato", status: "done", priority: "low", dueDate: dateInDays(-1), assignee: users[(index + 2) % users.length] }
            ];
            for (const sample of sampleTasks) {
                await Task.findOrCreate({
                    where: { projectId: project.id, title: sample.title },
                    defaults: {
                        description: `Attivita' dimostrativa per ${person.title}.`,
                        status: sample.status,
                        priority: sample.priority,
                        dueDate: sample.dueDate,
                        assigneeId: sample.assignee.id
                    }
                });
            }

            const hasMessage = await Message.findOne({
                where: { projectId: project.id, userId: owner.id, content: "Benvenuti nel progetto! Qui possiamo coordinarci." }
            });
            if (!hasMessage) {
                await Message.create({
                    projectId: project.id,
                    userId: owner.id,
                    content: "Benvenuti nel progetto! Qui possiamo coordinarci."
                });
            }
        }

        console.log("Account demo pronti (password per tutti: " + DEMO_PASSWORD + "):");
        people.forEach((person, index) => {
            console.log(`- ${person.name} | ${person.email} | progetto: ${projects[index].title}`);
        });
        console.log("Il seed e' riutilizzabile: non duplica progetti, task, messaggi o membri gia' creati.");
    } catch (error) {
        console.error("Errore nel seed demo:", error.message);
        process.exitCode = 1;
    } finally {
        await sequelize.close();
    }
}

seedDemo();
