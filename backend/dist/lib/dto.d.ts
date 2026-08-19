import type { FoodEntry, PlannedMeal } from "@prisma/client";
export declare function nutrition(calories: number, carbs: number, protein: number, fat: number): {
    calories: number;
    carbs: number;
    protein: number;
    fat: number;
};
export declare function foodEntryDto(entry: FoodEntry): {
    id: string;
    date: string;
    mealType: import("@prisma/client").$Enums.MealType;
    foodId: string | undefined;
    foodName: string;
    manufacturer: string | undefined;
    amount: number;
    unit: string;
    nutrition: {
        calories: number;
        carbs: number;
        protein: number;
        fat: number;
    };
    source: string;
    status: "consumed";
    createdAt: string;
};
export declare function plannedMealDto(item: PlannedMeal): {
    id: string;
    recipeId: string;
    recipeName: string;
    date: string;
    mealType: import("@prisma/client").$Enums.MealType;
    nutrition: {
        calories: number;
        carbs: number;
        protein: number;
        fat: number;
    };
    status: "planned";
};
export declare function sumFoodEntries(entries: FoodEntry[]): {
    calories: number;
    carbs: number;
    protein: number;
    fat: number;
};
