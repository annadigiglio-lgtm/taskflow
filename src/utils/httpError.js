// Crea un errore che "porta con sé" il codice HTTP da restituire al client.
// Uso: throw httpError(404, "Progetto non trovato");
// L'errore arriva poi al middleware errorHandler, che risponde con quel codice.
export default function httpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}
