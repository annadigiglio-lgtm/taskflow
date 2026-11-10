import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, basename, dirname } from "node:path";
import { once } from "node:events";
import assert from "node:assert/strict";

// Browser reale via Chrome DevTools Protocol, senza dipendenze aggiuntive.
export async function checkBrowser(base, token, test, getResetToken) {
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
        await evaluate("document.querySelector('#editProjectButton').click()");
        assert.equal(await evaluate("document.querySelector('#editProjectForm [name=title]').value"), "Browser project");
        await evaluate("document.querySelector('#editProjectForm [name=title]').value='Progetto modificato dal browser'; document.querySelector('#editProjectForm').requestSubmit()");
        await wait("state.project?.title === 'Progetto modificato dal browser' && !document.querySelector('#editProjectDialog').open");
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
        await evaluate("document.querySelector('[data-action=edit-task]').click()");
        assert.equal(await evaluate("document.querySelector('#editTaskForm [name=title]').value"), "Overdue browser task");
        await evaluate("document.querySelector('#editTaskForm [name=title]').value='Attività aggiornata'; document.querySelector('#editTaskForm [name=dueDate]').value=''; document.querySelector('#editTaskForm').requestSubmit()");
        await wait("state.board.todo[0]?.title === 'Attività aggiornata' && !document.querySelector('#editTaskDialog').open");
        assert.equal(await evaluate("state.board.todo[0].dueDate"), null, "La scadenza può essere rimossa");
        assert.equal(await evaluate("document.querySelectorAll('.task-card.overdue').length"), 0);

        const memberEmail = `browser-member-${Date.now()}@example.test`;
        await evaluate(`api('/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Membro browser', email: ${JSON.stringify(memberEmail)}, password: 'TaskFlow2026!' }) })`);
        await evaluate("document.querySelector('#inviteButton').click()");
        await evaluate(`document.querySelector('#inviteForm [name=email]').value=${JSON.stringify(memberEmail)}; document.querySelector('#inviteForm').requestSubmit()`);
        await wait("state.project.members.length === 2 && !document.querySelector('#inviteDialog').open");
        await evaluate("document.querySelector('#membersButton').click()");
        assert.equal(await evaluate("document.querySelectorAll('#membersList [data-remove-member]').length"), 1, "Il proprietario non ha un pulsante di rimozione");
        await evaluate("document.querySelector('[data-remove-member]').click()");
        await sleep(100);
        assert.equal(await evaluate("state.project.members.length"), 2, "Annullare conserva il membro");
        await evaluate("window.confirm = () => true; document.querySelector('[data-remove-member]').click()");
        await wait("state.project.members.length === 1 && document.querySelectorAll('#membersList [data-remove-member]').length === 0");
        await evaluate("document.querySelector('#membersDialog [data-close-dialog]').click(); document.querySelector('#reportButton').click()");
        await evaluate("document.querySelector('#reportForm [name=reason]').value='Segnalazione di prova dal browser'; document.querySelector('#reportForm').requestSubmit()");
        await wait("!document.querySelector('#reportDialog').open && document.querySelector('#reportForm [name=reason]').value === ''");
        await evaluate("document.querySelector('[data-project-tab=chat]').click()");
        await evaluate("document.querySelector('#messageInput').value='Message from browser'; document.querySelector('#messageForm').requestSubmit()");
        await wait("state.messages.some(message => message.content === 'Message from browser')");
        assert.equal(await evaluate("state.messages.filter(message => message.content === 'Message from browser').length"), 1, "REST e socket non duplicano il messaggio");
        const projectId = await evaluate("state.project.id");
        // Un membro assegna un'attività al proprietario: la notifica arriva dal server.
        const memberLogin = await evaluate(`api('/auth/login', { method: 'POST', body: JSON.stringify({ email: ${JSON.stringify(memberEmail)}, password: 'TaskFlow2026!' }) })`);
        await evaluate(`api('/projects/${projectId}/members', { method: 'POST', body: JSON.stringify({ email: ${JSON.stringify(memberEmail)} }) })`);
        await wait("state.socket?.connected");
        await evaluate(`fetch('/api/projects/${projectId}/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ${JSON.stringify(memberLogin.token)} }, body: JSON.stringify({ title: '<img src=x> Notifica browser', assigneeId: state.user.id }) }).then(response => { if (!response.ok) throw new Error('Creazione task per notifica fallita'); })`);
        await wait("state.notifications.some(item => item.message.includes('Notifica browser')) && !document.querySelector('#notificationDot').classList.contains('hidden')");
        await evaluate("location.reload()");
        await wait("state.dashboard && state.notifications.some(item => item.message.includes('Notifica browser'))");
        await evaluate("document.querySelector('#notificationButton').click()");
        assert.equal(await evaluate("document.querySelectorAll('#notificationsList img').length"), 0, "Le notifiche mostrano testo, senza interpretare HTML");
        assert.equal(await evaluate("state.notifications.every(item => item.read)"), true);
        assert.equal(await evaluate("document.querySelector('#notificationDot').classList.contains('hidden')"), true);
        await evaluate("document.querySelector('#notificationsDialog [data-close-dialog]').click()");

        // Filtri combinati e intervalli di date errati.
        await evaluate(`api('/projects/${projectId}', { method: 'PUT', body: JSON.stringify({ visibility: 'public', category: 'BrowserFilter', technologies: ['node'] }) })`);
        await evaluate("document.querySelector('[data-view=explore]').click()");
        await evaluate("document.querySelector('#catalogCategoryFilter').value='BrowserFilter'; document.querySelector('#catalogTechnologyFilter').value='node'; document.querySelector('#catalogFromFilter').value='2020-01-01'; document.querySelector('#catalogToFilter').value='2099-12-31'; document.querySelector('#catalogFilters').requestSubmit()");
        await wait("state.catalog.length === 1 && state.catalog[0].category === 'BrowserFilter'");
        await evaluate("document.querySelector('#catalogTechnologyFilter').value='not-present'; document.querySelector('#catalogFilters').requestSubmit()");
        await wait("state.catalog.length === 0 && document.querySelector('#catalogGrid').textContent.includes('Nessun progetto')");
        await evaluate("document.querySelector('#catalogFromFilter').value='2099-12-31'; document.querySelector('#catalogToFilter').value='2020-01-01'; document.querySelector('#catalogFilters').requestSubmit()");
        await wait("document.querySelector('#catalogError').textContent.includes('data iniziale')");
        assert.equal(await evaluate("document.querySelector('#catalogNext').disabled"), true);
        await evaluate("document.querySelector('#catalogFilters button[type=reset]').click()");
        await wait("document.querySelector('#catalogError').textContent === '' && state.catalog.some(project => project.id === " + projectId + ")");
        assert.equal(await evaluate("document.querySelector('#catalogTechnologyFilter').value"), "");

        await evaluate(`openProject(${projectId})`);
        await evaluate(`api('/projects/${projectId}', { method: 'DELETE' })`);
        await wait("state.project === null && state.activeView === 'dashboard'");

        // Recupero password su un account di prova separato dagli altri test API.
        await evaluate("signOut(false); document.querySelector('#forgotPasswordButton').click()");
        await evaluate(`document.querySelector('#forgotPasswordForm [name=email]').value=${JSON.stringify(memberEmail)}; document.querySelector('#forgotPasswordForm').requestSubmit()`);
        await wait("document.querySelector('#recoveryMessage').textContent.includes('Se l')");
        const resetToken = getResetToken();
        assert.match(resetToken, /^[a-f0-9]{64}$/);
        await evaluate(`document.querySelector('#resetPasswordForm [name=token]').value=${JSON.stringify(resetToken)}; document.querySelector('#resetPasswordForm [name=newPassword]').value='BrowserChanged2026!'; document.querySelector('#resetPasswordForm [name=confirmPassword]').value='Different2026!'; document.querySelector('#resetPasswordForm').requestSubmit()`);
        await wait("document.querySelector('#resetPasswordError').textContent.includes('non coincidono')");
        await evaluate("document.querySelector('#resetPasswordForm [name=confirmPassword]').value='BrowserChanged2026!'; document.querySelector('#resetPasswordForm [name=token]').value='a'.repeat(64); document.querySelector('#resetPasswordForm').requestSubmit()");
        await wait("document.querySelector('#resetPasswordError').textContent.includes('non valido')");
        await evaluate(`document.querySelector('#resetPasswordForm [name=token]').value=${JSON.stringify(resetToken)}; document.querySelector('#resetPasswordForm').requestSubmit()`);
        await wait("!document.querySelector('#recoveryDialog').open");
        await evaluate(`document.querySelector('#authEmail').value=${JSON.stringify(memberEmail)}; document.querySelector('#authPassword').value='BrowserChanged2026!'; document.querySelector('#authForm').requestSubmit()`);
        await wait("state.user && state.dashboard");
        assert.equal(await evaluate("state.notifications.length"), 0, "Un altro account non vede lo storico del proprietario");
        await evaluate(`signOut(false); localStorage.setItem('taskflowToken', ${JSON.stringify(token)}); location.reload()`);
        await wait("state.user && state.dashboard && state.notifications.some(item => item.message.includes('Notifica browser'))");
        await evaluate("document.querySelector('#notificationButton').click(); document.querySelector('#clearNotifications').click()");
        assert.equal(await evaluate("state.notifications.length"), 0);
        assert.equal(await evaluate("JSON.parse(localStorage.getItem('taskflowNotifications:' + state.user.id)).length"), 0);
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
