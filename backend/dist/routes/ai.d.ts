import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import type { AppConfig } from "../config.js";
export declare function parsePreferenceList(value: unknown, maxItems?: number): string[];
export declare function registerAiRoutes(app: FastifyInstance, db: PrismaClient, config: AppConfig): void;
