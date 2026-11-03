import httpError from "./httpError.js";

export function positiveInteger(value, name, fallback, max = Number.MAX_SAFE_INTEGER) {
    if (value === undefined) return fallback;
    if (typeof value !== "string" || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > max) {
        throw httpError(400, `Il parametro '${name}' deve essere un intero positivo (massimo ${max})`);
    }
    return Number(value);
}

export function pagination(query) {
    const limit = positiveInteger(query.limit, "limit", 25, 100);
    const page = positiveInteger(query.page, "page", 1, 1000000);
    return { limit, page, offset: (page - 1) * limit };
}

export function pageHeaders(res, { page, limit }, total) {
    res.set({ "X-Page": String(page), "X-Limit": String(limit), "X-Total-Count": String(total), "X-Has-More": String(page * limit < total) });
}
