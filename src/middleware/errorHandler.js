// Middleware per le rotte che non esistono -> 404
export function notFound(req, res, next) {
    res.status(404).json({ error: `Rotta ${req.method} ${req.originalUrl} non trovata` });
}

// Middleware CENTRALIZZATO per la gestione degli errori.
// Express lo riconosce perché ha 4 parametri (err, req, res, next).
// Ogni controller, in caso di problemi, chiama next(err) e l'errore arriva qui:
// così decidiamo in UN SOLO punto quale codice HTTP e quale messaggio restituire.
// NB: anche se "next" non viene usato, deve esserci, altrimenti Express non lo
// riconosce come middleware di errore.
export function errorHandler(err, req, res, next) {
    // Dati che non rispettano le validazioni dei modelli Sequelize -> 400 Bad Request
    if (err.name === "SequelizeValidationError") {
        return res.status(400).json({
            error: "Dati non validi",
            details: err.errors.map(e => e.message)
        });
    }

    // Valore che deve essere unico ma esiste già (es. email) -> 409 Conflict
    if (err.name === "SequelizeUniqueConstraintError") {
        return res.status(409).json({
            error: "Valore già esistente",
            details: err.errors.map(e => e.message)
        });
    }

    // Valore non valido per il database (es. una data impossibile) -> 400
    if (err.name === "SequelizeDatabaseError") {
        return res.status(400).json({ error: "Dati non validi per il database" });
    }

    // Body JSON scritto male (es. virgola mancante) -> 400
    if (err.type === "entity.parse.failed") {
        return res.status(400).json({ error: "JSON non valido nel body della richiesta" });
    }

    // Errori creati da noi con httpError(status, messaggio)
    const status = err.status || 500;

    // Gli errori 500 sono imprevisti: li stampiamo in console per il debug,
    // ma al client NON mostriamo i dettagli interni (sicurezza)
    if (status === 500) {
        console.error("Errore interno:", err);
        return res.status(500).json({ error: "Errore interno del server" });
    }

    res.status(status).json({ error: err.message });
}
