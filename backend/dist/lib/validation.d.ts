import type { MealType } from "@prisma/client";
export type JsonObject = Record<string, unknown>;
export declare function asObject(value: unknown): JsonObject;
export declare function requiredString(body: JsonObject, key: string, max?: number): string;
export declare function optionalString(body: JsonObject, key: string, max?: number): string | null;
export declare function requiredNumber(body: JsonObject, key: string, min?: number, max?: number): number;
export declare function optionalNumber(body: JsonObject, key: string, fallback: number, min?: number, max?: number): number;
export declare function parseDate(value: unknown): Date;
export declare function parseMealType(value: unknown, allowSnack?: boolean): MealType;
export declare function formatDate(value: Date): string;
export declare class ValidationError extends Error {
    statusCode: number;
}
