import { requireAuth } from "../lib/auth.js";
import { foodEntryDto, sumFoodEntries } from "../lib/dto.js";
import { asObject, formatDate, optionalString, parseDate, parseMealType, requiredNumber, requiredString } from "../lib/validation.js";
async function diaryForDate(db, userId, date) {
    const entries = await db.foodEntry.findMany({ where: { userId, date }, orderBy: { createdAt: "asc" } });
    const grouped = { breakfast: [], lunch: [], dinner: [], snack: [] };
    entries.forEach((entry) => grouped[entry.mealType].push(foodEntryDto(entry)));
    return { date: formatDate(date), entries: entries.map(foodEntryDto), meals: grouped, totals: sumFoodEntries(entries) };
}
function entryData(body) {
    const nutrition = asObject(body.nutrition);
    return {
        date: parseDate(body.date),
        mealType: parseMealType(body.mealType),
        foodIdentifier: optionalString(body, "foodId", 300),
        foodName: requiredString(body, "foodName", 200),
        manufacturer: optionalString(body, "manufacturer", 200),
        servingAmount: requiredNumber(body, "amount", 0.01, 100_000),
        servingUnit: requiredString(body, "unit", 20),
        calories: requiredNumber(nutrition, "calories", 0, 100_000),
        carbs: requiredNumber(nutrition, "carbs", 0, 10_000),
        protein: requiredNumber(nutrition, "protein", 0, 10_000),
        fat: requiredNumber(nutrition, "fat", 0, 10_000),
        source: optionalString(body, "source", 50) ?? "user",
    };
}
export function registerDiaryRoutes(app, db, config) {
    app.get("/api/diary", async (request, reply) => {
        const user = await requireAuth(request, reply, db, config);
        if (!user)
            return;
        const query = request.query;
        return diaryForDate(db, user.id, parseDate(query.date));
    });
    app.post("/api/diary/entries", async (request, reply) => {
        const user = await requireAuth(request, reply, db, config);
        if (!user)
            return;
        const entry = await db.foodEntry.create({ data: { userId: user.id, ...entryData(asObject(request.body)) } });
        return reply.code(201).send({ entry: foodEntryDto(entry) });
    });
    app.patch("/api/diary/entries/:id", async (request, reply) => {
        const user = await requireAuth(request, reply, db, config);
        if (!user)
            return;
        const owned = await db.foodEntry.findFirst({ where: { id: request.params.id, userId: user.id } });
        if (!owned)
            return reply.code(404).send({ error: "food_entry_not_found" });
        const entry = await db.foodEntry.update({ where: { id: owned.id }, data: entryData(asObject(request.body)) });
        return { entry: foodEntryDto(entry) };
    });
    app.delete("/api/diary/entries/:id", async (request, reply) => {
        const user = await requireAuth(request, reply, db, config);
        if (!user)
            return;
        const owned = await db.foodEntry.findFirst({ where: { id: request.params.id, userId: user.id }, select: { id: true } });
        if (!owned)
            return reply.code(404).send({ error: "food_entry_not_found" });
        await db.foodEntry.delete({ where: { id: owned.id } });
        return reply.code(204).send();
    });
}
//# sourceMappingURL=diary.js.map