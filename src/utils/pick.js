// Prende da un oggetto SOLO i campi indicati (se presenti).
// Lo usiamo con req.body per accettare solo i campi che vogliamo:
// così un utente non può, per esempio, cambiarsi da solo "ownerId" o "isHidden".
//
// Esempio: pick({ title: "A", isHidden: true }, ["title"])  ->  { title: "A" }
export default function pick(obj, fields) {
    const result = {};
    for (const field of fields) {
        if (obj[field] !== undefined) {
            result[field] = obj[field];
        }
    }
    return result;
}
