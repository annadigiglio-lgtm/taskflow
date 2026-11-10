import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import mysql from "mysql2/promise";
import { once } from "node:events";
import http from "node:http";

test("API HTTP con MySQL isolato", async t => {
    const database = `taskflow_test_${randomBytes(8).toString("hex")}`;
    const admin = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
    let db, server, io;
    try {
        await admin.query(`CREATE DATABASE \`${database}\``);
        process.env.DB_NAME = database;
        process.env.JWT_SECRET = randomBytes(32).toString("hex");
        const { default: sequelize } = await import("../src/config/db.js");
        db = sequelize;
        const { User, Message, Project, Report } = await import("../src/models/index.js");
        const { default: app } = await import("../src/app.js");
        const { initSocket } = await import("../src/socket/index.js");
        const { generateToken, verifyToken } = await import("../src/utils/jwt.js");
        const { runMigrations } = await import("../src/migrations/index.js");
        await runMigrations();
        await runMigrations();
        server = http.createServer(app);
        io = initSocket(server);
        server.listen(0, "127.0.0.1");
        await once(server, "listening");
        const base = `http://127.0.0.1:${server.address().port}`;
        function connectSocket(token) {
            return new Promise((resolve, reject) => {
                const socket = new WebSocket(`${base.replace("http", "ws")}/socket.io/?EIO=4&transport=websocket`);
                const timer = setTimeout(() => { socket.close(); reject(new Error("Socket handshake timeout")); }, 5000);
                socket.addEventListener("message", event => {
                    const packet = String(event.data);
                    if (packet.startsWith("0")) socket.send(`40${JSON.stringify({ token })}`);
                    if (packet.startsWith("40")) { clearTimeout(timer); resolve(socket); }
                    if (packet.startsWith("44")) { clearTimeout(timer); socket.close(); reject(new Error("Unauthorized socket")); }
                    if (packet === "2") socket.send("3");
                });
                socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("Socket connection failed")); });
            });
        }
        function waitForDisconnect(socket) {
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error("Socket disconnect timeout")), 5000);
                socket.addEventListener("message", event => {
                    if (String(event.data) === "41") { clearTimeout(timer); socket.close(); resolve(); }
                });
                socket.addEventListener("close", () => { clearTimeout(timer); resolve(); }, { once: true });
            });
        }
        const password = "TaskFlow2026!";
        async function api(path, { method = "GET", token, body } = {}) {
            const response = await fetch(`${base}/api${path}`, {
                method, headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                ...(body !== undefined ? { body: JSON.stringify(body) } : {})
            });
            return { status: response.status, headers: response.headers, body: response.status === 204 ? null : await response.json() };
        }
        const accounts = {};
        for (const name of ["owner", "member", "outsider", "admin"]) {
            const email = `${name}@example.com`;
            const registered = await api("/auth/register", { method: "POST", body: { name, email, password, role: "admin" } });
            assert.equal(registered.status, 201);
            assert.equal(registered.body.user.role, "user");
            if (name === "admin") await User.update({ role: "admin" }, { where: { email } });
            const login = await api("/auth/login", { method: "POST", body: { email, password } });
            assert.equal(login.status, 200);
            accounts[name] = login.body;
        }
        const owner = accounts.owner.token, member = accounts.member.token, outsider = accounts.outsider.token;
        let projectId, taskId;
        function socketEvent(socket, eventName) {
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => { socket.removeEventListener("message", receive); reject(new Error(`Missing socket event: ${eventName}`)); }, 5000);
                function receive(event) {
                    const packet = String(event.data);
                    if (!packet.startsWith("42")) return;
                    const [name, data] = JSON.parse(packet.slice(2));
                    if (name === eventName) { clearTimeout(timer); socket.removeEventListener("message", receive); resolve(data); }
                }
                socket.addEventListener("message", receive);
            });
        }
        await t.test("permessi: login, ruolo admin e campi sensibili", async () => {
            assert.equal((await api("/dashboard")).status, 401);
            assert.equal((await api("/admin/users", { token: outsider })).status, 403);
            assert.equal((await api("/admin/users", { token: accounts.admin.token })).status, 200);
            const me = await api("/auth/me", { token: owner });
            assert.equal(me.status, 200);
            for (const field of ["password", "resetToken", "resetTokenExpires"]) assert.equal(Object.hasOwn(me.body, field), false);
        });
        await t.test("validazione: body, limiti, ID, enum e query", async () => {
            for (const body of [[], null, {}, { title: "   " }, { title: "x".repeat(256) }, { title: "Test", technologies: [{}] }, { title: "Test", visibility: "other" }]) {
                assert.equal((await api("/projects", { method: "POST", token: owner, body })).status, 400);
            }
            assert.equal((await api("/PROJECTS", { method: "POST", token: owner, body: { title: [] } })).status, 400);
            for (const path of ["/projects/nope", "/projects/0", "/projects/9007199254740992", "/projects/public?category[x]=web", "/projects/public?from=2026-02-30"]) {
                assert.equal((await api(path, { token: owner })).status, 400);
            }
            assert.equal((await api("/auth/register", { method: "POST", body: { name: "Test", email: "test@example.com", password: "é".repeat(37) } })).status, 400);
        });
        await t.test("progetti privati, membri e task isolati per progetto", async () => {
            const created = await api("/projects", { method: "POST", token: owner, body: { title: "Privato", visibility: "private" } });
            assert.equal(created.status, 201);
            projectId = created.body.id;
            assert.equal((await api(`/projects/${projectId}`, { token: outsider })).status, 403);
            for (const route of ["tasks", "messages"]) {
                assert.equal((await api(`/projects/${projectId}/${route}`, { token: outsider })).status, 403);
            }
            assert.equal((await api(`/projects/${projectId}`, { method: "PUT", token: outsider, body: { title: "No" } })).status, 403);
            assert.equal((await api(`/projects/${projectId}/members`, { method: "POST", token: owner, body: { email: "member@example.com" } })).status, 201);
            const createdTask = await api(`/projects/${projectId}/tasks`, { method: "POST", token: member, body: { title: "Task", assigneeId: accounts.member.user.id } });
            assert.equal(createdTask.status, 201);
            taskId = createdTask.body.id;
            const other = await api("/projects", { method: "POST", token: owner, body: { title: "Altro" } });
            assert.equal((await api(`/projects/${other.body.id}/tasks/${taskId}`, { method: "PUT", token: owner, body: { title: "No" } })).status, 404);
            assert.equal((await api(`/projects/${projectId}/tasks/${taskId}/assign`, { method: "PATCH", token: member, body: { assigneeId: accounts.outsider.user.id } })).status, 400);
            assert.equal((await api(`/projects/${projectId}/tasks/${taskId}/status`, { method: "PATCH", token: member, body: { status: "done" } })).status, 200);
            assert.equal((await api(`/projects/${projectId}/messages`, { method: "POST", token: member, body: { content: "Ciao" } })).status, 201);
            assert.equal((await api(`/projects/${projectId}/messages`, { token: member })).body.length, 1);
            assert.equal((await api(`/projects/${projectId}/members/${accounts.member.user.id}`, { method: "DELETE", token: owner })).status, 204);
            assert.equal((await api(`/projects/${projectId}/tasks`, { token: member })).status, 403);
            const board = await api(`/projects/${projectId}/tasks`, { token: owner });
            assert.equal(board.body.done[0].assigneeId, null);
        });
        await t.test("paginazione: catalogo, dashboard, utenti e report", async () => {
            await Project.bulkCreate(Array.from({ length: 6 }, (_, i) => ({ title: `Public ${i}`, visibility: "public", ownerId: accounts.owner.user.id })));
            const first = await api("/projects/public?limit=2");
            const second = await api("/projects/public?limit=2&page=2");
            assert.equal(first.body.length, 2);
            assert.equal(first.headers.get("X-Total-Count"), "6");
            assert.equal(first.headers.get("X-Has-More"), "true");
            assert.equal(second.body.some(item => first.body.some(other => other.id === item.id)), false);
            assert.equal((await api("/projects/public?q=Public%205")).body.length, 1);
            const dashboard = await api("/dashboard?limit=2", { token: owner });
            assert.equal(dashboard.status, 200);
            assert.equal(dashboard.body.ownedProjects.length, 2);
            assert.equal(dashboard.body.totals.activeProjects, 8);
            assert.equal(dashboard.body.pagination.hasMore, true);
            assert.equal((await api("/dashboard?limit=2", { token: member })).status, 200);
            const users = await api("/admin/users?limit=2&page=2", { token: accounts.admin.token });
            assert.equal(users.body.length, 2);
            assert.equal(users.headers.get("X-Total-Count"), "4");
            await Report.bulkCreate(Array.from({ length: 3 }, () => ({ projectId, userId: accounts.outsider.user.id, reason: "Test" })));
            const reports = await api("/admin/reports?limit=2", { token: accounts.admin.token });
            assert.equal(reports.body.length, 2);
            assert.equal(reports.headers.get("X-Total-Count"), "3");
            for (const query of ["limit=0", "limit=101", "page=-1", "page=1.5", "before=nope"]) assert.equal((await api(`/projects/public?${query}`)).status, 400);
        });
        await t.test("chat: cursor stabile mentre arrivano nuovi messaggi", async () => {
            await Message.bulkCreate(Array.from({ length: 6 }, (_, i) => ({ projectId, userId: accounts.owner.user.id, content: `History ${i}` })));
            const recent = await api(`/projects/${projectId}/messages?limit=3`, { token: owner });
            assert.equal(recent.body.length, 3);
            assert.equal(recent.headers.get("X-Has-More"), "true");
            assert.deepEqual(recent.body.map(message => message.content), ["History 3", "History 4", "History 5"]);
            await api(`/projects/${projectId}/messages`, { method: "POST", token: owner, body: { content: "New live message" } });
            const older = await api(`/projects/${projectId}/messages?limit=3&before=${recent.headers.get("X-Before")}`, { token: owner });
            assert.deepEqual(older.body.map(message => message.content), ["History 0", "History 1", "History 2"]);
            assert.equal(older.body.some(message => recent.body.some(other => other.id === message.id)), false);
            const last = await api(`/projects/${projectId}/messages?limit=3&before=${older.headers.get("X-Before")}`, { token: owner });
            assert.equal(last.body.length, 1);
            assert.equal(last.headers.get("X-Has-More"), "false");
        });
        await t.test("live: modifica, archiviazione, rimozione membri ed eliminazione", async () => {
            await api(`/projects/${projectId}/members`, { method: "POST", token: owner, body: { email: "member@example.com" } });
            const socket = await connectSocket(member);
            try {
                const joined = socketEvent(socket, "joinedProject");
                socket.send(`42${JSON.stringify(["joinProject", projectId])}`);
                await joined;
                let updated = socketEvent(socket, "projectUpdated");
                assert.equal((await api(`/projects/${projectId}`, { method: "PUT", token: owner, body: { title: "Updated live" } })).status, 200);
                assert.equal((await updated).projectId, projectId);
                updated = socketEvent(socket, "projectUpdated");
                await api(`/projects/${projectId}/archive`, { method: "PATCH", token: owner, body: { archived: true } });
                await updated;
                assert.equal((await api(`/projects/${projectId}`, { token: member })).body.status, "archived");
                assert.equal((await api(`/projects/${projectId}/tasks`, { token: member })).status, 200);
                assert.equal((await api(`/projects/${projectId}/messages`, { token: member })).status, 200);
                for (const action of [
                    { path: "tasks", method: "POST", body: { title: "Non consentito" } },
                    { path: `tasks/${taskId}`, method: "PUT", body: { title: "Non consentito" } },
                    { path: `tasks/${taskId}/status`, method: "PATCH", body: { status: "todo" } },
                    { path: `tasks/${taskId}/assign`, method: "PATCH", body: { assigneeId: null } },
                    { path: `tasks/${taskId}`, method: "DELETE" },
                    { path: "messages", method: "POST", body: { content: "Non consentito" } }
                ]) {
                    assert.equal((await api(`/projects/${projectId}/${action.path}`, { ...action, token: owner })).status, 403);
                }
                await api(`/projects/${projectId}/archive`, { method: "PATCH", token: owner, body: { archived: false } });
                const assigned = await api(`/projects/${projectId}/tasks/${taskId}/assign`, { method: "PATCH", token: owner, body: { assigneeId: accounts.member.user.id } });
                assert.equal(assigned.status, 200);
                const left = socketEvent(socket, "memberLeft");
                updated = socketEvent(socket, "projectUpdated");
                await api(`/projects/${projectId}/members/${accounts.member.user.id}`, { method: "DELETE", token: owner });
                await left; await updated;
                assert.equal((await api(`/projects/${projectId}/tasks`, { token: owner })).body.done[0].assigneeId, null);
                const room = io.sockets.sockets.values().find(client => client.user.id === accounts.member.user.id);
                assert.equal(room.rooms.has(`project:${projectId}`), false);
                await api(`/projects/${projectId}/members`, { method: "POST", token: owner, body: { email: "member@example.com" } });
                const deleted = socketEvent(socket, "projectDeleted");
                assert.equal((await api(`/projects/${projectId}`, { method: "DELETE", token: owner })).status, 204);
                assert.equal((await deleted).projectId, projectId);
                assert.equal((await api(`/projects/${projectId}`, { token: member })).status, 404);
                assert.equal(await Message.count({ where: { projectId } }), 0);
            } finally { socket.close(); }
        });
        await t.test("migrazioni: adozione dello schema e conservazione dei dati", async () => {
            const { up } = await import("../src/migrations/001-initial-schema.js");
            const before = await User.count();
            await up(db.getQueryInterface());
            // Simuliamo un database precedente al contatore, conservando gli utenti.
            await db.getQueryInterface().removeColumn("Users", "tokenVersion");
            await db.query("DELETE FROM SequelizeMeta WHERE name = ?", { replacements: ["003-token-version"] });
            // Le migrazioni si eseguono in ordine e possono essere ripetute.
            await runMigrations();
            await runMigrations();
            assert.equal(await User.count(), before);
            assert.equal((await User.findByPk(accounts.owner.user.id)).tokenVersion, 0);
            const [applied] = await db.query("SELECT name FROM SequelizeMeta");
            assert.equal(applied.length, 3);
            assert.equal((await db.getQueryInterface().showIndex("Messages")).some(index => index.name === "messages_project_id"), true);
        });
        await t.test("browser: gestione progetti, catalogo, notifiche e recupero password", async browserTest => {
            const { checkBrowser } = await import("./browser.js");
            let resetToken;
            const originalLog = console.log;
            console.log = (...args) => {
                const line = args.join(" ");
                if (line.startsWith("[EMAIL SIMULATA]")) resetToken = line.split("token: ")[1];
                else originalLog(...args);
            };
            try { await checkBrowser(base, owner, browserTest, () => resetToken); }
            finally { console.log = originalLog; }
        });
        await t.test("scadenza JWT: chiude il socket e impedisce nuove richieste", async () => {
            const user = await User.unscoped().findByPk(accounts.member.user.id);
            const previousExpiry = process.env.JWT_EXPIRES_IN;
            let token;
            try {
                process.env.JWT_EXPIRES_IN = "2s";
                token = generateToken(user);
            } finally {
                if (previousExpiry === undefined) delete process.env.JWT_EXPIRES_IN;
                else process.env.JWT_EXPIRES_IN = previousExpiry;
            }
            const socket = await connectSocket(token);
            await waitForDisconnect(socket);
            assert.equal((await api("/auth/me", { token })).status, 401);
            await assert.rejects(connectSocket(token), /Unauthorized/);
        });
        await t.test("reset scaduto e risposta uniforme per email sconosciuta", async () => {
            const token = randomBytes(32).toString("hex");
            const hash = createHash("sha256").update(token).digest("hex");
            await User.update({ resetToken: hash, resetTokenExpires: new Date(Date.now() - 1000) }, { where: { id: accounts.member.user.id } });
            assert.equal((await api("/auth/reset-password", { method: "POST", body: { token, newPassword: "Changed2026!" } })).status, 400);
            const response = await api("/auth/forgot-password", { method: "POST", body: { email: "missing@example.com" } });
            assert.equal(response.status, 200);
            assert.equal(response.body.message, "Se l'email è registrata, riceverai le istruzioni per il reset");
        });
        await t.test("reset: hash nel DB, uso singolo concorrente e revoca sessioni", async () => {
            const socket = await connectSocket(owner);
            const disconnected = waitForDisconnect(socket);
            let resetToken;
            const originalLog = console.log;
            console.log = (...args) => {
                const line = args.join(" ");
                if (line.startsWith("[EMAIL SIMULATA]")) resetToken = line.split("token: ")[1];
            };
            let response;
            try { response = await api("/auth/forgot-password", { method: "POST", body: { email: "owner@example.com" } }); }
            finally { console.log = originalLog; }
            assert.equal(response.status, 200);
            assert.match(resetToken, /^[a-f0-9]{64}$/);
            const stored = await User.unscoped().findByPk(accounts.owner.user.id);
            assert.notEqual(stored.resetToken, resetToken);
            assert.equal(stored.resetToken, createHash("sha256").update(resetToken).digest("hex"));
            const reset = () => api("/auth/reset-password", { method: "POST", body: { token: resetToken, newPassword: "Changed2026!" } });
            const results = await Promise.all([reset(), reset()]);
            assert.deepEqual(results.map(result => result.status).sort(), [200, 400]);
            await disconnected;
            await assert.rejects(connectSocket(owner), /Unauthorized/);
            assert.equal((await api("/auth/me", { token: owner })).status, 401);
            assert.equal((await reset()).status, 400);
            assert.equal((await api("/auth/login", { method: "POST", body: { email: "owner@example.com", password } })).status, 401);
            assert.equal((await api("/auth/login", { method: "POST", body: { email: "owner@example.com", password: "Changed2026!" } })).status, 200);
            await stored.reload();
            assert.equal(stored.resetToken, null);
            assert.equal(stored.tokenVersion, 1, "Il reset incrementa il contatore una sola volta");
            assert.equal(verifyToken(owner).tokenVersion, 0, "La firma del vecchio JWT è valida, ma la versione è superata");
            const freshToken = generateToken(stored);
            assert.equal(verifyToken(freshToken).tokenVersion, 1);
            assert.equal((await api("/auth/me", { token: freshToken })).status, 200);
        });
        await t.test("blocchi e logout invalidano le richieste successive", async () => {
            assert.equal((await api(`/admin/users/${accounts.outsider.user.id}/block`, { method: "PATCH", token: accounts.admin.token, body: { blocked: true } })).status, 200);
            assert.equal((await api("/auth/me", { token: outsider })).status, 403);
            const socket = await connectSocket(member);
            const disconnected = waitForDisconnect(socket);
            assert.equal((await api("/auth/logout", { method: "POST", token: member })).status, 200);
            await disconnected;
            assert.equal((await api("/auth/me", { token: member })).status, 401);
            await assert.rejects(connectSocket(member), /Unauthorized/);
        });
    } finally {
        if (io) await new Promise(resolve => io.close(resolve));
        else if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
        if (db) await db.close();
        // Solo il database casuale creato da questa esecuzione può essere eliminato.
        assert.match(database, /^taskflow_test_[a-f0-9]{16}$/);
        await admin.query(`DROP DATABASE IF EXISTS \`${database}\``);
        await admin.end();
    }
});
