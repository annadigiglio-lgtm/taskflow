// Script della pagina di prova (in un file separato perché helmet blocca gli script "inline")
let socket = null;

// Scrive una riga nel riquadro degli eventi
function log(text) {
    const logDiv = document.getElementById("log");
    const line = document.createElement("div");
    line.textContent = `[${new Date().toLocaleTimeString()}] ${text}`; // textContent: niente XSS
    logDiv.prepend(line);
}

// Connessione a Socket.io mandando il token JWT
document.getElementById("connectBtn").addEventListener("click", () => {
    const token = document.getElementById("token").value.trim();
    if (socket) socket.disconnect();

    socket = io({ auth: { token } });

    socket.on("connect", () => log("Connesso! id socket: " + socket.id));
    socket.on("connect_error", (err) => log("Errore di connessione: " + err.message));

    // Eventi inviati dal server
    socket.on("notification", (data) => log("NOTIFICA: " + data.message));
    socket.on("joinedProject", (data) => log("Sei nella stanza del progetto " + data.projectId));
    socket.on("taskCreated", (task) => log(`Task creato: "${task.title}" (${task.status})`));
    socket.on("taskUpdated", (task) => log(`Task aggiornato: "${task.title}" -> ${task.status}`));
    socket.on("taskDeleted", (data) => log("Task eliminato: id " + data.id));
    socket.on("memberJoined", (data) => log("Nuovo membro nel progetto: " + data.user.name));
    socket.on("memberLeft", (data) => log("Membro rimosso: id " + data.userId));
    socket.on("chatMessage", (msg) => log(`CHAT ${msg.author.name}: ${msg.content}`));
    socket.on("newReport", (data) => log(`SEGNALAZIONE progetto "${data.projectTitle}": ${data.reason}`));
    socket.on("errorMessage", (msg) => log("Errore: " + msg));
});

// Entra nella stanza di un progetto
document.getElementById("joinBtn").addEventListener("click", () => {
    if (!socket) return log("Prima connettiti");
    socket.emit("joinProject", Number(document.getElementById("projectId").value));
});

// Invio messaggio: si usa l'API REST, la risposta arriva a tutti via Socket.io
document.getElementById("sendBtn").addEventListener("click", async () => {
    const token = document.getElementById("token").value.trim();
    const projectId = document.getElementById("projectId").value;
    const content = document.getElementById("message").value;

    const res = await fetch(`/api/projects/${projectId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify({ content })
    });
    if (!res.ok) {
        const data = await res.json();
        log("Errore invio: " + data.error);
    }
    document.getElementById("message").value = "";
});
