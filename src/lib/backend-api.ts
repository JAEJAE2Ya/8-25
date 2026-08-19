import type { Meal, Nutrition } from "@/lib/data";
import type { FoodSearchResult, UserCreatedFood } from "@/services/food-search/types";

export class BackendError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

export async function backendFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/backend-api${path}`, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string };
    throw new BackendError(response.status, data.error ?? `http_${response.status}`);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export type AuthUser = { id: string; email: string; nickname: string; avatarUrl: string | null; createdAt: string };
export type BackendFood = {
  favoriteId?: string; id: string; name: string; manufacturer?: string; referenceAmount: number; unit: string;
  nutrition: Nutrition; source: "mfds" | "user" | string;
};
export type FavoriteFood = FoodSearchResult & { favoriteId?: string };

export function toFood(food: BackendFood): FavoriteFood {
  return {
    favoriteId: food.favoriteId,
    id: food.id,
    name: food.name,
    manufacturer: food.manufacturer,
    referenceAmount: `${food.referenceAmount}${food.unit}`,
    servingSize: food.referenceAmount,
    servingUnit: food.unit,
    nutrition: food.nutrition,
    source: food.source === "user" ? "user-created" : "public-api",
    ...(food.source === "user" ? { category: "직접 등록" } : {}),
  };
}

export function toUserFood(food: BackendFood): UserCreatedFood {
  return { ...toFood(food), source: "user-created", createdAt: new Date().toISOString() };
}

export type CommunityComment = {
  id: string; content: string; author: { id: string; nickname: string; avatar: string | null };
  mine: boolean; createdAt: string;
};
export type CommunityPost = {
  id: string; author: { id: string; nickname: string; avatar: string | null }; mealName: string; caption: string;
  imageUrl: string | null; nutrition: Nutrition; recipe: (Meal & { externalId?: string }) | null;
  likeCount: number; commentCount: number; likedByMe: boolean; mine: boolean; createdAt: string;
};
