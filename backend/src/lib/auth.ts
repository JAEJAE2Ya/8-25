import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { AppConfig } from "../config.js";

export const SESSION_COOKIE = "mealfit_session";

export type AuthUser = {
  id: string;
  email: string;
  nickname: string;
  avatarUrl: string | null;
  createdAt: Date;
};

export function hashSessionToken(token: string, secret: string) {
  return createHash("sha256").update(`${secret}:${token}`).digest("hex");
}

export async function createSession(db: PrismaClient, userId: string, reply: FastifyReply, config: AppConfig) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + config.sessionTtlDays * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { userId, tokenHash: hashSessionToken(token, config.sessionSecret), expiresAt } });
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function getAuthUser(request: FastifyRequest, db: PrismaClient, config: AppConfig): Promise<AuthUser | null> {
  const token = request.cookies[SESSION_COOKIE];
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashSessionToken(token, config.sessionSecret) },
    select: {
      id: true,
      expiresAt: true,
      user: { select: { id: true, email: true, nickname: true, avatarUrl: true, createdAt: true } },
    },
  });
  if (!session) return null;
  if (session.expiresAt <= new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  return session.user;
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply, db: PrismaClient, config: AppConfig) {
  const user = await getAuthUser(request, db, config);
  if (!user) {
    await reply.code(401).send({ error: "authentication_required" });
    return null;
  }
  return user;
}

export async function destroySession(request: FastifyRequest, reply: FastifyReply, db: PrismaClient, config: AppConfig) {
  const token = request.cookies[SESSION_COOKIE];
  if (token) await db.session.deleteMany({ where: { tokenHash: hashSessionToken(token, config.sessionSecret) } });
  reply.clearCookie(SESSION_COOKIE, { path: "/", httpOnly: true, secure: config.nodeEnv === "production", sameSite: "lax" });
}
