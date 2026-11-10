import { User } from "../models/index.js";

export async function loadSessionUser(payload) {
    // Lo scope normale esclude password e codici di reset.
    const user = await User.findByPk(payload.id);
    if (!user) return null;
    // Esempio: il token ha versione 0, ma dopo il reset l'utente ha versione 1.
    if (payload.tokenVersion !== user.tokenVersion) return null;
    return user;
}
