import type { FoodSearchResult } from "./types";

type PublicFoodRow = Record<string, unknown>;

const text = (row: PublicFoodRow, ...keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return undefined;
};

const number = (row: PublicFoodRow, ...keys: string[]) => {
  const value = text(row, ...keys);
  if (!value) return 0;
  const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

export function normalizePublicFood(row: PublicFoodRow): FoodSearchResult | null {
  const id = text(row, "FOOD_CD", "foodCd", "food_code", "NUM");
  const name = text(row, "FOOD_NM_KR", "FOOD_NM", "foodNm", "food_name");
  if (!id || !name) return null;

  const amountText = text(row, "SERVING_SIZE", "SERVING_WT", "referenceAmount", "Z10500") ?? "100g";
  const servingSize = Number.parseFloat(amountText.replace(/[^0-9.]/g, "")) || 100;
  const servingUnit = amountText.toLocaleLowerCase().includes("ml") ? "ml" : "g";

  return {
    id: `public-${id}`,
    name,
    manufacturer: text(row, "MFR_NM", "MAKER_NM", "companyNm", "manufacturer"),
    category: text(row, "FOOD_CAT1_NM", "FOOD_CLASS_NM", "foodCategory"),
    referenceAmount: amountText,
    servingSize,
    servingUnit,
    nutrition: {
      calories: number(row, "AMT_NUM1", "NUTR_CONT1", "energy"),
      carbs: number(row, "AMT_NUM6", "NUTR_CONT2", "carbohydrate"),
      protein: number(row, "AMT_NUM3", "NUTR_CONT3", "protein"),
      fat: number(row, "AMT_NUM4", "NUTR_CONT4", "fat"),
    },
    source: "public-api",
  };
}
