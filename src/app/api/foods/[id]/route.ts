import { NextResponse } from "next/server";
import { getFoodSearchProvider } from "@/services/food-search";
import { MockFoodSearchProvider } from "@/services/food-search/mock-provider";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const food = await getFoodSearchProvider().getFoodDetail(id);
    if (food) return NextResponse.json({ food });
  } catch {
    // Fall through to mock so food recording remains available.
  }

  const food = await new MockFoodSearchProvider().getFoodDetail(id);
  if (!food) return NextResponse.json({ error: "food_not_found" }, { status: 404 });
  return NextResponse.json({ food, warning: "public_api_unavailable" });
}
