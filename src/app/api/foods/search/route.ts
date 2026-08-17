import { NextResponse } from "next/server";
import { getFoodSearchProvider } from "@/services/food-search";
import { MockFoodSearchProvider } from "@/services/food-search/mock-provider";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 1) return NextResponse.json({ foods: [], provider: "none" });

  try {
    const provider = getFoodSearchProvider();
    const foods = await provider.searchFoods(query);
    return NextResponse.json(
      { foods, provider: foods[0]?.source === "public-api" ? "public-api" : "mock" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    const foods = await new MockFoodSearchProvider().searchFoods(query);
    return NextResponse.json(
      { foods, provider: "mock", warning: "public_api_unavailable" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
