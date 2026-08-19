export function asObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
export function requiredString(body, key, max = 200) {
    const value = typeof body[key] === "string" ? body[key].trim() : "";
    if (!value)
        throw new ValidationError(`${key} is required`);
    return value.slice(0, max);
}
export function optionalString(body, key, max = 500) {
    const value = typeof body[key] === "string" ? body[key].trim() : "";
    return value ? value.slice(0, max) : null;
}
export function requiredNumber(body, key, min = 0, max = 100_000) {
    const value = Number(body[key]);
    if (!Number.isFinite(value) || value < min || value > max)
        throw new ValidationError(`${key} is invalid`);
    return value;
}
export function optionalNumber(body, key, fallback, min = 0, max = 100_000) {
    if (body[key] === undefined || body[key] === null || body[key] === "")
        return fallback;
    return requiredNumber(body, key, min, max);
}
export function parseDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
        throw new ValidationError("date must be YYYY-MM-DD");
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value)
        throw new ValidationError("date is invalid");
    return date;
}
export function parseMealType(value, allowSnack = true) {
    const allowed = allowSnack ? ["breakfast", "lunch", "dinner", "snack"] : ["breakfast", "lunch", "dinner"];
    if (typeof value !== "string" || !allowed.includes(value))
        throw new ValidationError("mealType is invalid");
    return value;
}
export function formatDate(value) {
    return value.toISOString().slice(0, 10);
}
export class ValidationError extends Error {
    statusCode = 400;
}
//# sourceMappingURL=validation.js.map