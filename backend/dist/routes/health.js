export function registerHealthRoutes(app) {
    app.get("/health", async () => ({ status: "ok" }));
}
//# sourceMappingURL=health.js.map