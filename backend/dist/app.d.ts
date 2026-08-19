import { type PrismaClient } from "@prisma/client";
import Fastify from "fastify";
import { type AppConfig } from "./config.js";
type BuildAppOptions = {
    db?: PrismaClient;
    config?: AppConfig;
    logger?: boolean;
};
export declare function buildApp(options?: BuildAppOptions): Promise<Fastify.FastifyInstance<import("http").Server<typeof import("http").IncomingMessage, typeof import("http").ServerResponse>, import("http").IncomingMessage, import("http").ServerResponse<import("http").IncomingMessage>, Fastify.FastifyBaseLogger, Fastify.FastifyTypeProviderDefault>>;
export {};
