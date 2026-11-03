import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, basename, dirname } from "node:path";
import { once } from "node:events";
import assert from "node:assert/strict";

// Browser reale via Chrome DevTools Protocol, senza dipendenze aggiuntive.
export async function checkBrowser(base, token, test) {
    const executable = [process.env.TEST_BROWSER_PATH, "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find(path => path && existsSync(path));
    if (!executable) { test.skip("Chrome/Edge non disponibile; impostare TEST_BROWSER_PATH"); return; }
    const profile = await mkdtemp(join(tmpdir(), "taskflow-browser-"));
    const browserProcess = spawn(executable, ["--headless", "--disable-gpu", "--no-first-run", "--disable-background-networking", "--disable-extensions", "--no-proxy-server", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--window-size=1440,1000", "about:blank"], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    let diagnostics = "";
    browserProcess.stderr.on("data", data => { diagnostics = (diagnostics + data).slice(-4000); });
    let socket;
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    try {
        let port;
        for (let i = 0; i < 100; i++) {
            try { port = Number((await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]); break; }
            catch { await sleep(100); }
        }
        assert.ok(port, "Il browser deve avviare DevTools");
        const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        socket = new WebSocket(targets.find(target => target.type === "page").webSocketDebuggerUrl);
        await once(socket, "open");
        let sequence = 0;
        const pending = new Map(), errors = [];
        socket.addEventListener("message", event => {
            const message = JSON.parse(event.data);
            if (message.id) {
                const request = pending.get(message.id);
                if (!request) return;
                clearTimeout(request.timer); pending.delete(message.id);
                if (message.error) request.reject(new Error(JSON.stringify(message.error))); else request.resolve(message.result);
            }
            if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
            if (message.method === "Page.javascriptDialogOpening") {
                send("Page.handleJavaScriptDialog", { accept: false }).catch(() => {});
            }
        });
        function send(method, params = {}) {
            return new Promise((resolve, reject) => {
                const id = ++sequence;
                const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)); }, 10000);
                pending.set(id, { resolve, reject, timer });
                socket.send(JSON.stringify({ id, method, params }));
            });
        }
        async function evaluate(expression) {
            const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true });
            if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
            return result.result.value;
        }
        async function wait(condition) {
            for (let i = 0; i < 100; i++) {
                if (await evaluate(`(() => { try { return Boolean(${condition}); } catch { return false; } })()`)) return;
                await sleep(100);
            }
            throw new Error(`Condizione UI non raggiunta: ${condition}`);
        }
        await send("Runtime.enable");
        await send("Page.enable");
        await send("Page.navigate", { url: base });
        await wait("document.querySelector('#authForm') && typeof state !== 'undefined'");
        await evaluate(`localStorage.setItem('taskflowToken', ${JSON.stringify(token)}); location.reload()`);
        await wait("state.user && state.dashboard && !document.querySelector('#appView').classList.contains('hidden')");
        await evaluate("document.querySelector('#createProjectButton').click()");
        await evaluate("document.querySelector('#projectForm [name=title]').value='Browser project'; document.querySelector('#projectForm').requestSubmit()");
        await wait("state.project?.title === 'Browser project' && !document.querySelector('#projectDialog').open");
        await evaluate("document.querySelector('#createTaskButton').click()");
        await evaluate("document.querySelector('#taskForm [name=title]').value='Overdue browser task'; document.querySelector('#taskForm [name=dueDate]').value='2020-01-01'; document.querySelector('#taskForm [name=priority]').value='high'; document.querySelector('#taskForm').requestSubmit()");
        await wait("document.querySelector('.task-card.overdue') && !document.querySelector('#taskDialog').open");
        await evaluate("document.querySelector('#boardPriority').value='low'; document.querySelector('#boardPriority').dispatchEvent(new Event('input'))");
        assert.equal(await evaluate("document.querySelectorAll('.task-card').length"), 0);
        await evaluate("document.querySelector('#boardPriority').value='high'; document.querySelector('#boardPriority').dispatchEvent(new Event('input'))");
        assert.equal(await evaluate("document.querySelectorAll('.task-card').length"), 1);
        await evaluate("document.querySelector('[data-action=delete-task]').click()");
        await sleep(100);
        assert.equal(await evaluate("state.board.todo.length"), 1, "Annullare la conferma conserva il task");
        await evaluate("document.querySelector('[data-project-tab=chat]').click()");
        await evaluate("document.querySelector('#messageInput').value='Message from browser'; document.querySelector('#messageForm').requestSubmit()");
        await wait("state.messages.some(message => message.content === 'Message from browser')");
        assert.equal(await evaluate("state.messages.filter(message => message.content === 'Message from browser').length"), 1, "REST e socket non duplicano il messaggio");
        const projectId = await evaluate("state.project.id");
        await evaluate(`api('/projects/${projectId}', { method: 'DELETE' })`);
        await wait("state.project === null && state.activeView === 'dashboard'");
        assert.deepEqual(errors, [], "Nessun errore JavaScript nel browser");
    } catch (err) {
        err.message += `\nBrowser diagnostics: ${diagnostics}`;
        throw err;
    } finally {
        if (socket) socket.close();
        if (browserProcess.exitCode === null) {
            const exited = once(browserProcess, "exit"); browserProcess.kill(); await exited;
        }
        // Il profilo cancellato deve essere esattamente quello temporaneo appena creato.
        const target = resolve(profile);
        assert.equal(dirname(target), resolve(tmpdir()));
        assert.ok(basename(target).startsWith("taskflow-browser-"));
        await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
}
