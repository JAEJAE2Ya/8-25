import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config.js";
import { requireAuth } from "../lib/auth.js";
import { searchMfds, type NormalizedFood } from "../lib/mfds.js";
import { asObject, optionalString, requiredNumber, requiredString } from "../lib/validation.js";

const userFoodDto = (food: { id: string; name: string; manufacturer: string | null; referenceAmount: number; servingUnit: string; calories: number; carbs: number; protein: number; fat: number }): NormalizedFood => ({
  id: `user:${food.id}`,
  name: food.name,
  manufacturer: food.manufacturer ?? undefined,
  referenceAmount: food.referenceAmount,
  unit: food.servingUnit,
  nutrition: { calories: food.calories, carbs: food.carbs, protein: food.protein, fat: food.fat },
  source: "user",
});

const normalizeFoodName = (name: string) => name.trim().toLocaleLowerCase("ko-KR");

export function registerFoodRoutes(app: FastifyInstance, db: PrismaClient, config: AppConfig) {
  app.get("/api/foods/search", async (request, reply) => {
    const user = await requireAuth(request, reply, db, config);
    if (!user) return;
    const query = String((request.query as { q?: string }).q ?? "").trim().slice(0, 100);
    if (!query) return { foods: [] };
    const ownFoods = await db.userFood.findMany({ where: { userId: user.id, name: { contains: query, mode: "insensitive" } }, take: 20, orderBy: { updatedAt: "desc" } });
    try {
      const mfds = await searchMfds(query, config);
      return { foods: [...ownFoods.map(userFoodDto), ...mfds.foods], provider: mfds.warning ? "user" : "mfds", warning: mfds.warning };
    } catch (error) {
      request.log.warn({ error }, "MFDS food search failed");
      return { foods: ownFoods.map(userFoodDto), provider: "user", warning: "mfds_unavailable" };
    }
  });

  app.get("/api/foods/user", async (request, reply) => {
    const user = await requireAuth(request, reply, db, config);
    if (!user) return;
    const foods = await db.userFood.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } });
    return { foods: foods.map(userFoodDto) };
  });

  app.post("/api/foods/user", async (request, reply) => {
    const user = await requireAuth(request, reply, db, config);
    if (!user) return;
    const body = asObject(request.body);
    const nutrition = asObject(body.nutrition);
    const name = requiredString(body, "name", 200);
    const normalizedName = normalizeFoodName(name);
    const foodData = {
      name,
      normalizedName,
      manufacturer: optionalString(body, "manufacturer", 200),
      referenceAmount: requiredNumber(body, "referenceAmount", 0.01, 100_000),
      servingUnit: requiredString(body, "unit", 20),
      calories: requiredNumber(nutrition, "calories", 0, 100_000),
      carbs: requiredNumber(nutrition, "carbs", 0, 10_000),
      protein: requiredNumber(nutrition, "protein", 0, 10_000),
      fat: requiredNumber(nutrition, "fat", 0, 10_000),
    };
    const food = await db.userFood.upsert({
      where: { userId_normalizedName: { userId: user.id, normalizedName } },
      create: {
        userId: user.id,
        ...foodData,
      },
      update: foodData,
    });
    return reply.code(201).send({ food: userFoodDto(food) });
  });

  app.delete<{ Params: { id: string } }>("/api/foods/user/:id", async (request, reply) => {
    const user = await requireAuth(request, reply, db, config);
    if (!user) return;
    const id = request.params.id.replace(/^user:/, "");
    const owned = await db.userFood.findFirst({ where: { id, userId: user.id }, select: { id: true } });
    if (!owned) return reply.code(404).send({ error: "user_food_not_found" });
    await db.userFood.delete({ where: { id: owned.id } });
    return reply.code(204).send();
  });

  app.get("/api/foods/recent", async (request, reply) => {
    const user = await requireAuth(request, reply, db, config);
    if (!user) return;
    const entries = await db.foodEntry.findMany({ where: { userId: user.id, foodIdentifier: { not: null } }, orderBy: { createdAt: "desc" }, take: 100 });
    const seen = new Set<string>();
    const foods: NormalizedFood[] = [];
    for (const entry of entries) {
      const id = entry.foodIdentifier;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      foods.push({
        id,
        name: entry.foodName,
        manufacturer: entry.manufacturer ?? undefined,
        referenceAmount: entry.servingAmount,
        unit: entry.servingUnit,
        nutrition: { calories: entry.calories, carbs: entry.carbs, protein: entry.protein, fat: entry.fat },
        source: id.startsWith("user:") ? "user" : "mfds",
      });
      if (foods.length >= 20) break;
    }
    return { foods };
  });
}
