import type { PrismaClient } from "@prisma/client";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { AppConfig } from "../config.js";
export declare const SESSION_COOKIE = "mealfit_session";
export type AuthUser = {
    id: string;
    email: string;
    nickname: string;
    avatarUrl: string | null;
    createdAt: Date;
};
export declare function hashSessionToken(token: string, secret: string): string;
export declare function createSession(db: PrismaClient, userId: string, reply: FastifyReply, config: AppConfig): Promise<void>;
export declare function getAuthUser(request: FastifyRequest, db: PrismaClient, config: AppConfig): Promise<AuthUser | null>;
export declare function requireAuth(request: FastifyRequest, reply: FastifyReply, db: PrismaClient, config: AppConfig): Promise<AuthUser | null>;
export declare function destroySession(request: FastifyRequest, reply: FastifyReply, db: PrismaClient, config: AppConfig): Promise<void>;
