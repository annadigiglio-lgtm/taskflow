// Storico locale: ogni account ha una chiave diversa in questo browser.
function loadNotifications() {
    state.notifications = [];
    try {
        const saved = JSON.parse(
            localStorage.getItem(`taskflowNotifications:${state.user.id}`) || "[]",
        );
        if (Array.isArray(saved)) {
            state.notifications = saved
                .filter(
                    (item) =>
                        item &&
                        typeof item.message === "string" &&
                        typeof item.read === "boolean" &&
                        typeof item.createdAt === "string" &&
                        !Number.isNaN(new Date(item.createdAt).getTime()),
                )
                .slice(0, 50);
        }
    } catch {
        // Un dato locale non leggibile non deve impedire il login.
        console.info("Storico notifiche locale non disponibile.");
    }
    renderNotifications();
}

function saveNotifications() {
    if (!state.user) return;
    try {
        localStorage.setItem(
            `taskflowNotifications:${state.user.id}`,
            JSON.stringify(state.notifications),
        );
    } catch {
        showToast(
            "Il browser non permette di salvare le notifiche: resteranno disponibili fino al ricaricamento.",
            "error",
        );
    }
}

function addNotification(message) {
    if (!state.user) return;
    state.notifications.unshift({
        message,
        createdAt: new Date().toISOString(),
        read: $("#notificationsDialog").open,
    });
    state.notifications = state.notifications.slice(0, 50);
    saveNotifications();
    renderNotifications();
    showToast(message);
}

function renderNotifications() {
    const unread = state.notifications.filter((item) => !item.read).length;
    $("#notificationDot").classList.toggle("hidden", unread === 0);
    $("#notificationButton").setAttribute("aria-label", `Notifiche: ${unread} da leggere`);
    $("#notificationsList").innerHTML = state.notifications.length
        ? state.notifications
              .map(
                  (item) =>
                      `<li class="notification-row"><p>${escapeHTML(item.message)}</p><small>${escapeHTML(formatDateTime(item.createdAt))}</small></li>`,
              )
              .join("")
        : '<li class="no-assigned">Non hai ancora notifiche in questo browser.</li>';
    $("#clearNotifications").disabled = state.notifications.length === 0;
}

function openNotifications() {
    state.notifications.forEach((item) => {
        item.read = true;
    });
    saveNotifications();
    renderNotifications();
    openDialog($("#notificationsDialog"));
}
