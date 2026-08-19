import { requireAuth } from "../lib/auth.js";
import { persistRecipe, recipeDto } from "../lib/recipe.js";
import { asObject, optionalString, requiredNumber, requiredString } from "../lib/validation.js";
const favoriteFoodDto = (item) => ({
    favoriteId: item.id,
    id: item.foodIdentifier,
    name: item.foodName,
    manufacturer: item.manufacturer ?? undefined,
    referenceAmount: item.referenceAmount,
    unit: item.servingUnit,
    nutrition: { calories: item.calories, carbs: item.carbs, protein: item.protein, fat: item.fat },
    source: item.source,
});
export function registerFavoriteRoutes(app, db, config) {
    app.get("/api/favorites/foods", async (request, reply) => {
        const user = await requireAuth(request, reply, db, config);
        if (!user)
            return;
        const foods = await db.favoriteFood.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
        return { foods: foods.map(favoriteFoodDto) };
    });
    app.post("/api/favorites/foods", async (request, reply) => {
        const user = await requireAuth(request, reply, db, config);
        if (!user)
            return;
        const body = asObject(request.body);
        const nutrition = asObject(body.nutrition);
        const foodIdentifier = requiredString(body, "id", 300);
        const food = await db.favoriteFood.upsert({
            where: { userId_foodIdentifier: { userId: user.id, foodIdentifier } },
            create: {
                userId: user.id,
                foodIdentifier,
                foodName: requiredString(body, "name", 200),
                manufacturer: optionalString(body, "manufacturer", 200),
                referenceAmount: requiredNumber(body, "referenceAmount", 0.01, 100_000),
                servingUnit: requiredString(body, "unit", 20),
                calories: requiredNumber(nutrition, "calories", 0, 100_000),
                carbs: requiredNumber(nutrition, "carbs", 0, 10_000),
                protein: requiredNumber(nutrition, "protein", 0, 10_000),
                fat: requiredNumber(nutrition, "fat", 0, 10_000),
                source: optionalString(body, "source", 50) ?? "mfds",
            },
            update: {
                foodName: requiredString(body, "name", 200),
                manufacturer: optionalString(body, "manufacturer", 200),
                referenceAmount: requiredNumber(body, "referenceAmount", 0.01, 100_000),
                servingUnit: requiredString(body, "unit", 20),
                calories: requiredNumber(nutrition, "calories", 0, 100_000),
                carbs: requiredNumber(nutrition, "carbs", 0, 10_000),
                protein: requiredNumber(nutrition, "protein", 0, 10_000),
                fat: requiredNumber(nutrition, "fat", 0, 10_000),
            },
        });
        return reply.code(201).send({ food: favoriteFoodDto(food) });
    });
    app.delete("/api/favorites/foods/:id", async (request, reply) => {
        const user = await requireAuth(request, reply, db, config);
        if (!user)
            return;
        const owned = await db.favoriteFood.findFirst({ where: { id: request.params.id, userId: user.id }, select: { id: true } });
        if (!owned)
            return reply.code(404).send({ error: "favorite_food_not_found" });
        await db.favoriteFood.delete({ where: { id: owned.id } });
        return reply.code(204).send();
    });
    app.get("/api/favorites/recipes", async (request, reply) => {
        const user = await requireAuth(request, reply, db, config);
        if (!user)
            return;
        const favorites = await db.favoriteRecipe.findMany({ where: { userId: user.id }, include: { recipe: true }, orderBy: { createdAt: "desc" } });
        return { recipes: favorites.map((item) => ({ favoriteId: item.id, ...recipeDto(item.recipe) })) };
    });
    app.post("/api/favorites/recipes", async (request, reply) => {
        const user = await requireAuth(request, reply, db, config);
        if (!user)
            return;
        const recipe = await persistRecipe(db, user.id, request.body);
        const favorite = await db.favoriteRecipe.upsert({
            where: { userId_recipeId: { userId: user.id, recipeId: recipe.id } },
            create: { userId: user.id, recipeId: recipe.id },
            update: {},
            include: { recipe: true },
        });
        return reply.code(201).send({ recipe: { favoriteId: favorite.id, ...recipeDto(favorite.recipe) } });
    });
    app.delete("/api/favorites/recipes/:id", async (request, reply) => {
        const user = await requireAuth(request, reply, db, config);
        if (!user)
            return;
        const owned = await db.favoriteRecipe.findFirst({ where: { id: request.params.id, userId: user.id }, select: { id: true } });
        if (!owned)
            return reply.code(404).send({ error: "favorite_recipe_not_found" });
        await db.favoriteRecipe.delete({ where: { id: owned.id } });
        return reply.code(204).send();
    });
}
//# sourceMappingURL=favorites.js.map