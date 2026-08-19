import { formatDate } from "./validation.js";
const rounded = (value) => Math.round(value * 10) / 10;
export function nutrition(calories, carbs, protein, fat) {
    return { calories: rounded(calories), carbs: rounded(carbs), protein: rounded(protein), fat: rounded(fat) };
}
export function foodEntryDto(entry) {
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
        status: "consumed",
        createdAt: entry.createdAt.toISOString(),
    };
}
export function plannedMealDto(item) {
    return {
        id: item.id,
        recipeId: item.recipeExternalId ?? item.recipeId ?? "",
        recipeName: item.recipeName,
        date: formatDate(item.date),
        mealType: item.mealType,
        nutrition: nutrition(item.calories, item.carbs, item.protein, item.fat),
        status: "planned",
    };
}
export function sumFoodEntries(entries) {
    return nutrition(entries.reduce((sum, item) => sum + item.calories, 0), entries.reduce((sum, item) => sum + item.carbs, 0), entries.reduce((sum, item) => sum + item.protein, 0), entries.reduce((sum, item) => sum + item.fat, 0));
}
//# sourceMappingURL=dto.js.map