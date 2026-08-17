import { MockFoodSearchProvider } from "./mock-provider";
import { PublicFoodNutritionApiProvider } from "./public-provider";
import type { FoodSearchProvider } from "./types";

export function getFoodSearchProvider(): FoodSearchProvider {
  const enabled = process.env.PUBLIC_FOOD_API_ENABLED === "true";
  const apiKey = process.env.PUBLIC_FOOD_API_KEY;
  if (enabled && apiKey) return new PublicFoodNutritionApiProvider(apiKey);
  return new MockFoodSearchProvider();
}

export * from "./types";
