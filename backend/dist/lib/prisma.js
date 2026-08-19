import { PrismaClient } from "@prisma/client";
const globalForPrisma = globalThis;
export const prisma = globalForPrisma.mealfitPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production")
    globalForPrisma.mealfitPrisma = prisma;
//# sourceMappingURL=prisma.js.map