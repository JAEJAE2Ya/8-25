import { normalizePublicFood } from "./normalize-public-food";
import { rankFoods, type FoodSearchProvider } from "./types";

type PublicResponse = {
  body?: { items?: unknown[] };
  response?: { body?: { items?: unknown[] | { item?: unknown[] } } };
};

export class PublicFoodNutritionApiProvider implements FoodSearchProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseUrl = process.env.PUBLIC_FOOD_API_BASE_URL
      || "https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo02/getFoodNtrCpntDbInq02";
  }

  private async request(params: Record<string, string>) {
    const url = new URL(this.baseUrl);
    url.searchParams.set("serviceKey", this.apiKey);
    url.searchParams.set("type", "json");
    url.searchParams.set("pageNo", "1");
    url.searchParams.set("numOfRows", "50");
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

    const response = await fetch(url, { signal: AbortSignal.timeout(8_000), cache: "no-store" });
    if (!response.ok) throw new Error(`Public food API failed: ${response.status}`);
    const data = await response.json() as PublicResponse;
    const nestedItems = data.response?.body?.items;
    const rows = Array.isArray(data.body?.items)
      ? data.body.items
      : Array.isArray(nestedItems)
        ? nestedItems
        : nestedItems && "item" in nestedItems && Array.isArray(nestedItems.item)
          ? nestedItems.item
          : [];
    return rows.map((row) => normalizePublicFood(row as Record<string, unknown>)).filter((food): food is NonNullable<typeof food> => Boolean(food));
  }

  async searchFoods(query: string) {
    return rankFoods(await this.request({ FOOD_NM_KR: query }), query);
  }

  async getFoodDetail(foodId: string) {
    const id = foodId.replace(/^public-/, "");
    return (await this.request({ FOOD_CD: id }))[0] ?? null;
  }
}
