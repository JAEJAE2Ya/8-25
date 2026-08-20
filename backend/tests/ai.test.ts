import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { buildApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";
import { hashSessionToken, SESSION_COOKIE } from "../src/lib/auth.js";
import { parsePreferenceList } from "../src/routes/ai.js";

const secret = "test-session-secret-that-is-longer-than-thirty-two-characters";
const token = "ai-session-token";
const config: AppConfig = {
  nodeEnv: "test",
  port: 0,
  host: "127.0.0.1",
  sessionSecret: secret,
  sessionTtlDays: 30,
  mfdsApiUrl: "https://example.invalid",
  aiApiKey: "test-api-key",
  aiModel: "test-model",
};

function fakeDatabase() {
  return {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => where.tokenHash === hashSessionToken(token, secret)
        ? {
            id: "session-ai",
            expiresAt: new Date(Date.now() + 60_000),
            user: { id: "user-ai", email: "ai@example.com", nickname: "AI사용자", avatarUrl: null, createdAt: new Date() },
          }
        : null,
      delete: async () => undefined,
    },
    userNutritionProfile: {
      findUnique: async () => ({ allergies: "우유, 새우" }),
    },
  } as unknown as PrismaClient;
}

test("preference lists split, normalize, and deduplicate user input", () => {
  assert.deepEqual(parsePreferenceList(" 달걀 4개, 바나나 2개\n오트밀，달걀 4개 "), ["달걀 4개", "바나나 2개", "오트밀"]);
});

test("meal-plan prompt prioritizes the user's available ingredients", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, unknown> | undefined;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({
      output_text: JSON.stringify({ days: [{ day: 1 }, { day: 2 }, { day: 3 }], shoppingSummary: {} }),
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const app = await buildApp({ db: fakeDatabase(), config, logger: false });
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/ai/meal-plan",
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
      payload: {
        target: { calories: 2000, carbs: 250, protein: 150, fat: 44 },
        preferences: {
          cuisine: "한식",
          goal: "균형식",
          avoidFoods: "버섯",
          availableIngredients: " 달걀 4개, 바나나 2개\n오트밀, 달걀 4개 ",
        },
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().mode, "live");
    assert.ok(requestBody);
    const input = String(requestBody.input);
    assert.match(input, /\["달걀 4개","바나나 2개","오트밀"\]/);
    assert.match(input, /\["버섯","우유","새우"\]/);
    assert.match(input, /보유 식재료가 있으면 9끼 전반에서 가능한 한 많이 활용/);
    assert.match(input, /보유 재료 활용/);
    assert.equal((input.match(/달걀 4개/g) ?? []).length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    await app.close();
  }
});

test("meal-plan rejects recipes that contain a saved excluded food", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    output_text: JSON.stringify({
      days: [
        { day: 1, meals: [{ name: "우유 오트밀", ingredients: [{ name: "우유" }] }] },
        { day: 2, meals: [] },
        { day: 3, meals: [] },
      ],
      shoppingSummary: {},
    }),
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  const app = await buildApp({ db: fakeDatabase(), config, logger: false });
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/ai/meal-plan",
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
      payload: { target: { calories: 2000, carbs: 250, protein: 150, fat: 44 }, preferences: {} },
    });

    assert.equal(response.statusCode, 502);
    assert.equal(response.json().error, "ai_exclusion_violation");
  } finally {
    globalThis.fetch = originalFetch;
    await app.close();
  }
});
