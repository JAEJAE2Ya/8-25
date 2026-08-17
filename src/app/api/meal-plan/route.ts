import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { mockMealPlan, type MealPlan } from "@/lib/data";

export const runtime = "nodejs";
export const maxDuration = 45;

const recentRequests = new Map<string, number[]>();

type MealPlanRequest = {
  target?: Record<string, number>;
  preferences?: Record<string, string>;
  excludeMealNames?: string[];
  variationSeed?: string;
};

function demoResponse(reason: string) {
  return NextResponse.json(
    { mode: "demo", reason, plan: mockMealPlan },
    { headers: { "Cache-Control": "no-store" } },
  );
}

const nutritionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["calories", "carbs", "protein", "fat"],
  properties: {
    calories: { type: "integer", minimum: 100 },
    carbs: { type: "integer", minimum: 0 },
    protein: { type: "integer", minimum: 0 },
    fat: { type: "integer", minimum: 0 },
  },
};

const ingredientSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "amount", "category"],
  properties: {
    name: { type: "string" },
    amount: { type: "string" },
    category: { type: "string", enum: ["protein", "vegetable", "carbohydrate", "sauce", "other"] },
  },
};

const mealSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "mealType", "name", "description", "emoji", "nutrition", "tags", "ingredients", "instructions", "cookingTimeMinutes", "difficulty"],
  properties: {
    id: { type: "string" },
    mealType: { type: "string", enum: ["breakfast", "lunch", "dinner"] },
    name: { type: "string" },
    description: { type: "string" },
    emoji: { type: "string" },
    nutrition: nutritionSchema,
    tags: { type: "array", minItems: 1, maxItems: 3, items: { type: "string" } },
    ingredients: { type: "array", minItems: 3, maxItems: 8, items: ingredientSchema },
    instructions: { type: "array", minItems: 3, maxItems: 5, items: { type: "string" } },
    cookingTimeMinutes: { type: "integer", minimum: 5, maximum: 60 },
    difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
  },
};

const mealPlanSchema = {
  type: "object",
  additionalProperties: false,
  required: ["days", "shoppingSummary"],
  properties: {
    days: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["day", "nutrition", "meals"],
        properties: {
          day: { type: "integer", minimum: 1, maximum: 3 },
          nutrition: nutritionSchema,
          meals: { type: "array", minItems: 3, maxItems: 3, items: mealSchema },
        },
      },
    },
    shoppingSummary: {
      type: "object",
      additionalProperties: false,
      required: ["uniqueIngredientCount", "reusedIngredientCount", "reusedIngredients"],
      properties: {
        uniqueIngredientCount: { type: "integer", minimum: 1 },
        reusedIngredientCount: { type: "integer", minimum: 1 },
        reusedIngredients: {
          type: "array",
          minItems: 3,
          maxItems: 8,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["ingredient", "totalAmount", "usedIn"],
            properties: {
              ingredient: { type: "string" },
              totalAmount: { type: "string" },
              usedIn: { type: "array", minItems: 1, items: { type: "string" } },
            },
          },
        },
      },
    },
  },
};

function isValidPlan(plan: MealPlan) {
  if (!plan || !Array.isArray(plan.days) || plan.days.length !== 3) return false;
  return plan.days.every((day, dayIndex) => {
    if (day.day !== dayIndex + 1 || !Array.isArray(day.meals) || day.meals.length !== 3) return false;
    const types = day.meals.map((meal) => meal.mealType);
    return types[0] === "breakfast" && types[1] === "lunch" && types[2] === "dinner";
  });
}

function getOutputText(data: Record<string, unknown>) {
  if (typeof data.output_text === "string") return data.output_text;
  const output = Array.isArray(data.output) ? data.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as { content?: unknown }).content) ? (item as { content: unknown[] }).content : [];
    for (const part of content) {
      if (part && typeof part === "object" && "text" in part && typeof (part as { text: unknown }).text === "string") return (part as { text: string }).text;
    }
  }
  return null;
}

export async function POST(request: Request) {
  let input: MealPlanRequest = {};
  try {
    input = await request.json();
  } catch {
    return demoResponse("invalid_request");
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) return demoResponse("missing_api_key");

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const recent = (recentRequests.get(forwarded) ?? []).filter((time) => now - time < 60_000);
  if (recent.length >= 4) return NextResponse.json({ error: "잠시 후 다시 시도해 주세요.", reason: "app_rate_limit" }, { status: 429 });
  recentRequests.set(forwarded, [...recent, now]);

  const target = {
    calories: Math.min(5000, Math.max(800, Number(input.target?.calories) || 2000)),
    carbs: Math.min(600, Math.max(20, Number(input.target?.carbs) || 220)),
    protein: Math.min(350, Math.max(20, Number(input.target?.protein) || 150)),
    fat: Math.min(200, Math.max(10, Number(input.target?.fat) || 60)),
  };
  const cuisine = String(input.preferences?.cuisine || "한식").slice(0, 20);
  const goal = String(input.preferences?.goal || "고단백").slice(0, 20);
  const avoidFoods = String(input.preferences?.avoidFoods || "없음").slice(0, 100);
  const excludedMealNames = Array.isArray(input.excludeMealNames)
    ? input.excludeMealNames.slice(0, 12).map((name) => String(name).slice(0, 50)).filter(Boolean)
    : [];
  const variationSeed = String(input.variationSeed || now).slice(0, 80);
  const safetyIdentifier = createHash("sha256").update(`mealfit:${forwarded}`).digest("hex").slice(0, 32);

  const prompt = `당신은 한국 사용자를 위한 실용적인 3일 식단 설계자입니다.
하루 목표: ${target.calories} kcal, 탄수화물 ${target.carbs}g, 단백질 ${target.protein}g, 지방 ${target.fat}g.
취향: ${cuisine}, 우선순위: ${goal}.
피해야 할 음식: ${avoidFoods}.
이번 생성의 변형 식별자: ${variationSeed}.
${excludedMealNames.length ? `직전 추천 메뉴 이름: ${excludedMealNames.join(", ")}. 이 메뉴들과 이름이나 주재료 조합이 같은 메뉴는 피하고, 확실히 다른 9끼를 제안하세요.` : "각 끼니는 서로 다른 메뉴로 구성하세요."}

정확히 3일, 매일 breakfast→lunch→dinner 순서로 3끼를 만드세요. 각 끼와 일일 합계는 목표의 약 ±10% 범위에서 현실적으로 맞추세요. 한국 마트에서 쉽게 구하는 재료를 쓰고, 닭고기·달걀·두부·양파·대파·채소처럼 여러 메뉴에 재사용할 수 있는 재료를 의도적으로 배치하세요. 9끼가 지나치게 반복되지는 않아야 합니다. 아침 25%, 점심 35%, 저녁 40% 정도로 열량을 분배하세요. 양은 1인분 기준으로 무리하지 않게 쓰고, 조리법은 짧고 실제로 실행 가능해야 합니다. 의료적 주장이나 치료 표현은 금지합니다. 영양 수치는 추정치로만 다루세요. id는 day1-breakfast 형식으로 고정하세요. emoji는 음식과 어울리는 이모지 하나를 사용하세요.`;

  const model = process.env.OPENAI_MODEL || "gpt-5.6";
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        input: prompt,
        reasoning: { effort: "low" },
        max_output_tokens: 6500,
        safety_identifier: safetyIdentifier,
        store: false,
        text: {
          verbosity: "low",
          format: { type: "json_schema", name: "three_day_meal_plan", strict: true, schema: mealPlanSchema },
        },
      }),
      signal: AbortSignal.timeout(40_000),
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) return demoResponse("openai_auth");
      if (response.status === 429) return demoResponse("openai_rate_limit");
      return demoResponse(`openai_http_${response.status}`);
    }
    const data = await response.json() as Record<string, unknown>;
    const text = getOutputText(data);
    if (!text) return demoResponse("invalid_output");
    let plan: MealPlan;
    try {
      plan = JSON.parse(text) as MealPlan;
    } catch {
      return demoResponse("invalid_output");
    }
    if (!isValidPlan(plan)) return demoResponse("invalid_output");
    return NextResponse.json(
      { mode: "live", model, plan },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return demoResponse("request_failed");
  }
}
