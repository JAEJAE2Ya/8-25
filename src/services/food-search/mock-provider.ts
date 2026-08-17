import { mockFoods } from "./mock-foods";
import { rankFoods, type FoodSearchProvider } from "./types";

export class MockFoodSearchProvider implements FoodSearchProvider {
  async searchFoods(query: string) {
    return rankFoods(mockFoods, query).slice(0, 30);
  }

  async getFoodDetail(foodId: string) {
    return mockFoods.find((food) => food.id === foodId) ?? null;
  }
}
