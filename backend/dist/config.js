export function loadConfig(env = process.env) {
    const sessionSecret = env.SESSION_SECRET?.trim();
    if (!sessionSecret || sessionSecret.length < 32) {
        throw new Error("SESSION_SECRET must be at least 32 characters");
    }
    return {
        nodeEnv: env.NODE_ENV ?? "development",
        port: Number.parseInt(env.PORT ?? "3001", 10),
        host: env.HOST ?? "0.0.0.0",
        sessionSecret,
        sessionTtlDays: Math.max(1, Number.parseInt(env.SESSION_TTL_DAYS ?? "30", 10)),
        mfdsApiKey: env.MFDS_FOOD_API_KEY?.trim() || undefined,
        mfdsApiUrl: env.MFDS_FOOD_API_URL?.trim() || "https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo02/getFoodNtrCpntDbInq02",
        aiApiKey: env.AI_API_KEY?.trim() || undefined,
        aiModel: env.AI_MODEL?.trim() || "gpt-5.6-terra",
    };
}
//# sourceMappingURL=config.js.map