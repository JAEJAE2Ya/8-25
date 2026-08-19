import type { FoodEntry, PlannedMeal } from "@prisma/client";
import { formatDate } from "./validation.js";

const rounded = (value: number) => Math.round(value * 10) / 10;

export function nutrition(calories: number, carbs: number, protein: number, fat: number) {
  return { calories: rounded(calories), carbs: rounded(carbs), protein: rounded(protein), fat: rounded(fat) };
}

export function foodEntryDto(entry: FoodEntry) {
  return {
    id: entry.id,
    date: formatDate(entry.date),
    mealType: entry.mealType,
    foodId: entry.foodIdentifier ?? undefined,
    foodName: entry.foodName,
    manufacturer: entry.manufacturer ?? undefined,
    amount: entry.servingAmount,
    unit: entry.servingUnit,
    nutrition: nutrition(entry.calories, entry.carbs, entry.protein, entry.fat),
    source: entry.source,
    status: "consumed" as const,
    createdAt: entry.createdAt.toISOString(),
  };
}

export function plannedMealDto(item: PlannedMeal) {
  return {
    id: item.id,
    recipeId: item.recipeExternalId ?? item.recipeId ?? "",
    recipeName: item.recipeName,
    date: formatDate(item.date),
    mealType: item.mealType,
    nutrition: nutrition(item.calories, item.carbs, item.protein, item.fat),
    status: "planned" as const,
  };
}

export function sumFoodEntries(entries: FoodEntry[]) {
  return nutrition(
    entries.reduce((sum, item) => sum + item.calories, 0),
    entries.reduce((sum, item) => sum + item.carbs, 0),
    entries.reduce((sum, item) => sum + item.protein, 0),
    entries.reduce((sum, item) => sum + item.fat, 0),
  );
}
