import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config.js";
import { requireAuth } from "../lib/auth.js";
import { foodEntryDto, plannedMealDto, sumFoodEntries } from "../lib/dto.js";
import { persistRecipe } from "../lib/recipe.js";
import { asObject, formatDate, parseDate, parseMealType, requiredNumber, requiredString } from "../lib/validation.js";

async function plannedInput(db: PrismaClient, userId: string, value: unknown) {
  const body = asObject(value);
  const nutrition = asObject(body.nutrition);
  const recipe = body.recipe ? await persistRecipe(db, userId, body.recipe) : null;
  return {
    date: parseDate(body.date),
    mealType: parseMealType(body.mealType, false),
    recipeId: recipe?.id ?? null,
    recipeExternalId: recipe?.externalId ?? (typeof body.recipeId === "string" ? body.recipeId.slice(0, 200) : null),
    recipeName: requiredString(body, "recipeName", 200),
    calories: requiredNumber(nutrition, "calories", 0, 100_000),
    carbs: requiredNumber(nutrition, "carbs", 0, 10_000),
    protein: requiredNumber(nutrition, "protein", 0, 10_000),
    fat: requiredNumber(nutrition, "fat", 0, 10_000),
  };
}

export function registerPlannedMealRoutes(app: FastifyInstance, db: PrismaClient, config: AppConfig) {
  app.get("/api/planned-meals", async (request, reply) => {
    const user = await requireAuth(request, reply, db, config);
    if (!user) return;
    const date = parseDate((request.query as { date?: string }).date);
    const items = await db.plannedMeal.findMany({ where: { userId: user.id, date }, orderBy: { createdAt: "asc" } });
    return { date: formatDate(date), plannedMeals: items.map(plannedMealDto) };
  });

  app.post("/api/planned-meals", async (request, reply) => {
    const user = await requireAuth(request, reply, db, config);
    if (!user) return;
    const data = await plannedInput(db, user.id, request.body);
    const item = await db.$transaction(async (tx) => {
      await tx.plannedMeal.deleteMany({ where: { userId: user.id, date: data.date, mealType: data.mealType } });
      return tx.plannedMeal.create({ data: { userId: user.id, ...data } });
    });
    return reply.code(201).send({ plannedMeal: plannedMealDto(item) });
  });

  app.patch<{ Params: { id: string } }>("/api/planned-meals/:id", async (request, reply) => {
    const user = await requireAuth(request, reply, db, config);
    if (!user) return;
    const owned = await db.plannedMeal.findFirst({ where: { id: request.params.id, userId: user.id } });
    if (!owned) return reply.code(404).send({ error: "planned_meal_not_found" });
    const data = await plannedInput(db, user.id, request.body);
    const item = await db.plannedMeal.update({ where: { id: owned.id }, data });
    return { plannedMeal: plannedMealDto(item) };
  });

  app.delete<{ Params: { id: string } }>("/api/planned-meals/:id", async (request, reply) => {
    const user = await requireAuth(request, reply, db, config);
    if (!user) return;
    const owned = await db.plannedMeal.findFirst({ where: { id: request.params.id, userId: user.id }, select: { id: true } });
    if (!owned) return reply.code(404).send({ error: "planned_meal_not_found" });
    await db.plannedMeal.delete({ where: { id: owned.id } });
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string } }>("/api/planned-meals/:id/consume", async (request, reply) => {
    const user = await requireAuth(request, reply, db, config);
    if (!user) return;
    const result = await db.$transaction(async (tx) => {
      const planned = await tx.plannedMeal.findFirst({ where: { id: request.params.id, userId: user.id } });
      if (!planned) return null;
      const entry = await tx.foodEntry.create({
        data: {
          userId: user.id,
          date: planned.date,
          mealType: planned.mealType,
          foodIdentifier: planned.recipeExternalId ?? planned.recipeId,
          foodName: planned.recipeName,
          servingAmount: 1,
          servingUnit: "인분",
          calories: planned.calories,
          carbs: planned.carbs,
          protein: planned.protein,
          fat: planned.fat,
          source: "recipe",
        },
      });
      await tx.plannedMeal.delete({ where: { id: planned.id } });
      const dayEntries = await tx.foodEntry.findMany({ where: { userId: user.id, date: planned.date } });
      return { entry, date: planned.date, totals: sumFoodEntries(dayEntries) };
    });
    if (!result) return reply.code(404).send({ error: "planned_meal_not_found" });
    return { entry: foodEntryDto(result.entry), date: formatDate(result.date), totals: result.totals };
  });
}
