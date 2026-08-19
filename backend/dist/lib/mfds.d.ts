import type { AppConfig } from "../config.js";
export type NormalizedFood = {
    id: string;
    name: string;
    manufacturer?: string;
    referenceAmount: number;
    unit: string;
    nutrition: {
        calories: number;
        carbs: number;
        protein: number;
        fat: number;
    };
    source: "mfds" | "user";
};
export declare function searchMfds(query: string, config: AppConfig): Promise<{
    foods: NormalizedFood[];
    warning: string;
} | {
    foods: NormalizedFood[];
    warning?: undefined;
}>;
