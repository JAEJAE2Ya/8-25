import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { buildApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";
import { hashSessionToken, SESSION_COOKIE } from "../src/lib/auth.js";

const secret = "test-session-secret-that-is-longer-than-thirty-two-characters";
const token = "user-food-session-token";
const config: AppConfig = {
  nodeEnv: "test",
  port: 0,
  host: "127.0.0.1",
  sessionSecret: secret,
  sessionTtlDays: 30,
  mfdsApiUrl: "https://example.invalid",
  aiModel: "test-model",
};

type UpsertArgs = {
  where: { userId_normalizedName: { userId: string; normalizedName: string } };
  create: Record<string, unknown>;
  update: Record<string, unknown>;
};

test("repeated user-food creation updates the same normalized food", async () => {
  const upserts: UpsertArgs[] = [];
  const db = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => where.tokenHash === hashSessionToken(token, secret)
        ? {
            id: "session-food",
            expiresAt: new Date(Date.now() + 60_000),
            user: { id: "user-food", email: "food@example.com", nickname: "음식사용자", avatarUrl: null, createdAt: new Date() },
          }
        : null,
      delete: async () => undefined,
    },
    userFood: {
      upsert: async (args: UpsertArgs) => {
        upserts.push(args);
        return {
          id: "saved-food",
          userId: "user-food",
          name: String(args.update.name),
          normalizedName: String(args.update.normalizedName),
          manufacturer: null,
          referenceAmount: Number(args.update.referenceAmount),
          servingUnit: String(args.update.servingUnit),
          calories: Number(args.update.calories),
          carbs: Number(args.update.carbs),
          protein: Number(args.update.protein),
          fat: Number(args.update.fat),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
    },
  } as unknown as PrismaClient;

  const app = await buildApp({ db, config, logger: false });
  const request = {
    method: "POST" as const,
    url: "/api/foods/user",
    headers: { cookie: `${SESSION_COOKIE}=${token}` },
    payload: {
      name: "  민재표 계란후라이  ",
      referenceAmount: 100,
      unit: "g",
      nutrition: { calories: 180, carbs: 1, protein: 13, fat: 14 },
    },
  };

  const first = await app.inject(request);
  const second = await app.inject(request);

  assert.equal(first.statusCode, 201);
  assert.equal(second.statusCode, 201);
  assert.equal(first.json().food.id, "user:saved-food");
  assert.equal(second.json().food.id, "user:saved-food");
  assert.equal(upserts.length, 2);
  assert.deepEqual(upserts[0]?.where, {
    userId_normalizedName: { userId: "user-food", normalizedName: "민재표 계란후라이" },
  });
  assert.equal(upserts[0]?.create.name, "민재표 계란후라이");
  assert.equal(upserts[0]?.update.calories, 180);

  await app.close();
});
