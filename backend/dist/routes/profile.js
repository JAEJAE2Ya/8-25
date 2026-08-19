import { requireAuth } from "../lib/auth.js";
import { asObject, optionalNumber, optionalString } from "../lib/validation.js";
const profileDto = (profile) => ({
    dailyCalories: profile.dailyCalories,
    carbsTarget: profile.carbsTarget,
    proteinTarget: profile.proteinTarget,
    fatTarget: profile.fatTarget,
    allergies: profile.allergies,
    foodPreferences: profile.foodPreferences,
});
export function registerProfileRoutes(app, db, config) {
    app.get("/api/profile/nutrition", async (request, reply) => {
        const user = await requireAuth(request, reply, db, config);
        if (!user)
            return;
        const profile = await db.userNutritionProfile.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
        return { profile: profileDto(profile) };
    });
    app.patch("/api/profile/nutrition", async (request, reply) => {
        const user = await requireAuth(request, reply, db, config);
        if (!user)
            return;
        const body = asObject(request.body);
        const current = await db.userNutritionProfile.findUnique({ where: { userId: user.id } });
        const profile = await db.userNutritionProfile.upsert({
            where: { userId: user.id },
            create: {
                userId: user.id,
                dailyCalories: Math.round(optionalNumber(body, "dailyCalories", 2000, 800, 5000)),
                carbsTarget: optionalNumber(body, "carbsTarget", 250, 0, 1000),
                proteinTarget: optionalNumber(body, "proteinTarget", 150, 0, 500),
                fatTarget: optionalNumber(body, "fatTarget", 44, 0, 300),
                allergies: optionalString(body, "allergies", 1000),
                foodPreferences: optionalString(body, "foodPreferences", 1000),
            },
            update: {
                dailyCalories: Math.round(optionalNumber(body, "dailyCalories", current?.dailyCalories ?? 2000, 800, 5000)),
                carbsTarget: optionalNumber(body, "carbsTarget", current?.carbsTarget ?? 250, 0, 1000),
                proteinTarget: optionalNumber(body, "proteinTarget", current?.proteinTarget ?? 150, 0, 500),
                fatTarget: optionalNumber(body, "fatTarget", current?.fatTarget ?? 44, 0, 300),
                allergies: body.allergies === undefined ? current?.allergies : optionalString(body, "allergies", 1000),
                foodPreferences: body.foodPreferences === undefined ? current?.foodPreferences : optionalString(body, "foodPreferences", 1000),
            },
        });
        return { profile: profileDto(profile) };
    });
}
//# sourceMappingURL=profile.js.map