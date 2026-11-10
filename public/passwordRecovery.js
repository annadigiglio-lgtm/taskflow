function openRecovery() {
    $("#forgotPasswordForm").reset();
    $("#resetPasswordForm").reset();
    $("#recoveryMessage").textContent = "";
    $("#resetPasswordError").textContent = "";
    $("#forgotPasswordForm").elements.email.value = $("#authEmail").value;
    openDialog($("#recoveryDialog"));
}

async function requestPasswordReset(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    $("#recoveryMessage").textContent = "";
    try {
        const result = await api("/auth/forgot-password", {
            method: "POST",
            body: JSON.stringify({ email: form.elements.email.value.trim() }),
        });
        $("#recoveryMessage").textContent =
            `${result.message}. Per la demo, cerca il codice nella console del server.`;
    } catch (error) {
        $("#recoveryMessage").textContent = error.message;
    } finally {
        button.disabled = false;
    }
}

async function resetPassword(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type=submit]");
    const password = form.elements.newPassword.value;
    $("#resetPasswordError").textContent = "";
    if (password !== form.elements.confirmPassword.value) {
        $("#resetPasswordError").textContent = "Le due password non coincidono.";
        return;
    }
    // bcrypt accetta al massimo 72 byte: i caratteri accentati possono occupare più byte.
    if (new TextEncoder().encode(password).length > 72) {
        $("#resetPasswordError").textContent =
            "La password è troppo lunga: usa al massimo 72 byte.";
        return;
    }
    button.disabled = true;
    try {
        await api("/auth/reset-password", {
            method: "POST",
            body: JSON.stringify({
                token: form.elements.token.value.trim(),
                newPassword: password,
            }),
        });
        $("#recoveryDialog").close();
        $("#authPassword").value = "";
        form.reset();
        setAuthMode("login");
        showToast("Password aggiornata. Accedi con la nuova password.");
    } catch (error) {
        $("#resetPasswordError").textContent = error.message;
    } finally {
        button.disabled = false;
    }
}
