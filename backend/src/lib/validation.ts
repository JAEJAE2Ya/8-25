import type { MealType } from "@prisma/client";

export type JsonObject = Record<string, unknown>;

export function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

export function requiredString(body: JsonObject, key: string, max = 200) {
  const value = typeof body[key] === "string" ? body[key].trim() : "";
  if (!value) throw new ValidationError(`${key} is required`);
  return value.slice(0, max);
}

export function optionalString(body: JsonObject, key: string, max = 500) {
  const value = typeof body[key] === "string" ? body[key].trim() : "";
  return value ? value.slice(0, max) : null;
}

export function requiredNumber(body: JsonObject, key: string, min = 0, max = 100_000) {
  const value = Number(body[key]);
  if (!Number.isFinite(value) || value < min || value > max) throw new ValidationError(`${key} is invalid`);
  return value;
}

export function optionalNumber(body: JsonObject, key: string, fallback: number, min = 0, max = 100_000) {
  if (body[key] === undefined || body[key] === null || body[key] === "") return fallback;
  return requiredNumber(body, key, min, max);
}

export function parseDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ValidationError("date must be YYYY-MM-DD");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new ValidationError("date is invalid");
  return date;
}

export function parseMealType(value: unknown, allowSnack = true): MealType {
  const allowed = allowSnack ? ["breakfast", "lunch", "dinner", "snack"] : ["breakfast", "lunch", "dinner"];
  if (typeof value !== "string" || !allowed.includes(value)) throw new ValidationError("mealType is invalid");
  return value as MealType;
}

export function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export class ValidationError extends Error {
  statusCode = 400;
}
