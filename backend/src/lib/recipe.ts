import { Prisma, type PrismaClient } from "@prisma/client";
import { asObject, optionalString, requiredNumber, requiredString, ValidationError } from "./validation.js";

type RecipeDb = PrismaClient | Prisma.TransactionClient;

export async function persistRecipe(db: RecipeDb, ownerId: string, value: unknown) {
  const body = asObject(value);
  const externalId = optionalString(body, "id", 200);
  if (externalId) {
    const existing = await db.recipe.findFirst({ where: { ownerId, externalId } });
    if (existing) return existing;
  }
  const nutrition = asObject(body.nutrition);
  const ingredients = Array.isArray(body.ingredients) ? body.ingredients : [];
  const instructions = Array.isArray(body.instructions) ? body.instructions : [];
  const difficulty = typeof body.difficulty === "string" && ["easy", "medium", "hard"].includes(body.difficulty) ? body.difficulty : "easy";
  if (!ingredients.length || !instructions.length) throw new ValidationError("recipe details are required");
  return db.recipe.create({
    data: {
      ownerId,
      externalId,
      name: requiredString(body, "name", 200),
      description: optionalString(body, "description", 1000) ?? "",
      calories: requiredNumber(nutrition, "calories", 0, 100_000),
      carbs: requiredNumber(nutrition, "carbs", 0, 10_000),
      protein: requiredNumber(nutrition, "protein", 0, 10_000),
      fat: requiredNumber(nutrition, "fat", 0, 10_000),
      cookingTime: Math.round(Number(body.cookingTimeMinutes) || 10),
      difficulty: difficulty as "easy" | "medium" | "hard",
      ingredients: ingredients as Prisma.InputJsonValue,
      instructions: instructions as Prisma.InputJsonValue,
    },
  });
}

export function recipeDto(recipe: {
  id: string;
  externalId: string | null;
  name: string;
  description: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  cookingTime: number;
  difficulty: "easy" | "medium" | "hard";
  ingredients: Prisma.JsonValue;
  instructions: Prisma.JsonValue;
}) {
  return {
    id: recipe.externalId ?? recipe.id,
    databaseId: recipe.id,
    mealType: "dinner" as const,
    name: recipe.name,
    description: recipe.description,
    emoji: "🍽️",
    nutrition: { calories: recipe.calories, carbs: recipe.carbs, protein: recipe.protein, fat: recipe.fat },
    tags: ["저장한 레시피"],
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
    cookingTimeMinutes: recipe.cookingTime,
    difficulty: recipe.difficulty,
  };
}
