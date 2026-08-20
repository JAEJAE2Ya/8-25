import assert from "node:assert/strict";
import test from "node:test";
import { normalizeMfdsFood } from "../src/lib/mfds.js";

test("MFDS nutrition fields map carbohydrates, protein, and fat correctly", () => {
  const food = normalizeMfdsFood({
    FOOD_CD: "R108-001010001-0000",
    FOOD_NM_KR: "감_단감_생것",
    SERVING_SIZE: "100g",
    AMT_NUM1: "57.00",
    AMT_NUM3: "0.38",
    AMT_NUM4: "0.12",
    AMT_NUM6: "15.13",
    AMT_NUM8: "1.90",
  });

  assert.ok(food);
  assert.deepEqual(food.nutrition, {
    calories: 57,
    carbs: 15.13,
    protein: 0.38,
    fat: 0.12,
  });
});

test("legacy nutrition field names remain supported", () => {
  const food = normalizeMfdsFood({
    FOOD_CD: "legacy-1",
    FOOD_NM_KR: "기존 응답",
    NUTR_CONT1: "100",
    NUTR_CONT2: "20",
    NUTR_CONT3: "5",
    NUTR_CONT4: "2",
  });

  assert.ok(food);
  assert.deepEqual(food.nutrition, { calories: 100, carbs: 20, protein: 5, fat: 2 });
});
