import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { mealfitPrisma?: PrismaClient };

export const prisma = globalForPrisma.mealfitPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.mealfitPrisma = prisma;
