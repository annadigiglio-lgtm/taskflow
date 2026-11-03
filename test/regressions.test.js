import test from "node:test";
import assert from "node:assert/strict";
import { isValidDateOnly } from "../src/utils/date.js";
import { createTask } from "../src/controllers/taskController.js";
import { createProject, listPublicProjects } from "../src/controllers/projectController.js";
import sequelize from "../src/config/db.js";
import { Project } from "../src/models/index.js";
import { generateToken, verifyToken, revokedTokens } from "../src/utils/jwt.js";

test("sessioni: due login hanno token distinti e revoche indipendenti", () => {
    const first = generateToken({ id: 1, role: "user" });
    const second = generateToken({ id: 1, role: "user" });
    assert.notEqual(first, second);
    revokedTokens.add(first);
    try {
        assert.throws(() => verifyToken(first), /revocato/);
        assert.equal(verifyToken(second).id, 1);
    } finally {
        revokedTokens.delete(first);
    }
});

test("date: anni bisestili, giorni impossibili e tipi non validi", () => {
    for (const value of ["2024-02-29", "2026-12-31"]) assert.equal(isValidDateOnly(value), true);
    for (const value of ["2026-02-29", "2026-04-31", "2026-13-01", "2026-1-01", null, {}, ["2026-01-01"]]) {
        assert.equal(isValidDateOnly(value), false);
    }
});

test("task: rifiuta una scadenza impossibile prima di interrogare il database", async () => {
    let error;
    await createTask({ body: { dueDate: "2026-02-30" } }, {}, err => { error = err; });
    assert.equal(error.status, 400);
});

test("catalogo: rifiuta date impossibili, parametri ripetuti e intervalli invertiti", async () => {
    for (const query of [{ from: "2026-02-30" }, { to: ["2026-01-01"] }, { from: "2026-12-01", to: "2026-01-01" }]) {
        let error;
        await listPublicProjects({ query }, {}, err => { error = err; });
        assert.equal(error.status, 400);
    }
});

test("creazione progetto: usa la stessa transazione per progetto e proprietario", async t => {
    const transaction = {};
    const failure = new Error("membership failed");
    t.mock.method(sequelize, "transaction", async callback => callback(transaction));
    t.mock.method(Project, "create", async (data, options) => {
        assert.equal(options.transaction, transaction);
        assert.equal(data.ownerId, 7);
        return { addMember: async (user, options) => {
            assert.equal(user.id, 7);
            assert.equal(options.transaction, transaction);
            throw failure;
        } };
    });
    let error;
    await createProject({ body: { title: "Test" }, user: { id: 7 } }, {}, err => { error = err; });
    assert.equal(error, failure);
});
