import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { buildApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";
import { hashSessionToken, SESSION_COOKIE } from "../src/lib/auth.js";

const secret = "test-session-secret-that-is-longer-than-thirty-two-characters";
const token = "user-b-session-token";
const userB = { id: "user-b", email: "b@example.com", nickname: "사용자B", avatarUrl: null, createdAt: new Date() };
const config: AppConfig = {
  nodeEnv: "test", port: 0, host: "127.0.0.1", sessionSecret: secret, sessionTtlDays: 30,
  mfdsApiUrl: "https://example.invalid", aiModel: "test-model",
};

function fakeDatabase(kind: "diary" | "post" | "comment") {
  let destructiveCalls = 0;
  const ownedLookup = async ({ where }: { where: { id: string; userId?: string; authorId?: string } }) => {
    const ownerField = kind === "post" ? where.authorId : where.userId;
    return where.id === `user-a-${kind}` && ownerField === "user-a" ? { id: where.id } : null;
  };
  const db = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => where.tokenHash === hashSessionToken(token, secret)
        ? { id: "session-b", expiresAt: new Date(Date.now() + 60_000), user: userB }
        : null,
      delete: async () => undefined,
    },
    foodEntry: { findFirst: ownedLookup, delete: async () => { destructiveCalls += 1; } },
    communityPost: { findFirst: ownedLookup, delete: async () => { destructiveCalls += 1; } },
    communityComment: { findFirst: ownedLookup, delete: async () => { destructiveCalls += 1; } },
  } as unknown as PrismaClient;
  return { db, destructiveCalls: () => destructiveCalls };
}

test("health endpoint is public", async () => {
  const fake = fakeDatabase("diary");
  const app = await buildApp({ db: fake.db, config, logger: false });
  const response = await app.inject({ method: "GET", url: "/health" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ok" });
  await app.close();
});

for (const scenario of [
  { kind: "diary" as const, path: "/api/diary/entries/user-a-diary" },
  { kind: "post" as const, path: "/api/community/posts/user-a-post" },
  { kind: "comment" as const, path: "/api/community/comments/user-a-comment" },
]) {
  test(`User B cannot delete User A ${scenario.kind}`, async () => {
    const fake = fakeDatabase(scenario.kind);
    const app = await buildApp({ db: fake.db, config, logger: false });
    const response = await app.inject({ method: "DELETE", url: scenario.path, headers: { cookie: `${SESSION_COOKIE}=${token}` } });
    assert.equal(response.statusCode, 404);
    assert.equal(fake.destructiveCalls(), 0);
    await app.close();
  });
}
