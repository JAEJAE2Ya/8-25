import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config.js";
export declare function registerDiaryRoutes(app: FastifyInstance, db: PrismaClient, config: AppConfig): void;
