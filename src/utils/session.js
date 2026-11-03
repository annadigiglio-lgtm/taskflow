import { createHmac } from "node:crypto";
import { User } from "../models/index.js";

// Derivato dall'hash corrente: il cambio password invalida anche i JWT già emessi.
export function passwordVersion(passwordHash) {
    return createHmac("sha256", process.env.JWT_SECRET).update(passwordHash).digest("hex");
}

export async function loadSessionUser(payload) {
    const user = await User.unscoped().findByPk(payload.id);
    if (!user || !payload.passwordVersion || payload.passwordVersion !== passwordVersion(user.password)) {
        return null;
    }
    for (const field of ["password", "resetToken", "resetTokenExpires"]) delete user.dataValues[field];
    return user;
}
