import type { Nutrition } from "@/lib/data";

export type FoodSource = "public-api" | "user-created" | "mock";

export interface FoodSearchResult {
  id: string;
  name: string;
  manufacturer?: string;
  category?: string;
  referenceAmount?: string;
  servingSize?: number;
  servingUnit?: string;
  nutrition: Nutrition;
  source: FoodSource;
}

export type FoodDetail = FoodSearchResult;

export interface FoodSearchProvider {
  searchFoods(query: string): Promise<FoodSearchResult[]>;
  getFoodDetail(foodId: string): Promise<FoodDetail | null>;
}

export interface UserCreatedFood extends FoodSearchResult {
  source: "user-created";
  createdAt: string;
}

export function rankFoods(foods: FoodSearchResult[], query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  if (!normalizedQuery) return foods;

  const score = (food: FoodSearchResult) => {
    const name = food.name.toLocaleLowerCase("ko-KR");
    const manufacturer = food.manufacturer?.toLocaleLowerCase("ko-KR") ?? "";
    if (name === normalizedQuery) return 0;
    if (name.startsWith(normalizedQuery)) return 1;
    if (name.includes(normalizedQuery)) return 2;
    if (manufacturer.includes(normalizedQuery)) return 3;
    return 4;
  };

  return foods
    .filter((food) => score(food) < 4)
    .sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name, "ko"));
}

export function scaleNutrition(base: Nutrition, baseAmount: number, selectedAmount: number): Nutrition {
  const safeBase = Math.max(1, baseAmount);
  const ratio = Math.max(0, selectedAmount) / safeBase;
  const scaled = (value: number) => Math.round(value * ratio * 10) / 10;
  return {
    calories: Math.round(base.calories * ratio),
    carbs: scaled(base.carbs),
    protein: scaled(base.protein),
    fat: scaled(base.fat),
  };
}
