const text = (row, ...keys) => {
    for (const key of keys) {
        const value = row[key];
        if (typeof value === "string" && value.trim())
            return value.trim();
        if (typeof value === "number")
            return String(value);
    }
    return undefined;
};
const number = (row, ...keys) => {
    const value = text(row, ...keys);
    if (!value)
        return 0;
    const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
};
export function normalizeMfdsFood(row) {
    const id = text(row, "FOOD_CD", "foodCd", "food_code", "NUM");
    const name = text(row, "FOOD_NM_KR", "FOOD_NM", "foodNm", "food_name");
    if (!id || !name)
        return null;
    const amountText = text(row, "SERVING_SIZE", "SERVING_WT", "referenceAmount", "Z10500") ?? "100g";
    return {
        id: `mfds:${id}`,
        name,
        manufacturer: text(row, "MFR_NM", "MAKER_NM", "companyNm", "manufacturer"),
        referenceAmount: Number.parseFloat(amountText.replace(/[^0-9.]/g, "")) || 100,
        unit: amountText.toLowerCase().includes("ml") ? "ml" : "g",
        nutrition: {
            calories: number(row, "AMT_NUM1", "NUTR_CONT1", "energy"),
            carbs: number(row, "AMT_NUM6", "NUTR_CONT2", "carbohydrate"),
            protein: number(row, "AMT_NUM3", "NUTR_CONT3", "protein"),
            fat: number(row, "AMT_NUM4", "NUTR_CONT4", "fat"),
        },
        source: "mfds",
    };
}
export async function searchMfds(query, config) {
    if (!config.mfdsApiKey)
        return { foods: [], warning: "mfds_not_configured" };
    const url = new URL(config.mfdsApiUrl);
    url.searchParams.set("serviceKey", config.mfdsApiKey);
    url.searchParams.set("type", "json");
    url.searchParams.set("pageNo", "1");
    url.searchParams.set("numOfRows", "50");
    url.searchParams.set("FOOD_NM_KR", query);
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok)
        throw new Error(`MFDS request failed with ${response.status}`);
    const data = await response.json();
    const nested = data.response?.body?.items;
    const rows = Array.isArray(data.body?.items)
        ? data.body.items
        : Array.isArray(nested)
            ? nested
            : nested && "item" in nested && Array.isArray(nested.item)
                ? nested.item
                : [];
    return { foods: rows.map((row) => normalizeMfdsFood(row)).filter((food) => Boolean(food)) };
}
//# sourceMappingURL=mfds.js.map