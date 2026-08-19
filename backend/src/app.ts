import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { Prisma, type PrismaClient } from "@prisma/client";
import Fastify from "fastify";
import { loadConfig, type AppConfig } from "./config.js";
import { prisma } from "./lib/prisma.js";
import { ValidationError } from "./lib/validation.js";
import { registerAiRoutes } from "./routes/ai.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerCommunityRoutes } from "./routes/community.js";
import { registerDiaryRoutes } from "./routes/diary.js";
import { registerFavoriteRoutes } from "./routes/favorites.js";
import { registerFoodRoutes } from "./routes/foods.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerPlannedMealRoutes } from "./routes/planned-meals.js";
import { registerProfileRoutes } from "./routes/profile.js";

type BuildAppOptions = {
  db?: PrismaClient;
  config?: AppConfig;
  logger?: boolean;
};

export async function buildApp(options: BuildAppOptions = {}) {
  const db = options.db ?? prisma;
  const config = options.config ?? loadConfig();
  const app = Fastify({
    logger: options.logger ?? config.nodeEnv !== "test",
    trustProxy: true,
    bodyLimit: 1_000_000,
  });

  await app.register(cookie);
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, {
    global: true,
    max: 180,
    timeWindow: "1 minute",
    keyGenerator: (request) => request.ip,
  });

  registerHealthRoutes(app);
  registerAuthRoutes(app, db, config);
  registerProfileRoutes(app, db, config);
  registerDiaryRoutes(app, db, config);
  registerPlannedMealRoutes(app, db, config);
  registerFoodRoutes(app, db, config);
  registerFavoriteRoutes(app, db, config);
  registerCommunityRoutes(app, db, config);
  registerAiRoutes(app, db, config);

  app.setNotFoundHandler(async (_request, reply) => {
    await reply.code(404).send({ error: "not_found" });
  });

  app.setErrorHandler(async (error, request, reply) => {
    if (error instanceof ValidationError) {
      await reply.code(400).send({ error: "invalid_request", message: error.message });
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      await reply.code(409).send({ error: "already_exists" });
      return;
    }
    const httpError = error as { statusCode?: unknown; code?: string; message?: string };
    if (typeof httpError.statusCode === "number" && httpError.statusCode < 500) {
      await reply.code(httpError.statusCode).send({
        error: httpError.code ?? "request_error",
        message: httpError.message ?? "Request failed",
      });
      return;
    }
    request.log.error({ err: error }, "request failed");
    await reply.code(500).send({ error: "internal_server_error" });
  });

  return app;
}
