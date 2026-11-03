// Client TaskFlow: usa le API REST per le azioni e Socket.io per gli aggiornamenti live.
const state = {
    token: localStorage.getItem("taskflowToken"),
    user: null,
    dashboard: null,
    project: null,
    board: { todo: [], in_progress: [], done: [] },
    messages: [],
    socket: null,
    authMode: "login",
    activeView: "dashboard",
    catalog: [],
    adminUsers: [],
    adminReports: [],
    catalogPage: 1, userPage: 1, reportPage: 1, dashboardPage: 1, messageBefore: null, messageLoading: false
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const columnInfo = [
    { key: "todo", label: "Da fare", dot: "" },
    { key: "in_progress", label: "In corso", dot: "progress" },
    { key: "done", label: "Completato", dot: "done" }
];

function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
}

function initials(value = "?") {
    return String(value).trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase() || "?";
}

function formatDate(value, options = { day: "numeric", month: "short" }) {
    if (!value) return "Senza scadenza";
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    return Number.isNaN(date.getTime()) ? "Data da definire" : new Intl.DateTimeFormat("it-IT", options).format(date);
}

function formatDateTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }).format(date);
}

function showToast(message, kind = "success") {
    const toast = document.createElement("div");
    toast.className = `toast ${kind}`;
    toast.textContent = message;
    $("#toastRegion").append(toast);
    window.setTimeout(() => toast.remove(), 3600);
}

async function api(path, options = {}) {
    const headers = { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) };
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    const response = await fetch(`/api${path}`, { ...options, headers });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }

    if (!response.ok) {
        if (response.status === 401 && state.token) signOut(false);
        throw new Error(data?.error || `Richiesta non riuscita (${response.status})`);
    }
    if (Array.isArray(data)) Object.defineProperty(data, "pagination", { value: {
        page: Number(response.headers.get("X-Page") || 1),
        total: Number(response.headers.get("X-Total-Count") || data.length),
        hasMore: response.headers.get("X-Has-More") === "true",
        before: response.headers.get("X-Before"),
        blocked: Number(response.headers.get("X-Blocked-Count") || 0)
    } });
    return data;
}

function setAuthMode(mode) {
    state.authMode = mode;
    const isRegister = mode === "register";
    $("#nameField").classList.toggle("hidden", !isRegister);
    $("#authName").required = isRegister;
    $("#authPassword").autocomplete = isRegister ? "new-password" : "current-password";
    $("#authEyebrow").textContent = isRegister ? "UN PIACERE CONOSCERTI" : "BENTORNATA";
    $("#authTitle").textContent = isRegister ? "Crea il tuo account" : "Accedi al tuo spazio";
    $("#authSubtitle").textContent = isRegister ? "Comincia a organizzare il lavoro con il tuo team." : "Riprendi da dove il tuo team ha lasciato.";
    $("#authSubmitText").textContent = isRegister ? "Crea account" : "Accedi";
    $("#authSwitchLabel").textContent = isRegister ? "Hai già un account?" : "È la prima volta qui?";
    $("#authSwitch").textContent = isRegister ? "Accedi" : "Crea un account";
}

function showAuth() {
    $("#authView").classList.remove("hidden");
    $("#appView").classList.add("hidden");
}

function showApp() {
    $("#authView").classList.add("hidden");
    $("#appView").classList.remove("hidden");
    $("#userName").textContent = state.user.name;
    $("#userEmail").textContent = state.user.email;
    $("#userAvatar").textContent = initials(state.user.name);
    $("#topAvatar").textContent = initials(state.user.name);
    $("#adminNav").classList.toggle("hidden", state.user.role !== "admin");
    $("#appView").classList.toggle("is-admin", state.user.role === "admin");
    $("#todayLabel").textContent = new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short" }).format(new Date());
    const firstName = state.user.name.trim().split(/\s+/)[0];
    $("#welcomeTitle").innerHTML = `Ciao, ${escapeHTML(firstName)} <span class="wave">✳</span>`;
}

async function handleAuth(event) {
    event.preventDefault();
    const button = $("#authForm button[type=submit]");
    button.disabled = true;
    $("#authSubmitText").textContent = "Un momento…";
    const body = {
        email: $("#authEmail").value.trim(),
        password: $("#authPassword").value
    };
    if (state.authMode === "register") body.name = $("#authName").value.trim();

    try {
        if (state.authMode === "register") {
            await api("/auth/register", { method: "POST", body: JSON.stringify(body) });
            showToast("Account creato. Ora puoi accedere.");
            setAuthMode("login");
            $("#authPassword").value = "";
        } else {
            const result = await api("/auth/login", { method: "POST", body: JSON.stringify(body) });
            state.token = result.token;
            state.user = result.user;
            localStorage.setItem("taskflowToken", state.token);
            showApp();
            connectSocket();
            await loadDashboard();
        }
    } catch (error) {
        showToast(error.message, "error");
    } finally {
        button.disabled = false;
        $("#authSubmitText").textContent = state.authMode === "register" ? "Crea account" : "Accedi";
    }
}

function signOut(callApi = true) {
    if (callApi && state.token) api("/auth/logout", { method: "POST" }).catch(() => {});
    if (state.socket) state.socket.disconnect();
    state.socket = null;
    state.token = null;
    state.user = null;
    state.project = null;
    state.dashboard = null;
    state.messages = [];
    state.messageBefore = null;
    state.messageLoading = false;
    state.catalogPage = state.userPage = state.reportPage = 1;
    localStorage.removeItem("taskflowToken");
    showAuth();
}

function connectSocket() {
    if (state.socket) state.socket.disconnect();
    state.socket = io({ auth: { token: state.token } });

    state.socket.on("connect", () => {
        setLiveStatus(true, "Connesso in tempo reale");
        if (state.project && isProjectMember()) state.socket.emit("joinProject", state.project.id);
    });
    state.socket.on("disconnect", () => setLiveStatus(false, "Connessione interrotta"));
    state.socket.on("connect_error", (error) => {
        setLiveStatus(false, "Connessione non disponibile");
        if (error.message) console.info("Socket.io:", error.message);
    });
    state.socket.on("notification", (data) => {
        $("#notificationDot").classList.remove("hidden");
        showToast(data.message || "Hai una nuova notifica.");
    });
    state.socket.on("joinedProject", () => setLiveStatus(true, "Aggiornamenti live attivi"));
    state.socket.on("errorMessage", (message) => showToast(message, "error"));
    const refreshTasks = async () => {
        await refreshCurrentProject();
        await loadDashboard();
    };
    state.socket.on("taskCreated", refreshTasks);
    state.socket.on("taskUpdated", refreshTasks);
    state.socket.on("taskDeleted", refreshTasks);
    state.socket.on("memberJoined", async (data) => {
        showToast(`${data.user?.name || "Un nuovo membro"} è nel progetto.`);
        await refreshCurrentProject();
    });
    state.socket.on("memberLeft", refreshCurrentProject);
    state.socket.on("projectUpdated", async ({ projectId }) => {
        await loadDashboard();
        if (state.project?.id === projectId) await refreshCurrentProject();
    });
    state.socket.on("projectDeleted", async ({ projectId }) => {
        if (state.project?.id === projectId) {
            state.project = null;
            state.board = { todo: [], in_progress: [], done: [] };
            state.messages = [];
            setView("dashboard");
            showToast("Il progetto \u00e8 stato eliminato.");
        }
        await loadDashboard();
    });
    state.socket.on("catalogChanged", () => { if (state.activeView === "explore") loadCatalog(); });
    state.socket.on("chatMessage", (message) => {
        if (state.project?.id === message.projectId && isProjectMember()) mergeMessages([message]);
    });
    state.socket.on("newReport", (data) => showToast(`Nuova segnalazione: ${data.projectTitle}`));
}

function setLiveStatus(connected, text) {
    const status = $("#liveStatus");
    status.classList.toggle("connected", connected);
    status.lastChild.textContent = ` ${text}`;
}

function allProjects() {
    return [...(state.dashboard?.ownedProjects || []), ...(state.dashboard?.memberProjects || [])];
}

async function loadDashboard(append = false) {
    const page = append ? state.dashboardPage + 1 : 1;
    const token = state.token;
    const data = await api(`/dashboard?page=${page}`);
    if (!state.token || token !== state.token) return;
    if (append && state.dashboard) {
        for (const key of ["ownedProjects", "memberProjects", "assignedTasks"]) {
            data[key] = [...new Map([...state.dashboard[key], ...data[key]].map(item => [item.id, item])).values()];
        }
    }
    state.dashboardPage = page;
    state.dashboard = data;
    $("#dashboardMore").classList.toggle("hidden", !data.pagination.hasMore);
    renderDashboard();
    renderSidebarProjects();
}

function projectCard(project, index = 0) {
    const category = project.category || "Progetto";
    const description = project.description || "Uno spazio per le idee e il lavoro del team.";
    const tech = Array.isArray(project.technologies) ? project.technologies : [];
    return `<article class="project-card" data-project-id="${Number(project.id)}" tabindex="0" role="button" aria-label="Apri ${escapeHTML(project.title)}">
        <div class="project-card-top"><span class="project-card-icon p${index % 4}">${escapeHTML(initials(project.title).slice(0, 1))}</span><span class="category-pill">${escapeHTML(category)}</span></div>
        <h3>${escapeHTML(project.title)}</h3><p>${escapeHTML(description)}</p>
        <div class="project-card-foot"><span>${tech.length ? escapeHTML(tech.slice(0, 2).join(" · ")) : (project.status === "archived" ? "Archiviato" : "Spazio condiviso")}</span><span class="card-arrow">↗</span></div>
    </article>`;
}

function renderDashboard() {
    const projects = allProjects();
    const tasks = state.dashboard?.assignedTasks || [];
    const openTasks = tasks.filter((task) => task.status !== "done");
    $("#statProjects").textContent = state.dashboard?.totals?.activeProjects ?? projects.filter((project) => project.status !== "archived").length;
    $("#statTasks").textContent = state.dashboard?.totals?.assignedTasks ?? tasks.length;
    $("#statDue").textContent = state.dashboard?.totals?.openTasks ?? openTasks.length;

    $("#projectGrid").innerHTML = projects.length
        ? projects.map(projectCard).join("")
        : `<div class="empty-state"><span class="empty-illustration">✳</span><h3>Qui nascerà il tuo prossimo progetto</h3><p>Crea uno spazio di lavoro e invita il tuo team a collaborare.</p><button class="button button-primary" data-action="create-project">＋ Crea il primo progetto</button></div>`;

    $("#assignedTasks").innerHTML = tasks.length
        ? tasks.map((task) => `<div class="assigned-row"><span class="assigned-title">${escapeHTML(task.title)}</span><span class="assigned-project">${escapeHTML(task.Project?.title || "Progetto")}</span><span class="priority-label ${escapeHTML(task.priority || "medium")}"><i></i>${escapeHTML(priorityLabel(task.priority))}</span><span class="due-label">${escapeHTML(formatDate(task.dueDate))}</span></div>`).join("")
        : `<div class="no-assigned">Non hai task assegnati per ora. Le attività assegnate a te compariranno qui.</div>`;
}

function renderSidebarProjects() {
    const projects = allProjects().slice(0, 7);
    $("#sidebarProjects").innerHTML = projects.length
        ? projects.map((project, index) => `<button class="sidebar-project" data-project-id="${Number(project.id)}"><i class="project-swatch swatch-${index % 4}"></i><span>${escapeHTML(project.title)}</span></button>`).join("")
        : `<p class="no-sidebar-projects">I tuoi progetti appariranno qui.</p>`;
}

function setView(view) {
    state.activeView = view;
    $("#dashboardView").classList.toggle("hidden", view !== "dashboard");
    $("#exploreView").classList.toggle("hidden", view !== "explore");
    $("#projectView").classList.toggle("hidden", view !== "project");
    $("#adminView").classList.toggle("hidden", view !== "admin");
    $$(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
    $("#breadcrumbCurrent").textContent = view === "dashboard" ? "Panoramica" : view === "explore" ? "Esplora progetti" : view === "admin" ? "Amministrazione" : (state.project?.title || "Progetto");
}

async function loadAdmin() {
    if (state.user?.role !== "admin") return;
    try {
        const [users, reports] = await Promise.all([
            api(`/admin/users?page=${state.userPage}`),
            api(`/admin/reports?status=open&page=${state.reportPage}`)
        ]);
        state.adminUsers = users;
        state.adminReports = reports;
        renderAdmin();
    } catch (error) { showToast(error.message, "error"); }
}

function renderAdmin() {
    const users = state.adminUsers;
    const reports = state.adminReports;
    renderPager("user", users.pagination);
    renderPager("report", reports.pagination);
    $("#adminUserCount").textContent = users.pagination.total;
    $("#adminReportCount").textContent = reports.pagination.total;
    $("#adminBlockedCount").textContent = users.pagination.blocked;
    $("#adminUsersList").innerHTML = users.length ? users.map((user) => `<div class="admin-row"><span class="avatar">${escapeHTML(initials(user.name))}</span><span class="admin-user-copy"><strong>${escapeHTML(user.name)}</strong><small>${escapeHTML(user.email)}</small></span><span class="admin-role ${user.isBlocked ? "blocked" : ""}">${user.isBlocked ? "Bloccato" : escapeHTML(user.role)}</span>${user.role === "admin" ? "" : `<button class="button ${user.isBlocked ? "button-soft" : "button-primary"}" data-admin-action="block-user" data-user-id="${Number(user.id)}" data-blocked="${!user.isBlocked}">${user.isBlocked ? "Sblocca" : "Blocca"}</button>`}</div>`).join("") : `<div class="admin-empty">Non ci sono utenti da mostrare.</div>`;
    $("#adminReportsList").innerHTML = reports.length ? reports.map((report) => `<div class="admin-row"><span class="stat-icon icon-peach">⚑</span><span class="report-copy"><strong>${escapeHTML(report.Project?.title || "Progetto rimosso")}</strong><p>${escapeHTML(report.reason)}</p><small>Segnalato da ${escapeHTML(report.reporter?.name || "Utente")} · ${escapeHTML(formatDate(report.createdAt, { day: "numeric", month: "short", year: "numeric" }))}</small></span>${report.Project?.id ? `<button class="button button-soft" data-admin-action="hide-project" data-project-id="${Number(report.Project.id)}" data-hidden="${!report.Project.isHidden}">${report.Project.isHidden ? "Mostra" : "Nascondi"}</button>` : ""}<button class="button button-primary" data-admin-action="resolve-report" data-report-id="${Number(report.id)}">Risolvi</button></div>`).join("") : `<div class="admin-empty">Nessuna segnalazione aperta. La community è in buone mani.</div>`;
}

async function handleAdminAction(event) {
    const button = event.target.closest("[data-admin-action]");
    if (!button) return;
    button.disabled = true;
    try {
        if (button.dataset.adminAction === "block-user") {
            await api(`/admin/users/${Number(button.dataset.userId)}/block`, { method: "PATCH", body: JSON.stringify({ blocked: button.dataset.blocked === "true" }) });
            showToast(button.dataset.blocked === "true" ? "Account bloccato." : "Account sbloccato.");
        } else if (button.dataset.adminAction === "hide-project") {
            await api(`/admin/projects/${Number(button.dataset.projectId)}/hide`, { method: "PATCH", body: JSON.stringify({ hidden: button.dataset.hidden === "true" }) });
            showToast(button.dataset.hidden === "true" ? "Progetto nascosto dal catalogo." : "Progetto di nuovo visibile.");
        } else if (button.dataset.adminAction === "resolve-report") {
            await api(`/admin/reports/${Number(button.dataset.reportId)}/resolve`, { method: "PATCH", body: JSON.stringify({}) });
            showToast("Segnalazione risolta.");
        }
        await loadAdmin();
    } catch (error) { showToast(error.message, "error"); }
    finally { button.disabled = false; }
}

let catalogRequest = 0;
async function loadCatalog() {
    const request = ++catalogRequest;
    try {
        const query = new URLSearchParams({ page: state.catalogPage, q: $("#catalogSearch").value.trim() });
        const category = $("#catalogCategoryFilter").value.trim();
        if (category) query.set("category", category);
        const projects = await api(`/projects/public?${query}`);
        if (request !== catalogRequest) return;
        state.catalog = projects;
        renderPager("catalog", projects.pagination);
        $("#catalogGrid").innerHTML = projects.length ? projects.map(projectCard).join("")
            : `<div class="empty-state"><h3>Nessun progetto trovato</h3><p>Prova un'altra ricerca.</p></div>`;
    } catch (error) { showToast(error.message, "error"); }
}

function renderPager(name, pagination) {
    $(`#${name}Page`).textContent = `Pagina ${pagination.page} / ${pagination.total} risultati`;
    $(`#${name}Prev`).disabled = pagination.page <= 1;
    $(`#${name}Next`).disabled = !pagination.hasMore;
}

function isProjectMember() {
    return state.project && (state.project.ownerId === state.user.id || state.project.members?.some((member) => member.id === state.user.id));
}

function isProjectOwner() {
    return state.project && state.project.ownerId === state.user.id;
}

async function openProject(projectId) {
    try {
        const project = await api(`/projects/${Number(projectId)}`);
        if (state.project && state.project.id !== project.id) state.socket?.emit("leaveProject", state.project.id);
        state.project = project;
        for (const id of ["boardSearch", "boardAssignee", "boardPriority", "boardDue"]) $("#" + id).value = "";
        state.messageBefore = null;
        state.messageLoading = false;
        $("#olderMessages").classList.add("hidden");
        state.board = { todo: [], in_progress: [], done: [] };
        state.messages = [];
        setView("project");
        renderProjectHeader();
        if (isProjectMember()) {
            if (state.socket?.connected) state.socket.emit("joinProject", project.id);
            await Promise.all([loadBoard(), loadMessages()]);
        } else {
            renderBoard();
            $("#messageList").innerHTML = `<div class="no-assigned">La bacheca e la chat sono disponibili solo ai membri del progetto.</div>`;
        }
    } catch (error) { showToast(error.message, "error"); }
}

function renderProjectHeader() {
    const project = state.project;
    $("#breadcrumbCurrent").textContent = project.title;
    $("#projectTitle").textContent = project.title;
    $("#messageForm").classList.toggle("hidden", !isProjectMember());
    $(".board-filters").classList.toggle("hidden", !isProjectMember());
    $("#projectDescription").textContent = project.description || "Nessuna descrizione aggiunta.";
    $("#projectCategory").textContent = `${project.category || "PROGETTO"}${project.status === "archived" ? " / Archiviato" : ""}`;
    $("#projectMemberCount").textContent = `◎ ${project.members?.length || 1} membri`;
    const technologies = Array.isArray(project.technologies) ? project.technologies : [];
    $("#projectTech").textContent = technologies.length ? `⌘ ${technologies.join(" · ")}` : "";
    $("#inviteButton").classList.toggle("hidden", !isProjectOwner());
    $("#archiveButton").classList.toggle("hidden", !isProjectOwner());
    $("#deleteProjectButton").classList.toggle("hidden", !isProjectOwner());
    $("#archiveButton").textContent = project.status === "archived" ? "Riattiva progetto" : "Archivia";
    const filter = $("#boardAssignee");
    const selected = filter.value;
    filter.innerHTML = `<option value="">Tutte le persone</option><option value="none">Non assegnati</option>${(project.members || []).map(member => `<option value="${member.id}">${escapeHTML(member.name)}</option>`).join("")}`;
    filter.value = selected;
    const select = $("#assigneeSelect");
    select.innerHTML = `<option value="">Non assegnato</option>${(project.members || []).map((member) => `<option value="${Number(member.id)}">${escapeHTML(member.name)}</option>`).join("")}`;
}

async function loadBoard() {
    if (!state.project || !isProjectMember()) return;
    try {
        const projectId = state.project.id;
        const board = await api(`/projects/${projectId}/tasks`);
        if (state.project?.id !== projectId) return;
        state.board = board;
        renderBoard();
    } catch (error) { showToast(error.message, "error"); }
}

function priorityLabel(priority) {
    return ({ high: "Alta", medium: "Media", low: "Bassa" })[priority] || "Media";
}

function renderBoard() {
    const allTasks = columnInfo.flatMap((column) => state.board[column.key] || []);
    $("#boardCount").textContent = allTasks.length;
    $("#createTaskButton").classList.toggle("hidden", !isProjectMember());
    $("#boardColumns").innerHTML = columnInfo.map((column) => {
        const tasks = (state.board[column.key] || []).filter(matchesBoardFilters);
        return `<section class="board-column" aria-label="${column.label}"><div class="column-head"><span class="column-title"><i class="column-dot ${column.dot}"></i>${column.label}</span><span class="column-count">${tasks.length}</span></div>
            ${tasks.length ? `<div class="task-stack">${tasks.map(renderTaskCard).join("")}</div>` : `<div class="column-empty">Nessun task qui per ora.</div>`}</section>`;
    }).join("");
}

function localToday() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function isOverdue(task) { return task.status !== "done" && task.dueDate && task.dueDate < localToday(); }
function matchesBoardFilters(task) {
    const query = $("#boardSearch").value.trim().toLowerCase();
    const assignee = $("#boardAssignee").value;
    const priority = $("#boardPriority").value;
    const due = $("#boardDue").value;
    return `${task.title} ${task.description || ""}`.toLowerCase().includes(query)
        && (!assignee || (assignee === "none" ? !task.assigneeId : task.assigneeId === Number(assignee)))
        && (!priority || task.priority === priority)
        && (!due || (due === "overdue" && isOverdue(task)) || (due === "today" && task.dueDate === localToday()) || (due === "none" && !task.dueDate));
}
function renderTaskCard(task) {
    const assignee = task.assignee;
    const canEdit = isProjectMember();
    const statusOptions = columnInfo.map((column) => `<option value="${column.key}" ${task.status === column.key ? "selected" : ""}>${column.label}</option>`).join("");
    const memberOptions = (state.project.members || []).map((member) => `<option value="${Number(member.id)}" ${task.assigneeId === member.id ? "selected" : ""}>${escapeHTML(member.name)}</option>`).join("");
    return `<article class="task-card ${isOverdue(task) ? "overdue" : ""}" data-task-id="${Number(task.id)}"><h3>${escapeHTML(task.title)}</h3>${task.description ? `<p>${escapeHTML(task.description)}</p>` : ""}
        <div class="task-card-foot"><span class="task-assignee">${assignee ? `<i class="tiny-avatar">${escapeHTML(initials(assignee.name))}</i>${escapeHTML(assignee.name.split(/\s+/)[0])}` : "Non assegnato"}</span>
        <span class="task-card-actions"><span class="priority-chip ${escapeHTML(task.priority || "medium")}">${escapeHTML(priorityLabel(task.priority))}</span>${canEdit ? `<select class="task-select" data-action="task-status" aria-label="Sposta task">${statusOptions}</select><button class="delete-task" data-action="delete-task" title="Elimina task" aria-label="Elimina task">×</button>` : ""}</span></div>
        ${isOverdue(task) ? `<span class="overdue-label">Scaduto</span>` : ""}
        ${canEdit ? `<label class="task-reassign">Assegnataria<select data-action="task-assignee" aria-label="Riassegna task"><option value="">Nessuno</option>${memberOptions}</select></label>` : ""}
        ${task.dueDate ? `<div class="task-due">◷ ${escapeHTML(formatDate(task.dueDate, { day: "numeric", month: "long", year: "numeric" }))}</div>` : ""}</article>`;
}

async function loadMessages(older = false) {
    if (!state.project || !isProjectMember() || state.messageLoading) return;
    const projectId = state.project.id;
    const before = older ? state.messageBefore : null;
    if (older && !before) return;
    state.messageLoading = true;
    $("#olderMessages").disabled = true;
    try {
        const messages = await api(`/projects/${projectId}/messages${before ? `?before=${before}` : ""}`);
        if (state.project?.id !== projectId) return;
        const list = $("#messageList");
        const height = list.scrollHeight, top = list.scrollTop;
        state.messageBefore = messages.pagination.before;
        mergeMessages(messages, !older);
        $("#olderMessages").classList.toggle("hidden", !messages.pagination.hasMore);
        if (older) list.scrollTop = top + list.scrollHeight - height;
    } catch (error) { showToast(error.message, "error"); }
    finally {
        if (state.project?.id === projectId) {
            state.messageLoading = false;
            $("#olderMessages").disabled = false;
        }
    }
}
function mergeMessages(messages, scroll = false) {
    const list = $("#messageList");
    const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    state.messages = [...new Map([...state.messages, ...messages].map(message => [message.id, message])).values()].sort((a, b) => a.id - b.id);
    const top = list.scrollTop;
    renderMessages();
    list.scrollTop = scroll || atBottom ? list.scrollHeight : top;
}

function renderMessages() {
    const list = $("#messageList");
    if (!state.messages.length) {
        list.innerHTML = `<div class="no-assigned">La conversazione comincia da qui. Saluta il tuo team!</div>`;
        return;
    }
    list.innerHTML = state.messages.map((message) => {
        const own = message.userId === state.user.id;
        return `<article class="message-row ${own ? "own" : ""}"><span class="tiny-avatar">${escapeHTML(initials(message.author?.name || "?"))}</span><div class="message-bubble"><div class="message-author">${own ? "Tu" : escapeHTML(message.author?.name || "Membro del progetto")}</div><div class="message-content">${escapeHTML(message.content)}</div><div class="message-time">${escapeHTML(formatDateTime(message.createdAt))}</div></div></article>`;
    }).join("");
    list.scrollTop = list.scrollHeight;
}

async function refreshCurrentProject() {
    if (state.activeView !== "project" || !state.project) return;
    const projectId = state.project.id;
    try {
        const project = await api(`/projects/${projectId}`);
        if (state.project?.id !== projectId) return;
        state.project = project;
        renderProjectHeader();
        if (isProjectMember()) await loadBoard();
        else {
            state.board = { todo: [], in_progress: [], done: [] };
            state.messages = [];
            state.messageBefore = null;
            state.socket?.emit("leaveProject", projectId);
            renderBoard();
            renderMessages();
            $("#olderMessages").classList.add("hidden");
        }
    } catch (error) {
        if (state.project?.id === projectId) {
            state.project = null;
            state.board = { todo: [], in_progress: [], done: [] };
            state.messages = [];
            setView("dashboard");
        }
        showToast(error.message, "error");
    }
}

async function createProject(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const body = {
        title: String(form.get("title")).trim(),
        description: String(form.get("description")).trim(),
        category: String(form.get("category")).trim(),
        technologies: String(form.get("technologies")).split(",").map((item) => item.trim()).filter(Boolean),
        visibility: String(form.get("visibility"))
    };
    try {
        const project = await api("/projects", { method: "POST", body: JSON.stringify(body) });
        $("#projectDialog").close();
        formElement.reset();
        await loadDashboard();
        showToast("Progetto creato. È ora di mettersi al lavoro!");
        await openProject(project.id);
    } catch (error) { showToast(error.message, "error"); }
}

async function createTask(event) {
    event.preventDefault();
    if (!state.project) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const assignee = String(form.get("assigneeId"));
    const body = {
        title: String(form.get("title")).trim(),
        description: String(form.get("description")).trim(),
        priority: String(form.get("priority")),
        dueDate: String(form.get("dueDate")) || null,
        assigneeId: assignee ? Number(assignee) : null
    };
    try {
        await api(`/projects/${state.project.id}/tasks`, { method: "POST", body: JSON.stringify(body) });
        $("#taskDialog").close();
        formElement.reset();
        await loadBoard();
        showToast("Task aggiunto alla bacheca.");
    } catch (error) { showToast(error.message, "error"); }
}

async function sendMessage(event) {
    event.preventDefault();
    const content = $("#messageInput").value.trim();
    if (!content || !state.project) return;
    try {
        const projectId = state.project.id;
        const message = await api(`/projects/${projectId}/messages`, { method: "POST", body: JSON.stringify({ content }) });
        if (state.project?.id === projectId) {
            $("#messageInput").value = "";
            mergeMessages([message], true);
        }
    } catch (error) { showToast(error.message, "error"); }
}

async function handleProjectAction(event) {
    const target = event.target.closest("[data-action]");
    if (!target || !state.project) return;
    if (["task-status", "task-assignee"].includes(target.dataset.action) && event.type !== "change") return;
    if (target.dataset.action === "delete-task" && event.type !== "click") return;
    const taskCard = target.closest("[data-task-id]");
    const taskId = Number(taskCard?.dataset.taskId);
    try {
        if (target.dataset.action === "task-status") {
            await api(`/projects/${state.project.id}/tasks/${taskId}/status`, { method: "PATCH", body: JSON.stringify({ status: target.value }) });
            await loadBoard();
        } else if (target.dataset.action === "task-assignee") {
            const assigneeId = target.value ? Number(target.value) : null;
            await api(`/projects/${state.project.id}/tasks/${taskId}/assign`, { method: "PATCH", body: JSON.stringify({ assigneeId }) });
            await loadBoard();
        } else if (target.dataset.action === "delete-task") {
            if (!window.confirm("Eliminare questo task? L'operazione \u00e8 definitiva.")) return;
            await api(`/projects/${state.project.id}/tasks/${taskId}`, { method: "DELETE" });
            await loadBoard();
            showToast("Task eliminato.");
        } else if (target.dataset.action === "create-project") {
            $("#projectDialog").showModal();
        }
    } catch (error) { showToast(error.message, "error"); }
}

function inviteMember() {
    $("#inviteForm").reset();
    openDialog($("#inviteDialog"));
}

async function handleInvite(event) {
    event.preventDefault();
    const email = new FormData(event.currentTarget).get("email");
    try {
        await api(`/projects/${state.project.id}/members`, { method: "POST", body: JSON.stringify({ email: email.trim() }) });
        $("#inviteDialog").close();
        showToast("Invito aggiunto al progetto.");
        await openProject(state.project.id);
    } catch (error) { showToast(error.message, "error"); }
}

async function toggleArchive() {
    if (!state.project) return;
    const archived = state.project.status !== "archived";
    try {
        await api(`/projects/${state.project.id}/archive`, { method: "PATCH", body: JSON.stringify({ archived }) });
        showToast(archived ? "Progetto archiviato." : "Progetto riattivato.");
        await loadDashboard();
        await openProject(state.project.id);
    } catch (error) { showToast(error.message, "error"); }
}

async function deleteProject() {
    if (!state.project || !window.confirm(`Eliminare "${state.project.title}"? Verranno rimossi anche task, chat e segnalazioni del progetto.`)) return;
    try {
        await api(`/projects/${state.project.id}`, { method: "DELETE" });
        state.project = null;
        setView("dashboard");
        await loadDashboard();
        showToast("Progetto eliminato.");
    } catch (error) { showToast(error.message, "error"); }
}

function openDialog(dialog) {
    if (dialog && !dialog.open) dialog.showModal();
}

function bindEvents() {
    $("#authForm").addEventListener("submit", handleAuth);
    $("#authSwitch").addEventListener("click", () => setAuthMode(state.authMode === "login" ? "register" : "login"));
    $("#logoutBtn").addEventListener("click", () => signOut());
    $("#createProjectButton").addEventListener("click", () => openDialog($("#projectDialog")));
    $("#sidebarCreate").addEventListener("click", () => openDialog($("#projectDialog")));
    $("#createTaskButton").addEventListener("click", () => openDialog($("#taskDialog")));
    $("#projectForm").addEventListener("submit", createProject);
    $("#taskForm").addEventListener("submit", createTask);
    $("#inviteForm").addEventListener("submit", handleInvite);
    $("#messageForm").addEventListener("submit", sendMessage);
    $("#boardColumns").addEventListener("change", handleProjectAction);
    $("#boardColumns").addEventListener("click", handleProjectAction);
    $("#inviteButton").addEventListener("click", inviteMember);
    $("#archiveButton").addEventListener("click", toggleArchive);
    $("#deleteProjectButton").addEventListener("click", deleteProject);
    $("#backToDashboard").addEventListener("click", () => { setView("dashboard"); loadDashboard().catch((e) => showToast(e.message, "error")); });
    let catalogTimer;
    for (const id of ["catalogSearch", "catalogCategoryFilter"]) $("#" + id).addEventListener("input", () => {
        clearTimeout(catalogTimer);
        catalogTimer = setTimeout(() => { state.catalogPage = 1; loadCatalog(); }, 300);
    });
    for (const id of ["boardSearch", "boardAssignee", "boardPriority", "boardDue"]) $("#" + id).addEventListener("input", renderBoard);
    $("#olderMessages").addEventListener("click", () => loadMessages(true));
    $("#dashboardMore").addEventListener("click", async event => {
        event.target.disabled = true;
        try { await loadDashboard(true); } catch (error) { showToast(error.message, "error"); }
        finally { event.target.disabled = false; }
    });
    for (const name of ["catalog", "user", "report"]) for (const [direction, step] of [["Prev", -1], ["Next", 1]]) {
        $(`#${name}${direction}`).addEventListener("click", () => {
            state[`${name}Page`] = Math.max(1, state[`${name}Page`] + step);
            if (name === "catalog") loadCatalog(); else loadAdmin();
        });
    }
    $("#notificationButton").addEventListener("click", () => { $("#notificationDot").classList.add("hidden"); showToast("Sei aggiornata: nessuna notifica da leggere."); });

    $$(".nav-item").forEach((button) => button.addEventListener("click", () => {
        setView(button.dataset.view);
        if (button.dataset.view === "dashboard") loadDashboard().catch((e) => showToast(e.message, "error"));
        if (button.dataset.view === "explore") loadCatalog();
        if (button.dataset.view === "admin") loadAdmin();
    }));
    $("#refreshAdmin").addEventListener("click", () => { state.userPage = 1; state.reportPage = 1; loadAdmin(); });
    $("#adminView").addEventListener("click", handleAdminAction);
    $$('[data-go-view="explore"]').forEach((button) => button.addEventListener("click", () => {
        setView("explore");
        loadCatalog();
    }));
    $$("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
    $$(".project-tab").forEach((button) => button.addEventListener("click", async () => {
        $$(".project-tab").forEach((tab) => tab.classList.toggle("active", tab === button));
        const chat = button.dataset.projectTab === "chat";
        $("#boardPanel").classList.toggle("hidden", chat);
        $("#chatPanel").classList.toggle("hidden", !chat);
        if (chat) await loadMessages();
    }));

    document.addEventListener("click", (event) => {
        const card = event.target.closest("[data-project-id]");
        if (card) openProject(card.dataset.projectId);
    });
    document.addEventListener("keydown", (event) => {
        const card = event.target.closest?.(".project-card[role=button]");
        if (card && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            openProject(card.dataset.projectId);
        }
    });
    $$("dialog").forEach((dialog) => dialog.addEventListener("click", (event) => {
        if (event.target === dialog) dialog.close();
    }));
}

async function init() {
    bindEvents();
    setAuthMode("login");
    const date = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
    $("#welcomeEyebrow").textContent = date.toLocaleUpperCase("it-IT");
    if (!state.token) return showAuth();

    try {
        state.user = await api("/auth/me");
        showApp();
        connectSocket();
        await loadDashboard();
    } catch {
        signOut(false);
    }
}

init();
