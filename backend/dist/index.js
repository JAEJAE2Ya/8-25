import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { prisma } from "./lib/prisma.js";
const config = loadConfig();
const app = await buildApp({ config });
const close = async () => {
    await app.close();
    await prisma.$disconnect();
};
process.on("SIGINT", close);
process.on("SIGTERM", close);
try {
    await app.listen({ port: config.port, host: config.host });
}
catch (error) {
    app.log.error(error);
    await close();
    process.exit(1);
}
//# sourceMappingURL=index.js.map