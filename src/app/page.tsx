"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  addNutrition,
  communitySeed,
  diaryMealTypeLabel,
  getAllMeals,
  getIngredientPurchaseUrl,
  getMeal,
  mealTypeLabel,
  mockMealPlan,
  shoppingItems,
  type Meal,
  type MealPlan,
  type MealType,
  type DiaryMealType,
  type FoodEntry,
  type Nutrition,
  type PlannedMeal,
} from "@/lib/data";
import { browserStorage } from "@/lib/storage";
import { rankFoods, scaleNutrition, type FoodSearchResult, type UserCreatedFood } from "@/services/food-search/types";

type Screen = "home" | "ai" | "community" | "favorites" | "my" | "shopping" | "food-search" | "food-detail" | "meal-editor" | "create-food";
type TargetKey = keyof Nutrition;
type TargetInputMode = "ratio" | "direct";
type MacroRatio = "5:3:2" | "4:4:2";
type TargetDraft = Record<TargetKey, string>;
type RecentFood = { food: FoodSearchResult; count: number; lastUsedAt: string };

const diaryMealTypes: DiaryMealType[] = ["breakfast", "lunch", "dinner", "snack"];
const mealIcons: Record<DiaryMealType, string> = { breakfast: "☀", lunch: "◐", dinner: "☾", snack: "◇" };

const macroRatios: Record<MacroRatio, { carbs: number; protein: number; fat: number; description: string }> = {
  "5:3:2": { carbs: 5, protein: 3, fat: 2, description: "균형 잡힌 일반 식단" },
  "4:4:2": { carbs: 4, protein: 4, fat: 2, description: "단백질을 높인 식단" },
};

function calculateTarget(calories: number, ratio: MacroRatio): Nutrition {
  const parts = macroRatios[ratio];
  return {
    calories,
    carbs: Math.round((calories * (parts.carbs / 10)) / 4),
    protein: Math.round((calories * (parts.protein / 10)) / 4),
    fat: Math.round((calories * (parts.fat / 10)) / 9),
  };
}

function toTargetDraft(target: Nutrition): TargetDraft {
  return Object.fromEntries(
    (Object.keys(target) as TargetKey[]).map((key) => [key, String(target[key])]),
  ) as TargetDraft;
}

function aiReasonMessage(reason: string | null) {
  if (reason === "missing_api_key") return "Vercel에 OPENAI_API_KEY가 없어 데모 식단을 표시했어요.";
  if (reason === "openai_auth") return "OpenAI API 키가 유효하지 않거나 권한이 없어요. Vercel 환경 변수를 확인해 주세요.";
  if (reason === "openai_rate_limit") return "OpenAI 사용 한도 또는 결제 상태 때문에 데모 식단을 표시했어요.";
  if (reason === "openai_model") return "설정한 AI 모델 이름을 사용할 수 없어요. Vercel의 OPENAI_MODEL을 확인해 주세요.";
  if (reason === "openai_bad_request") return "AI 요청 설정을 처리할 수 없어요. 배포된 코드와 모델 설정을 확인해 주세요.";
  if (reason === "openai_timeout") return "AI 생성 시간이 길어져 데모 식단으로 전환했어요. 잠시 후 다시 시도해 주세요.";
  if (reason === "app_rate_limit") return "짧은 시간에 요청이 많았어요. 잠시 후 다시 시도해 주세요.";
  if (reason === "invalid_output") return "AI 응답 형식이 올바르지 않아 데모 식단을 표시했어요.";
  return "AI 요청을 완료하지 못해 데모 식단을 표시했어요. Vercel 로그에서 API 상태를 확인해 주세요.";
}

const targetDefault = calculateTarget(2000, "5:3:2");
const loadingMessages = [
  "목표 영양소를 계산하고 있어요",
  "겹쳐서 사용할 수 있는 식재료를 찾고 있어요",
  "3일치 아침·점심·저녁을 조합하고 있어요",
];

const navItems: Array<{ id: Screen; icon: string; label: string }> = [
  { id: "home", icon: "⌂", label: "기록" },
  { id: "ai", icon: "✦", label: "AI 추천" },
  { id: "community", icon: "♧", label: "커뮤니티" },
  { id: "favorites", icon: "♡", label: "즐겨찾기" },
  { id: "my", icon: "○", label: "MY" },
];

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(base: Date, amount: number) {
  const date = new Date(base);
  date.setDate(date.getDate() + amount);
  return date;
}

function shortDate(date: Date) {
  return `${date.getMonth() + 1}.${date.getDate()}`;
}

function dateChoiceLabel(offset: number) {
  if (offset === 0) return "오늘";
  if (offset === 1) return "내일";
  if (offset === 2) return "모레";
  return "직접 선택";
}

function MacroRow({ nutrition, compact = false }: { nutrition: Nutrition; compact?: boolean }) {
  return (
    <div className={`macro-row ${compact ? "compact" : ""}`} aria-label="영양 정보">
      <span><b>탄</b> {nutrition.carbs}g</span>
      <span><b>단</b> {nutrition.protein}g</span>
      <span><b>지</b> {nutrition.fat}g</span>
    </div>
  );
}

function Header({ title, eyebrow, onBack, action }: { title: string; eyebrow?: string; onBack?: () => void; action?: React.ReactNode }) {
  return (
    <header className="top-header">
      <div>
        {onBack ? <button className="icon-button back-button" onClick={onBack} aria-label="뒤로 가기">←</button> : <span className="brand-mark">m</span>}
      </div>
      <div className="header-copy">
        {eyebrow && <span>{eyebrow}</span>}
        <h1>{title}</h1>
      </div>
      <div className="header-action">{action ?? <button className="icon-button" aria-label="알림">◌<i /></button>}</div>
    </header>
  );
}

function MealVisual({ meal, large = false }: { meal: Meal; large?: boolean }) {
  const className = `meal-visual tone-${meal.mealType} ${large ? "large" : ""}`;
  return <div className={className} aria-hidden="true"><span>{meal.emoji}</span><i /><em /></div>;
}

function Toast({ message }: { message: string }) {
  return <div className="toast" role="status"><span>✓</span>{message}</div>;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [target, setTarget] = useState<Nutrition>(targetDefault);
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [scheduled, setScheduled] = useState<PlannedMeal[]>([]);
  const [community, setCommunity] = useState(communitySeed);
  const [generating, setGenerating] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(0);
  const [preference, setPreference] = useState("한식");
  const [goal, setGoal] = useState("고단백");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleOffset, setScheduleOffset] = useState(1);
  const [customScheduleDate, setCustomScheduleDate] = useState(() => isoDate(addDays(new Date(), 3)));
  const [scheduleType, setScheduleType] = useState<MealType>("dinner");
  const [editingPlannedId, setEditingPlannedId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => isoDate(new Date()));
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [activeMealType, setActiveMealType] = useState<DiaryMealType>("lunch");
  const [editingEntries, setEditingEntries] = useState<FoodEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchWarning, setSearchWarning] = useState("");
  const [selectedFood, setSelectedFood] = useState<FoodSearchResult | null>(null);
  const [selectedAmountText, setSelectedAmountText] = useState("100");
  const [favoriteFoods, setFavoriteFoods] = useState<FoodSearchResult[]>([]);
  const [recentFoods, setRecentFoods] = useState<RecentFood[]>([]);
  const [userFoods, setUserFoods] = useState<UserCreatedFood[]>([]);
  const [userFoodDraft, setUserFoodDraft] = useState({ name: "", amount: "100", unit: "g", calories: "", carbs: "", protein: "", fat: "" });
  const [avoidFoods, setAvoidFoods] = useState("");
  const [toast, setToast] = useState("");
  const [aiMode, setAiMode] = useState<"live" | "demo" | null>(null);
  const [aiReason, setAiReason] = useState<string | null>(null);
  const [aiModel, setAiModel] = useState<string | null>(null);
  const [targetInputMode, setTargetInputMode] = useState<TargetInputMode>("ratio");
  const [macroRatio, setMacroRatio] = useState<MacroRatio>("5:3:2");
  const [targetDraft, setTargetDraft] = useState<TargetDraft>(() => toTargetDraft(targetDefault));
  const today = useMemo(() => new Date(), []);
  const activePlan = plan ?? mockMealPlan;

  useEffect(() => {
    const restore = window.setTimeout(() => {
      try {
        const savedTarget = browserStorage.get<Nutrition | null>("mealfit-target", null);
        const savedPlan = browserStorage.get<MealPlan | null>("mealfit-plan", null);
        const savedFavorites = localStorage.getItem("mealfit-favorites");
        const savedScheduled = browserStorage.get<Array<PlannedMeal & { completed?: boolean }>>("mealfit-scheduled", []);
        const savedAiMode = localStorage.getItem("mealfit-ai-mode");
        const savedAiReason = localStorage.getItem("mealfit-ai-reason");
        const savedAiModel = localStorage.getItem("mealfit-ai-model");
        const savedTargetMode = localStorage.getItem("mealfit-target-mode");
        const savedMacroRatio = localStorage.getItem("mealfit-macro-ratio");
        if (savedTarget) {
          setTarget(savedTarget);
          setTargetDraft(toTargetDraft(savedTarget));
        }
        if (savedPlan) setPlan(savedPlan);
        if (savedFavorites) setFavorites(JSON.parse(savedFavorites));
        setEntries(browserStorage.get<FoodEntry[]>("mealfit-food-entries", []));
        setFavoriteFoods(browserStorage.get<FoodSearchResult[]>("mealfit-favorite-foods", []));
        setRecentFoods(browserStorage.get<RecentFood[]>("mealfit-recent-foods", []));
        setUserFoods(browserStorage.get<UserCreatedFood[]>("mealfit-user-foods", []));
        const restorePlan = savedPlan ?? mockMealPlan;
        setScheduled(savedScheduled.map((item) => {
          if (item.recipeName && item.nutrition && item.status === "planned") return item;
          const recipe = getMeal(item.recipeId, restorePlan) ?? getMeal(item.recipeId);
          return {
            id: item.id,
            recipeId: item.recipeId,
            recipeName: recipe?.name ?? "추천 레시피",
            date: item.date,
            mealType: item.mealType,
            nutrition: recipe?.nutrition ?? { calories: 0, carbs: 0, protein: 0, fat: 0 },
            status: "planned" as const,
          };
        }));
        if (savedAiMode === "live" || savedAiMode === "demo") setAiMode(savedAiMode);
        if (savedAiReason) setAiReason(savedAiReason);
        if (savedAiModel) setAiModel(savedAiModel);
        if (savedTargetMode === "ratio" || savedTargetMode === "direct") setTargetInputMode(savedTargetMode);
        if (savedMacroRatio === "5:3:2" || savedMacroRatio === "4:4:2") setMacroRatio(savedMacroRatio);
      } catch {
        // A damaged browser cache should never block the demo.
      }
    }, 0);
    return () => window.clearTimeout(restore);
  }, []);

  useEffect(() => {
    if (screen !== "food-search") return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const query = searchQuery.trim();
      if (!query) {
        setSearchResults([]);
        setSearching(false);
        setSearchWarning("");
        return;
      }
      setSearching(true);
      try {
        const response = await fetch(`/api/foods/search?q=${encodeURIComponent(query)}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("food_search_failed");
        const data = await response.json() as { foods?: FoodSearchResult[]; warning?: string };
        setSearchResults(rankFoods([...(data.foods ?? []), ...userFoods], query));
        setSearchWarning(data.warning ? "공공 음식 정보를 불러오지 못해 목 데이터를 보여드려요." : "");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSearchResults(rankFoods(userFoods, query));
        setSearchWarning("음식 정보를 불러오지 못했어요. 최근 음식이나 직접 등록을 이용해 주세요.");
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [screen, searchQuery, userFoods]);

  useEffect(() => {
    if (!generating) return;
    const timer = window.setInterval(() => setLoadingMessage((value) => (value + 1) % loadingMessages.length), 1100);
    return () => window.clearInterval(timer);
  }, [generating]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const saveTarget = (next: Nutrition) => {
    setTarget(next);
    setTargetDraft(toTargetDraft(next));
    localStorage.setItem("mealfit-target", JSON.stringify(next));
  };

  const ratioCalories = Math.max(1, Number.parseInt(targetDraft.calories, 10) || target.calories);
  const ratioPreview = calculateTarget(ratioCalories, macroRatio);

  const updateTargetDraft = (key: TargetKey, value: string) => {
    if (!/^\d*$/.test(value)) return;
    setTargetDraft((current) => ({ ...current, [key]: value }));
  };

  const changeTargetInputMode = (nextMode: TargetInputMode) => {
    if (nextMode === "direct" && targetInputMode === "ratio") setTargetDraft(toTargetDraft(ratioPreview));
    setTargetInputMode(nextMode);
  };

  const commitTarget = () => {
    const next = targetInputMode === "ratio"
      ? ratioPreview
      : {
          calories: Math.max(1, Number.parseInt(targetDraft.calories, 10) || target.calories),
          carbs: Math.max(0, Number.parseInt(targetDraft.carbs, 10) || 0),
          protein: Math.max(0, Number.parseInt(targetDraft.protein, 10) || 0),
          fat: Math.max(0, Number.parseInt(targetDraft.fat, 10) || 0),
        };
    saveTarget(next);
    localStorage.setItem("mealfit-target-mode", targetInputMode);
    localStorage.setItem("mealfit-macro-ratio", macroRatio);
    setToast("영양 목표를 저장했어요");
    setScreen("home");
  };

  const toggleFavorite = (mealId: string) => {
    const next = favorites.includes(mealId) ? favorites.filter((id) => id !== mealId) : [...favorites, mealId];
    setFavorites(next);
    localStorage.setItem("mealfit-favorites", JSON.stringify(next));
    setToast(next.includes(mealId) ? "즐겨찾기에 저장했어요" : "즐겨찾기에서 삭제했어요");
  };

  const toggleFavoriteFood = (food: FoodSearchResult) => {
    const exists = favoriteFoods.some((item) => item.id === food.id);
    const next = exists ? favoriteFoods.filter((item) => item.id !== food.id) : [...favoriteFoods, food];
    setFavoriteFoods(next);
    browserStorage.set("mealfit-favorite-foods", next);
    setToast(exists ? "즐겨찾는 음식에서 삭제했어요" : "즐겨찾는 음식에 저장했어요");
  };

  const selectFood = (food: FoodSearchResult) => {
    setSelectedFood(food);
    setSelectedAmountText(String(food.servingSize ?? 100));
    setScreen("food-detail");
  };

  const startFoodSearch = (mealType: DiaryMealType, keepDraft = false) => {
    setActiveMealType(mealType);
    if (!keepDraft) setEditingEntries(entries.filter((entry) => entry.date === selectedDate && entry.mealType === mealType));
    setSearchQuery("");
    setSearchResults([]);
    setSearchWarning("");
    setScreen("food-search");
  };

  const openMealEditor = (mealType: DiaryMealType) => {
    setActiveMealType(mealType);
    setEditingEntries(entries.filter((entry) => entry.date === selectedDate && entry.mealType === mealType));
    setScreen("meal-editor");
  };

  const addSelectedFood = () => {
    if (!selectedFood) return;
    const baseAmount = selectedFood.servingSize ?? 100;
    const amount = Math.max(1, Number.parseFloat(selectedAmountText) || baseAmount);
    const entry: FoodEntry = {
      id: globalThis.crypto?.randomUUID?.() ?? `food-${Date.now()}`,
      date: selectedDate,
      mealType: activeMealType,
      foodId: selectedFood.id,
      foodName: selectedFood.name,
      manufacturer: selectedFood.manufacturer,
      amount,
      unit: selectedFood.servingUnit ?? "g",
      nutrition: scaleNutrition(selectedFood.nutrition, baseAmount, amount),
      source: selectedFood.source,
      status: "consumed",
      createdAt: new Date().toISOString(),
    };
    setEditingEntries((current) => [...current, entry]);
    setSelectedFood(null);
    setScreen("meal-editor");
  };

  const saveMealEntries = () => {
    const previousIds = new Set(entries.filter((entry) => entry.date === selectedDate && entry.mealType === activeMealType).map((entry) => entry.id));
    const nextEntries = [
      ...entries.filter((entry) => !(entry.date === selectedDate && entry.mealType === activeMealType)),
      ...editingEntries,
    ];
    const newlyAdded = editingEntries.filter((entry) => !previousIds.has(entry.id) && entry.foodId);
    let nextRecent = [...recentFoods];
    newlyAdded.forEach((entry) => {
      const food = [...searchResults, ...userFoods, ...favoriteFoods, ...recentFoods.map((item) => item.food)].find((item) => item.id === entry.foodId);
      if (!food) return;
      const existing = nextRecent.find((item) => item.food.id === food.id);
      nextRecent = existing
        ? nextRecent.map((item) => item.food.id === food.id ? { ...item, count: item.count + 1, lastUsedAt: entry.createdAt, food } : item)
        : [{ food, count: 1, lastUsedAt: entry.createdAt }, ...nextRecent];
    });
    nextRecent.sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
    setEntries(nextEntries);
    setRecentFoods(nextRecent.slice(0, 20));
    browserStorage.set("mealfit-food-entries", nextEntries);
    browserStorage.set("mealfit-recent-foods", nextRecent.slice(0, 20));
    setScreen("home");
    setToast(`${diaryMealTypeLabel[activeMealType]} 기록을 저장했어요`);
  };

  const createUserFood = () => {
    const amount = Math.max(1, Number.parseFloat(userFoodDraft.amount) || 100);
    if (!userFoodDraft.name.trim()) {
      setToast("음식 이름을 입력해 주세요");
      return;
    }
    const food: UserCreatedFood = {
      id: `user-${Date.now()}`,
      name: userFoodDraft.name.trim(),
      category: "직접 등록",
      referenceAmount: `${amount}${userFoodDraft.unit}`,
      servingSize: amount,
      servingUnit: userFoodDraft.unit,
      nutrition: {
        calories: Math.max(0, Number.parseFloat(userFoodDraft.calories) || 0),
        carbs: Math.max(0, Number.parseFloat(userFoodDraft.carbs) || 0),
        protein: Math.max(0, Number.parseFloat(userFoodDraft.protein) || 0),
        fat: Math.max(0, Number.parseFloat(userFoodDraft.fat) || 0),
      },
      source: "user-created",
      createdAt: new Date().toISOString(),
    };
    const next = [...userFoods, food];
    setUserFoods(next);
    browserStorage.set("mealfit-user-foods", next);
    setUserFoodDraft({ name: "", amount: "100", unit: "g", calories: "", carbs: "", protein: "", fat: "" });
    selectFood(food);
  };

  const generatePlan = async () => {
    setGenerating(true);
    setLoadingMessage(0);
    setAiReason(null);
    try {
      const request = fetch("/api/meal-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          target,
          preferences: { cuisine: preference, goal, avoidFoods },
          excludeMealNames: plan ? getAllMeals(plan).map((meal) => meal.name) : [],
          variationSeed: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
        }),
      }).then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(typeof data.reason === "string" ? data.reason : `http_${response.status}`);
        return data;
      });
      const [data] = await Promise.all([request, new Promise((resolve) => setTimeout(resolve, 2300))]);
      const nextPlan = data.plan as MealPlan;
      if (!nextPlan?.days || nextPlan.days.length !== 3 || nextPlan.days.some((day) => day.meals.length !== 3)) throw new Error("invalid plan");
      setPlan(nextPlan);
      const nextMode = data.mode === "live" ? "live" : "demo";
      const nextReason = typeof data.reason === "string" ? data.reason : null;
      const nextModel = typeof data.model === "string" ? data.model : null;
      setAiMode(nextMode);
      setAiReason(nextReason);
      setAiModel(nextModel);
      localStorage.setItem("mealfit-plan", JSON.stringify(nextPlan));
      localStorage.setItem("mealfit-ai-mode", nextMode);
      if (nextReason) localStorage.setItem("mealfit-ai-reason", nextReason);
      else localStorage.removeItem("mealfit-ai-reason");
      if (nextModel) localStorage.setItem("mealfit-ai-model", nextModel);
      else localStorage.removeItem("mealfit-ai-model");
      if (nextMode === "demo") setToast(aiReasonMessage(nextReason));
    } catch (error) {
      const reason = error instanceof Error ? error.message : "client_request_failed";
      setPlan(mockMealPlan);
      setAiMode("demo");
      setAiReason(reason);
      setAiModel(null);
      localStorage.setItem("mealfit-plan", JSON.stringify(mockMealPlan));
      localStorage.setItem("mealfit-ai-mode", "demo");
      localStorage.setItem("mealfit-ai-reason", reason);
      localStorage.removeItem("mealfit-ai-model");
      setToast(aiReasonMessage(reason));
    } finally {
      setGenerating(false);
    }
  };

  const saveSchedule = () => {
    if (!selectedMeal) return;
    const date = scheduleOffset === 3 ? customScheduleDate : isoDate(addDays(today, scheduleOffset));
    const withoutSameSlot = scheduled.filter((item) => item.id !== editingPlannedId && !(item.date === date && item.mealType === scheduleType));
    const next: PlannedMeal[] = [...withoutSameSlot, {
      id: editingPlannedId ?? `${date}-${scheduleType}-${Date.now()}`,
      recipeId: selectedMeal.id,
      recipeName: selectedMeal.name,
      date,
      mealType: scheduleType,
      nutrition: selectedMeal.nutrition,
      status: "planned",
    }];
    setScheduled(next);
    browserStorage.set("mealfit-scheduled", next);
    setScheduleOpen(false);
    setSelectedMeal(null);
    setEditingPlannedId(null);
    setSelectedDate(date);
    setScreen("home");
    setToast(`${date === isoDate(today) ? "오늘" : date} ${mealTypeLabel[scheduleType]}에 먹을 예정으로 등록했어요`);
  };

  const markPlannedConsumed = (planned: PlannedMeal) => {
    const consumed: FoodEntry = {
      id: `recipe-${planned.id}`,
      date: planned.date,
      mealType: planned.mealType,
      foodId: planned.recipeId,
      foodName: planned.recipeName,
      amount: 1,
      unit: "인분",
      nutrition: planned.nutrition,
      source: "recipe",
      status: "consumed",
      createdAt: new Date().toISOString(),
    };
    const nextEntries = [...entries.filter((entry) => entry.id !== consumed.id), consumed];
    const nextScheduled = scheduled.filter((item) => item.id !== planned.id);
    setEntries(nextEntries);
    setScheduled(nextScheduled);
    browserStorage.set("mealfit-food-entries", nextEntries);
    browserStorage.set("mealfit-scheduled", nextScheduled);
    setToast(`${planned.recipeName}을 실제 섭취 기록으로 옮겼어요`);
  };

  const changePlannedMeal = (planned: PlannedMeal) => {
    const recipe = getMeal(planned.recipeId, activePlan) ?? getMeal(planned.recipeId);
    if (!recipe) return;
    setSelectedMeal(recipe);
    setScheduleType(planned.mealType);
    setCustomScheduleDate(planned.date);
    setScheduleOffset(3);
    setEditingPlannedId(planned.id);
    setScheduleOpen(true);
  };

  const shareMeal = (meal: Meal) => {
    if (!community.some((post) => post.id === `mine-${meal.id}`)) {
      setCommunity([{ id: `mine-${meal.id}`, userName: "나의 식단", avatar: "나", mealId: meal.id, comment: `${meal.name}, 오늘의 목표 영양소에 딱 맞게 맛있게 먹었어요!`, likes: 0, time: "방금" }, ...community]);
    }
    setSelectedMeal(null);
    setScreen("community");
    setToast("커뮤니티에 레시피를 공유했어요");
  };

  const openMeal = (meal: Meal) => setSelectedMeal(meal);
  const selectedDateObject = new Date(`${selectedDate}T12:00:00`);
  const dateTabs = [-2, -1, 0, 1, 2].map((offset) => addDays(selectedDateObject, offset));

  const renderHome = () => {
    const dayEntries = entries.filter((entry) => entry.date === selectedDate);
    const dateScheduled = scheduled.filter((item) => item.date === selectedDate);
    const consumedNutrition = addNutrition(dayEntries.map((entry) => entry.nutrition));
    const percent = Math.min(100, Math.round((consumedNutrition.calories / Math.max(1, target.calories)) * 100));
    const isToday = selectedDate === isoDate(today);
    return (
      <>
        <Header title="오늘도 잘 챙겨요" eyebrow="나의 음식 기록" />
        <main className="screen-content home-content">
          <section className="diary-date-section">
            <div className="diary-date-title">
              <button onClick={() => setSelectedDate(isoDate(addDays(selectedDateObject, -1)))} aria-label="이전 날짜">‹</button>
              <div><span>{selectedDateObject.getFullYear()}년 {selectedDateObject.getMonth() + 1}월</span><strong>{isToday ? "오늘" : `${selectedDateObject.getMonth() + 1}월 ${selectedDateObject.getDate()}일`}</strong></div>
              <button onClick={() => setSelectedDate(isoDate(addDays(selectedDateObject, 1)))} aria-label="다음 날짜">›</button>
            </div>
            <div className="diary-date-tabs">
              {dateTabs.map((date) => {
                const dateKey = isoDate(date);
                return <button key={dateKey} className={selectedDate === dateKey ? "active" : ""} onClick={() => setSelectedDate(dateKey)}><span>{date.getMonth() + 1}.{date.getDate()}</span><strong>{dateKey === isoDate(today) ? "오늘" : ["일", "월", "화", "수", "목", "금", "토"][date.getDay()]}</strong></button>;
              })}
            </div>
          </section>

          <section className="nutrition-hero diary-nutrition">
            <div className="hero-title-row">
              <div><span className="section-kicker">DAILY NUTRITION</span><h2>{isToday ? "오늘" : `${selectedDateObject.getMonth() + 1}.${selectedDateObject.getDate()}`} 먹은 만큼 보여드려요</h2></div>
              <button className="text-button" onClick={() => setScreen("my")}>목표 수정</button>
            </div>
            <div className="nutrition-main">
              <div className="progress-ring" style={{ "--progress": `${percent * 3.6}deg` } as CSSProperties}>
                <div><strong>{consumedNutrition.calories.toLocaleString()}</strong><span>/ {target.calories.toLocaleString()} kcal</span></div>
              </div>
              <div className="macro-progress-list">
                {(["carbs", "protein", "fat"] as const).map((key, index) => {
                  const labels = ["탄수화물", "단백질", "지방"];
                  const current = consumedNutrition[key];
                  return <div key={key}><span>{labels[index]} <b>{current}</b> / {target[key]}g</span><i><em style={{ width: `${Math.min(100, current / Math.max(1, target[key]) * 100)}%` }} /></i></div>;
                })}
              </div>
            </div>
            <p className="estimate-note">예정 식단은 제외하고 실제로 기록한 음식만 계산해요.</p>
          </section>

          <section className="diary-list-section">
            <div className="section-heading"><div><span className="section-kicker">FOOD DIARY</span><h2>무엇을 먹었나요?</h2></div><span className="count-badge">{dayEntries.length}개 기록</span></div>
            <div className="diary-meal-list">
              {diaryMealTypes.map((mealType) => {
                const mealEntries = dayEntries.filter((entry) => entry.mealType === mealType);
                const mealNutrition = addNutrition(mealEntries.map((entry) => entry.nutrition));
                const plannedMeals = dateScheduled.filter((item) => item.mealType === mealType);
                return (
                  <article className={`diary-meal-card ${mealEntries.length ? "has-food" : ""}`} key={mealType} onClick={() => mealEntries.length && openMealEditor(mealType)}>
                    <div className="diary-meal-heading">
                      <div><span>{mealIcons[mealType]}</span><h3>{diaryMealTypeLabel[mealType]}</h3></div>
                      <div>{mealEntries.length > 0 && <strong>{mealNutrition.calories} kcal</strong>}<button onClick={(event) => { event.stopPropagation(); startFoodSearch(mealType); }} aria-label={`${diaryMealTypeLabel[mealType]} 음식 추가`}>＋</button></div>
                    </div>
                    {mealEntries.length ? (
                      <div className="diary-food-preview">
                        {mealEntries.map((entry) => <div key={entry.id}><span>{entry.foodName} <em>{entry.amount}{entry.unit}</em></span><b>{entry.nutrition.calories} kcal</b></div>)}
                        <small>카드를 눌러 음식 추가·삭제</small>
                      </div>
                    ) : <button className="empty-meal-add" onClick={(event) => { event.stopPropagation(); startFoodSearch(mealType); }}>먹은 음식 추가하기 <b>＋</b></button>}
                    {plannedMeals.map((planned) => (
                      <div className="planned-meal" key={planned.id} onClick={(event) => event.stopPropagation()}>
                        <div><span>먹을 예정</span><strong>{planned.recipeName}</strong><em>{planned.nutrition.calories} kcal · 섭취량에 미포함</em></div>
                        <div className="planned-actions"><button onClick={() => { const recipe = getMeal(planned.recipeId, activePlan) ?? getMeal(planned.recipeId); if (recipe) openMeal(recipe); }}>레시피 보기</button><button className="consume" onClick={() => markPlannedConsumed(planned)}>먹었어요</button><button onClick={() => changePlannedMeal(planned)}>변경</button></div>
                      </div>
                    ))}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="ai-banner diary-ai-banner">
            <div className="spark-orb">✦</div>
            <div><span>뭘 먹을지 고민될 때만</span><h3>AI에게 3일 메뉴 아이디어를<br />가볍게 받아보세요</h3></div>
            <button onClick={() => setScreen("ai")}>AI 추천 보기 <b>→</b></button>
          </section>
        </main>
      </>
    );
  };

  const renderFoodSearch = () => {
    const showShortcuts = !searchQuery.trim();
    return (
      <>
        <Header title={`${diaryMealTypeLabel[activeMealType]} 음식 추가`} eyebrow={selectedDate} onBack={() => setScreen(editingEntries.length ? "meal-editor" : "home")} />
        <main className="screen-content food-search-content">
          <section className="food-search-hero">
            <span>FOOD SEARCH</span>
            <h2>무슨 음식을<br />먹었나요?</h2>
            <label className="food-search-box"><span>⌕</span><input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="음식이나 브랜드를 검색해 보세요" />{searchQuery && <button onClick={() => setSearchQuery("")} aria-label="검색어 지우기">×</button>}</label>
            <div className="search-filters"><button className="active">전체</button><button onClick={() => setScreen("create-food")}>직접 등록</button></div>
          </section>

          {showShortcuts ? (
            <>
              <section className="food-shortcut-section">
                <div className="section-heading"><h2>최근에 먹었어요</h2><span>{recentFoods.length ? "최근 순" : "기록 전"}</span></div>
                {recentFoods.length ? <div className="food-chip-grid">{recentFoods.slice(0, 8).map(({ food }) => <button key={food.id} onClick={() => selectFood(food)}><span>{food.name}</span><em>{food.nutrition.calories} kcal</em></button>)}</div> : <p className="food-empty-copy">음식을 기록하면 자주 찾는 메뉴가 여기에 모여요.</p>}
              </section>
              <section className="food-shortcut-section">
                <div className="section-heading"><h2>⭐ 즐겨찾기</h2><button onClick={() => setScreen("favorites")}>전체 보기</button></div>
                {favoriteFoods.length ? <div className="food-chip-grid">{favoriteFoods.slice(0, 6).map((food) => <button key={food.id} onClick={() => selectFood(food)}><span>{food.name}</span><em>{food.manufacturer ?? food.referenceAmount}</em></button>)}</div> : <p className="food-empty-copy">검색 결과의 별을 눌러 자주 먹는 음식을 저장해 보세요.</p>}
              </section>
              <button className="manual-food-button" onClick={() => setScreen("create-food")}><span>＋</span><div><strong>찾는 음식이 없나요?</strong><em>영양 정보를 직접 등록할 수 있어요</em></div><b>›</b></button>
            </>
          ) : (
            <section className="food-results-section">
              <div className="section-heading"><h2>검색 결과</h2><span>{searching ? "찾는 중" : `${searchResults.length}개`}</span></div>
              {searchWarning && <p className="food-search-warning">! {searchWarning}</p>}
              {searching ? <div className="food-search-loading"><i /><span>영양 정보를 찾고 있어요</span></div> : searchResults.length ? (
                <div className="food-result-list">
                  {searchResults.map((food) => (
                    <article className="food-result-card" key={food.id} onClick={() => selectFood(food)}>
                      <div className="food-result-copy"><span>{food.source === "user-created" ? "직접 등록" : food.category ?? "음식"}</span><h3>{food.name}</h3><p>{food.manufacturer ?? "일반 식품"} · {food.referenceAmount}</p></div>
                      <div className="food-result-action"><strong>{food.nutrition.calories} <em>kcal</em></strong><div><button className={favoriteFoods.some((item) => item.id === food.id) ? "favorite" : ""} onClick={(event) => { event.stopPropagation(); toggleFavoriteFood(food); }} aria-label="음식 즐겨찾기">★</button><button onClick={(event) => { event.stopPropagation(); selectFood(food); }} aria-label="음식 선택">＋</button></div></div>
                    </article>
                  ))}
                </div>
              ) : <div className="food-no-results"><span>⌕</span><h3>검색 결과가 없어요</h3><p>다른 이름으로 검색하거나<br />직접 음식을 등록해 주세요.</p><button onClick={() => setScreen("create-food")}>직접 등록하기</button></div>}
            </section>
          )}
        </main>
      </>
    );
  };

  const renderFoodDetail = () => {
    if (!selectedFood) return renderFoodSearch();
    const baseAmount = selectedFood.servingSize ?? 100;
    const amount = Math.max(1, Number.parseFloat(selectedAmountText) || baseAmount);
    const nutrition = scaleNutrition(selectedFood.nutrition, baseAmount, amount);
    const step = selectedFood.servingUnit === "ml" ? 50 : 10;
    return (
      <>
        <Header title="섭취량 선택" eyebrow={diaryMealTypeLabel[activeMealType]} onBack={() => setScreen("food-search")} action={<button className={`icon-button food-favorite-button ${favoriteFoods.some((food) => food.id === selectedFood.id) ? "active" : ""}`} onClick={() => toggleFavoriteFood(selectedFood)} aria-label="즐겨찾기">★</button>} />
        <main className="screen-content food-detail-content">
          <section className="food-detail-hero">
            <span>{selectedFood.manufacturer ?? selectedFood.category ?? "영양 정보"}</span>
            <h2>{selectedFood.name}</h2>
            <div className="detail-calories"><strong>{nutrition.calories}</strong><em>kcal</em></div>
            <div className="detail-macros"><div><span>탄수화물</span><strong>{nutrition.carbs}g</strong></div><div><span>단백질</span><strong>{nutrition.protein}g</strong></div><div><span>지방</span><strong>{nutrition.fat}g</strong></div></div>
          </section>
          <section className="portion-card">
            <div><span>섭취량</span><p>기준 영양정보: {selectedFood.referenceAmount ?? `${baseAmount}${selectedFood.servingUnit ?? "g"}`}</p></div>
            <div className="portion-control"><button onClick={() => setSelectedAmountText(String(Math.max(1, amount - step)))} aria-label="섭취량 줄이기">−</button><label><input type="text" inputMode="decimal" value={selectedAmountText} onChange={(event) => /^\d*\.?\d*$/.test(event.target.value) && setSelectedAmountText(event.target.value)} /><em>{selectedFood.servingUnit ?? "g"}</em></label><button onClick={() => setSelectedAmountText(String(amount + step))} aria-label="섭취량 늘리기">＋</button></div>
            <div className="portion-presets">{[0.5, 1, 1.5, 2].map((ratio) => <button key={ratio} onClick={() => setSelectedAmountText(String(Math.round(baseAmount * ratio * 10) / 10))}>{ratio}배</button>)}</div>
          </section>
          <button className="primary-cta food-add-cta" onClick={addSelectedFood}>목록에 담기 <b>→</b></button>
        </main>
      </>
    );
  };

  const renderMealEditor = () => {
    const nutrition = addNutrition(editingEntries.map((entry) => entry.nutrition));
    return (
      <>
        <Header title={`${mealIcons[activeMealType]} ${diaryMealTypeLabel[activeMealType]}`} eyebrow={`${selectedDate} 실제 섭취`} onBack={() => setScreen("home")} />
        <main className="screen-content meal-editor-content">
          <section className="meal-editor-summary"><span>총 섭취량</span><h2>{nutrition.calories} <em>kcal</em></h2><MacroRow nutrition={nutrition} /></section>
          <section className="meal-editor-list">
            <div className="section-heading"><h2>먹은 음식</h2><span>{editingEntries.length}개</span></div>
            {editingEntries.length ? editingEntries.map((entry) => <article key={entry.id}><div><span>{entry.manufacturer ?? "섭취 기록"}</span><h3>{entry.foodName}</h3><p>{entry.amount}{entry.unit} · 탄 {entry.nutrition.carbs}g · 단 {entry.nutrition.protein}g · 지 {entry.nutrition.fat}g</p></div><strong>{entry.nutrition.calories} kcal</strong><button onClick={() => setEditingEntries((current) => current.filter((item) => item.id !== entry.id))} aria-label={`${entry.foodName} 삭제`}>×</button></article>) : <div className="meal-editor-empty"><span>＋</span><p>아직 담은 음식이 없어요.</p></div>}
          </section>
          <div className="meal-editor-actions"><button className="outline-cta" onClick={() => startFoodSearch(activeMealType, true)}>＋ 음식 추가</button><button className="primary-cta compact" onClick={saveMealEntries}>수정 완료</button></div>
        </main>
      </>
    );
  };

  const renderCreateFood = () => (
    <>
      <Header title="음식 직접 등록" eyebrow="MY FOOD" onBack={() => setScreen("food-search")} />
      <main className="screen-content create-food-content">
        <section className="simple-hero"><span>검색에 없는 음식도</span><h2>내 음식으로 저장해요</h2><p>한 번 등록하면 다음부터 검색과 즐겨찾기에서 바로 사용할 수 있어요.</p></section>
        <section className="create-food-card">
          <label><span>음식 이름</span><input value={userFoodDraft.name} onChange={(event) => setUserFoodDraft({ ...userFoodDraft, name: event.target.value })} placeholder="예: 엄마표 닭볶음탕" /></label>
          <div className="create-food-grid"><label><span>기준량</span><input inputMode="decimal" value={userFoodDraft.amount} onChange={(event) => /^\d*\.?\d*$/.test(event.target.value) && setUserFoodDraft({ ...userFoodDraft, amount: event.target.value })} /></label><label><span>단위</span><select value={userFoodDraft.unit} onChange={(event) => setUserFoodDraft({ ...userFoodDraft, unit: event.target.value })}><option value="g">g</option><option value="ml">ml</option><option value="개">개</option><option value="인분">인분</option></select></label></div>
          {(["calories", "carbs", "protein", "fat"] as const).map((key, index) => <label key={key}><span>{["칼로리", "탄수화물", "단백질", "지방"][index]}</span><div><input inputMode="decimal" value={userFoodDraft[key]} onChange={(event) => /^\d*\.?\d*$/.test(event.target.value) && setUserFoodDraft({ ...userFoodDraft, [key]: event.target.value })} placeholder="0" /><em>{key === "calories" ? "kcal" : "g"}</em></div></label>)}
          <button className="primary-cta compact" onClick={createUserFood}>저장하고 섭취량 선택하기</button>
        </section>
      </main>
    </>
  );

  const renderAI = () => (
    <>
      <Header title="AI 3일 식단" eyebrow="MEAL DESIGNER" />
      <main className="screen-content ai-content">
        {!plan && !generating && (
          <>
            <section className="ai-intro">
              <span className="ai-pill">✦ AI가 함께 계획해요</span>
              <h2>기록은 줄이고,<br /><em>결정은 더 빠르게.</em></h2>
              <p>목표 영양소와 취향을 바탕으로 장보기까지 이어지는 3일 식단을 설계해요.</p>
            </section>
            <section className="target-card">
              <div className="card-heading"><div><span>나의 목표</span><h3>하루 영양 목표</h3></div><button onClick={() => setScreen("my")}>수정</button></div>
              <div className="target-calorie"><strong>{target.calories.toLocaleString()}</strong><span>kcal / 일</span></div>
              <div className="target-macros"><div><i className="carb" /><span>탄수화물</span><b>{target.carbs}g</b></div><div><i className="protein" /><span>단백질</span><b>{target.protein}g</b></div><div><i className="fat" /><span>지방</span><b>{target.fat}g</b></div></div>
            </section>
            <section className="preference-section">
              <div className="section-heading"><div><span className="section-kicker">TASTE</span><h2>어떤 식단이 좋으세요?</h2></div></div>
              <div className="chip-group">{["한식", "간단한 요리", "저렴하게", "아무거나"].map((item) => <button key={item} onClick={() => setPreference(item)} className={preference === item ? "active" : ""}>{item}</button>)}</div>
              <div className="chip-group secondary">{["고단백", "균형식", "저탄수", "다이어트", "재료 최소화"].map((item) => <button key={item} onClick={() => setGoal(item)} className={goal === item ? "active" : ""}>{item}</button>)}</div>
              <label className="avoid-food-input"><span>피하고 싶은 음식이 있나요?</span><input value={avoidFoods} onChange={(event) => setAvoidFoods(event.target.value)} placeholder="예: 버섯, 가지 (선택)" /></label>
            </section>
            <button className="primary-cta" onClick={generatePlan}><span>✦</span> 3일 메뉴 추천받기 <b>→</b></button>
            <p className="cta-helper">3일 × 3끼 · 겹치는 재료를 찾아 장보기를 줄여요</p>
          </>
        )}

        {generating && (
          <section className="loading-state">
            <div className="loading-orbit"><span>✦</span><i /><em /></div>
            <span className="ai-pill">AI MEAL DESIGNER</span>
            <h2>식단을 구성하고 있어요</h2>
            <p>{loadingMessages[loadingMessage]}<span className="loading-dots">...</span></p>
            <div className="loading-progress"><i /></div>
            <small>잠시만 기다려 주세요. 보통 10초 안에 완성돼요.</small>
          </section>
        )}

        {plan && !generating && (
          <section className="plan-result">
            <div className="result-hero">
              <div className="result-check">✓</div>
              <span>{aiMode === "live" ? "실제 AI 식단 완성" : aiMode === "demo" ? "데모 식단" : "저장된 식단"}</span>
              <h2>다음 3일의 식사가<br />준비됐어요</h2>
              <p>목표 영양과 장보기 효율을 함께 맞췄어요.</p>
            </div>
            {aiMode && (
              <div className={`ai-connection-status ${aiMode}`} role="status">
                <span>{aiMode === "live" ? "✓" : "!"}</span>
                <div>
                  <strong>{aiMode === "live" ? "OpenAI 연결됨" : "현재 데모 모드"}</strong>
                  <p>{aiMode === "live" ? `${aiModel ?? "설정된 모델"}로 새 식단을 생성했어요.` : aiReasonMessage(aiReason)}</p>
                </div>
              </div>
            )}
            <div className="plan-summary-strip"><div><strong>3</strong><span>일</span></div><i /><div><strong>9</strong><span>끼</span></div><i /><div><strong>{plan.shoppingSummary.uniqueIngredientCount}</strong><span>주요 재료</span></div></div>
            {plan.days.map((day) => (
              <article className="plan-day" key={day.day}>
                <div className="plan-day-header"><div><span>DAY {day.day}</span><h3>{day.day === 1 ? "기분 좋은 시작" : day.day === 2 ? "익숙한 재료, 새로운 조합" : "가볍고 든든한 마무리"}</h3></div><div><strong>{day.nutrition.calories.toLocaleString()}</strong><span>kcal</span></div></div>
                <div className="ai-summary-meals">{day.meals.map((meal) => <button key={meal.id} onClick={() => openMeal(meal)}><span>{mealTypeLabel[meal.mealType]}</span><div><strong>{meal.name}</strong><em>{meal.nutrition.calories} kcal</em></div><b>›</b></button>)}</div>
              </article>
            ))}
            <section className="reuse-card">
              <div className="reuse-icon">↻</div>
              <span>SMART SHOPPING</span>
              <h3>장보기까지 생각해서<br />구성했어요</h3>
              <p><strong>9끼를 주요 식재료 {plan.shoppingSummary.uniqueIngredientCount}개</strong>로 구성하고, {plan.shoppingSummary.reusedIngredientCount}개 재료를 여러 메뉴에 재사용해요.</p>
              <div className="reuse-list">{plan.shoppingSummary.reusedIngredients.slice(0, 3).map((item) => <div key={item.ingredient}><span>{item.ingredient}</span><b>{item.totalAmount}</b><em>{item.usedIn[0]}</em></div>)}</div>
              <button onClick={() => setScreen("shopping")}>3일치 장보기 목록 보기 <b>→</b></button>
            </section>
            <div className="plan-actions">
              <button className="primary-cta compact" onClick={generatePlan}>✦ AI로 새 식단 다시 만들기</button>
              <button className="outline-cta" onClick={() => { setPlan(null); setAiMode(null); setAiReason(null); setAiModel(null); }}>취향 변경하기</button>
            </div>
          </section>
        )}
      </main>
    </>
  );

  const renderShopping = () => (
    <>
      <Header title="3일치 장보기" eyebrow="SMART SHOPPING" onBack={() => setScreen("ai")} />
      <main className="screen-content shopping-content">
        <section className="shopping-hero"><div><span>아홉 끼를 위한</span><h2>한 번의 장보기</h2><p>겹치는 재료는 합치고, 필요한 양만 정리했어요.</p></div><div className="basket">◒<i>14</i></div></section>
        <div className="shopping-stat"><span>재료 재사용으로</span><strong>약 31% <em>↓</em></strong><p>불필요한 식재료 종류를 줄였어요</p></div>
        {shoppingItems.map(([category, items]) => (
          <section className="shopping-category" key={category}>
            <div className="section-heading"><h2>{category}</h2><span>{items.length}개</span></div>
            {items.map((item) => {
              const ingredient = item.replace(/\s[\d¼½].*$/, "");
              return <div className="shopping-item" key={item}><label><input type="checkbox" /><i /> <span>{item}</span></label><a href={getIngredientPurchaseUrl(ingredient)} target="_blank" rel="noreferrer">쿠팡에서 찾기 ↗</a></div>;
            })}
          </section>
        ))}
        <p className="commerce-note">구매 버튼은 쿠팡 검색 결과로 연결됩니다. 상품이 장바구니에 자동으로 담기지는 않아요.</p>
      </main>
    </>
  );

  const renderCommunity = () => (
    <>
      <Header title="함께 먹는 식단" eyebrow="COMMUNITY" />
      <main className="screen-content community-content">
        <section className="community-intro"><div><span>오늘의 식단 기록</span><h2>누군가의 한 끼가<br />나의 다음 메뉴가 돼요.</h2></div><span className="people-stack"><i>민</i><i>프</i><i>오</i><b>+82</b></span></section>
        <div className="feed-filter"><button className="active">추천</button><button>최신</button><button>고단백</button><button>간편식</button></div>
        <div className="community-feed">
          {community.map((post) => {
            const meal = getMeal(post.mealId, activePlan) ?? getMeal(post.mealId) ?? mockMealPlan.days[0].meals[0];
            return <article className="post-card" key={post.id}>
              <div className="post-author"><span>{post.avatar}</span><div><strong>{post.userName}</strong><em>{post.time}</em></div><button aria-label="게시물 메뉴">•••</button></div>
              <p>{post.comment}</p>
              <button className="post-meal" onClick={() => openMeal(meal)}><MealVisual meal={meal} large /><div><span>{mealTypeLabel[meal.mealType]} 추천</span><h3>{meal.name}</h3><strong>{meal.nutrition.calories} kcal</strong><MacroRow nutrition={meal.nutrition} compact /></div><b>›</b></button>
              <div className="post-actions"><button onClick={() => setCommunity(community.map((item) => item.id === post.id ? { ...item, likes: item.likes + 1 } : item))}>♡ {post.likes}</button><button onClick={() => toggleFavorite(meal.id)}>▱ 저장</button><button onClick={() => openMeal(meal)}>레시피 보기 →</button></div>
            </article>;
          })}
        </div>
      </main>
    </>
  );

  const renderFavorites = () => {
    const meals = getAllMeals(activePlan).filter((meal) => favorites.includes(meal.id));
    return (
      <>
        <Header title="즐겨찾기" eyebrow="FOODS & RECIPES" />
        <main className="screen-content favorites-content">
          <section className="simple-hero"><span>자주 먹는 것도, 먹고 싶은 것도</span><h2>두 개의 즐겨찾기</h2><p>실제 기록용 음식과 AI 추천 레시피를 구분해서 보관해요.</p></section>
          <section className="favorite-food-section">
            <div className="section-heading"><div><span className="section-kicker">QUICK RECORD</span><h2>⭐ 즐겨찾는 음식</h2></div><span>{favoriteFoods.length}개</span></div>
            {favoriteFoods.length ? <div className="favorite-food-list">{favoriteFoods.map((food) => <article key={food.id}><button className="favorite-food-main" onClick={() => { setActiveMealType("lunch"); setEditingEntries(entries.filter((entry) => entry.date === selectedDate && entry.mealType === "lunch")); selectFood(food); }}><div><span>{food.manufacturer ?? food.category}</span><strong>{food.name}</strong><em>{food.referenceAmount}</em></div><b>{food.nutrition.calories} kcal</b></button><button onClick={() => toggleFavoriteFood(food)} aria-label="즐겨찾기 삭제">★</button></article>)}</div> : <div className="compact-empty"><p>즐겨찾는 음식이 아직 없어요.</p><button onClick={() => startFoodSearch("lunch")}>음식 검색하기</button></div>}
          </section>
          <section className="favorite-recipe-section">
            <div className="section-heading"><div><span className="section-kicker">AI RECIPES</span><h2>♡ 즐겨찾는 레시피</h2></div><span>{meals.length}개</span></div>
            {meals.length ? <div className="favorite-grid">{meals.map((meal) => <article key={meal.id} className="favorite-card" onClick={() => openMeal(meal)}><MealVisual meal={meal} large /><button onClick={(event) => { event.stopPropagation(); toggleFavorite(meal.id); }}>♥</button><div><span>{meal.cookingTimeMinutes}분 · {meal.difficulty === "easy" ? "쉬움" : "보통"}</span><h3>{meal.name}</h3><strong>{meal.nutrition.calories} kcal</strong><MacroRow nutrition={meal.nutrition} compact /></div></article>)}</div> : <div className="compact-empty"><p>저장한 AI 레시피가 아직 없어요.</p><button onClick={() => setScreen("ai")}>AI 추천 보러 가기</button></div>}
          </section>
        </main>
      </>
    );
  };

  const renderMy = () => (
    <>
      <Header title="나의 목표" eyebrow="MY NUTRITION" />
      <main className="screen-content my-content">
        <section className="profile-card"><div className="profile-avatar">M<span>✦</span></div><div><span>오늘도 꾸준한</span><h2>밀핏 챌린저</h2><p>식단을 시작한 지 12일째예요</p></div></section>
        <section className="settings-card">
          <div className="section-heading"><div><span className="section-kicker">DAILY TARGET</span><h2>하루 영양 목표</h2></div></div>
          <div className="target-input-tabs" role="tablist" aria-label="영양 목표 입력 방식">
            <button role="tab" aria-selected={targetInputMode === "ratio"} className={targetInputMode === "ratio" ? "active" : ""} onClick={() => changeTargetInputMode("ratio")}>비율로 자동 계산</button>
            <button role="tab" aria-selected={targetInputMode === "direct"} className={targetInputMode === "direct" ? "active" : ""} onClick={() => changeTargetInputMode("direct")}>직접 입력</button>
          </div>

          {targetInputMode === "ratio" ? (
            <div className="ratio-target-panel" role="tabpanel">
              <label className="goal-input calorie-only"><span><i className="calories" />총칼로리</span><div><input type="text" inputMode="numeric" value={targetDraft.calories} onChange={(event) => updateTargetDraft("calories", event.target.value)} /><em>kcal</em></div></label>
              <div className="ratio-heading"><strong>탄수화물 : 단백질 : 지방</strong><span>칼로리 비율</span></div>
              <div className="ratio-options">
                {(Object.keys(macroRatios) as MacroRatio[]).map((ratio) => (
                  <button key={ratio} className={macroRatio === ratio ? "active" : ""} onClick={() => setMacroRatio(ratio)}>
                    <strong>{ratio}</strong><span>{macroRatios[ratio].description}</span>
                  </button>
                ))}
              </div>
              <div className="calculated-macros">
                <div><i className="carbs" /><span>탄수화물</span><strong>{ratioPreview.carbs}g</strong></div>
                <div><i className="protein" /><span>단백질</span><strong>{ratioPreview.protein}g</strong></div>
                <div><i className="fat" /><span>지방</span><strong>{ratioPreview.fat}g</strong></div>
              </div>
              <p className="ratio-note">탄수화물과 단백질은 1g당 4kcal, 지방은 1g당 9kcal로 자동 계산해요.</p>
            </div>
          ) : (
            <div role="tabpanel">
              {(["calories", "carbs", "protein", "fat"] as TargetKey[]).map((key, index) => {
                const labels = ["칼로리", "탄수화물", "단백질", "지방"];
                const units = ["kcal", "g", "g", "g"];
                return <label className="goal-input" key={key}><span><i className={key} />{labels[index]}</span><div><input type="text" inputMode="numeric" value={targetDraft[key]} onChange={(event) => updateTargetDraft(key, event.target.value)} /><em>{units[index]}</em></div></label>;
              })}
              <p className="ratio-note">숫자를 지운 뒤 새 값을 입력해도 앞에 0이 붙지 않아요.</p>
            </div>
          )}
          <button className="primary-cta compact" onClick={commitTarget}>목표 저장하기</button>
        </section>
        <section className="settings-list"><button><span>🥬</span><div><b>선호 식단</b><em>한식 · 고단백</em></div><i>›</i></button><button><span>⚑</span><div><b>알레르기 및 제외 식품</b><em>설정 안 함</em></div><i>›</i></button><button><span>↻</span><div><b>데모 데이터 초기화</b><em>저장된 식단과 즐겨찾기 삭제</em></div><i>›</i></button></section>
      </main>
    </>
  );

  const currentContent = screen === "home" ? renderHome()
    : screen === "ai" ? renderAI()
      : screen === "shopping" ? renderShopping()
        : screen === "community" ? renderCommunity()
          : screen === "favorites" ? renderFavorites()
            : screen === "my" ? renderMy()
              : screen === "food-search" ? renderFoodSearch()
                : screen === "food-detail" ? renderFoodDetail()
                  : screen === "meal-editor" ? renderMealEditor()
                    : renderCreateFood();
  const showBottomNav = ["home", "ai", "community", "favorites", "my"].includes(screen);

  return (
    <div className="page-backdrop">
      <div className="app-shell">
        {currentContent}
        {showBottomNav && (
          <nav className="bottom-nav" aria-label="주요 메뉴">
            {navItems.map((item) => <button key={item.id} className={screen === item.id ? "active" : item.id === "ai" ? "ai-nav" : ""} onClick={() => setScreen(item.id)}><span>{item.icon}</span><em>{item.label}</em></button>)}
          </nav>
        )}

        {selectedMeal && (
          <div className="modal-layer" role="dialog" aria-modal="true" aria-label={`${selectedMeal.name} 레시피`}>
            <div className="recipe-sheet">
              <div className="recipe-hero"><MealVisual meal={selectedMeal} large /><button className="close-button" onClick={() => setSelectedMeal(null)} aria-label="닫기">×</button><button className={`floating-heart ${favorites.includes(selectedMeal.id) ? "active" : ""}`} onClick={() => toggleFavorite(selectedMeal.id)}>{favorites.includes(selectedMeal.id) ? "♥" : "♡"}</button></div>
              <div className="recipe-body">
                <span className="recipe-type">{mealTypeLabel[selectedMeal.mealType]} 추천 · {selectedMeal.tags.join(" · ")}</span>
                <h2>{selectedMeal.name}</h2>
                <p>{selectedMeal.description}</p>
                <div className="recipe-nutrition"><div><strong>{selectedMeal.nutrition.calories}</strong><span>kcal</span></div><div><b>{selectedMeal.nutrition.carbs}g</b><span>탄수화물</span></div><div><b>{selectedMeal.nutrition.protein}g</b><span>단백질</span></div><div><b>{selectedMeal.nutrition.fat}g</b><span>지방</span></div></div>
                <div className="recipe-facts"><span>◷ {selectedMeal.cookingTimeMinutes}분</span><span>◇ {selectedMeal.difficulty === "easy" ? "쉬움" : "보통"}</span><span>♨ 1인분</span></div>
                <section className="recipe-section"><div className="section-heading"><h3>필요한 재료</h3><span>1인분 기준</span></div>{selectedMeal.ingredients.map((ingredient) => <div className="ingredient-row" key={`${ingredient.name}-${ingredient.amount}`}><div><i className={ingredient.category} /><span>{ingredient.name}</span><b>{ingredient.amount}</b></div><a href={getIngredientPurchaseUrl(ingredient.name)} target="_blank" rel="noreferrer">쿠팡에서 찾기 ↗</a></div>)}</section>
                <section className="recipe-section instructions"><div className="section-heading"><h3>이렇게 만들어요</h3></div>{selectedMeal.instructions.map((instruction, index) => <div className="instruction-row" key={instruction}><span>{index + 1}</span><p>{instruction}</p></div>)}</section>
                <p className="estimate-note centered">영양 정보는 재료와 조리법에 따른 추정치입니다.</p>
                <div className="recipe-secondary-actions"><button onClick={() => toggleFavorite(selectedMeal.id)}>{favorites.includes(selectedMeal.id) ? "♥ 저장됨" : "♡ 즐겨찾기"}</button><button onClick={() => shareMeal(selectedMeal)}>♧ 커뮤니티 공유</button></div>
                <button className="primary-cta schedule-cta" onClick={() => { setEditingPlannedId(null); setScheduleOpen(true); }}>이 메뉴 먹을래요</button>
              </div>
            </div>
          </div>
        )}

        {scheduleOpen && selectedMeal && (
          <div className="modal-layer schedule-layer" role="dialog" aria-modal="true" aria-label="식단 일정 선택">
            <button className="modal-scrim" onClick={() => setScheduleOpen(false)} aria-label="일정 창 닫기" />
            <div className="schedule-sheet">
              <div className="sheet-handle" />
              <div className="sheet-heading"><div><span>식단에 추가</span><h2>언제 먹을까요?</h2></div><button onClick={() => setScheduleOpen(false)}>×</button></div>
              <div className="selected-meal-chip"><span>{selectedMeal.emoji}</span><div><b>{selectedMeal.name}</b><em>{selectedMeal.nutrition.calories} kcal</em></div></div>
              <label className="sheet-label">날짜 선택</label>
              <div className="schedule-options date-options">{[0, 1, 2, 3].map((offset) => <button key={offset} onClick={() => setScheduleOffset(offset)} className={scheduleOffset === offset ? "active" : ""}><span>{dateChoiceLabel(offset)}</span><b>{offset === 3 ? "날짜" : shortDate(addDays(today, offset))}</b></button>)}</div>
              {scheduleOffset === 3 && <label className="custom-date-input"><span>날짜</span><input type="date" value={customScheduleDate} min={isoDate(today)} onChange={(event) => setCustomScheduleDate(event.target.value)} /></label>}
              <label className="sheet-label">끼니 선택</label>
              <div className="schedule-options meal-options">{(["breakfast", "lunch", "dinner"] as MealType[]).map((type) => <button key={type} onClick={() => setScheduleType(type)} className={scheduleType === type ? "active" : ""}><span>{type === "breakfast" ? "☀" : type === "lunch" ? "◐" : "☾"}</span>{mealTypeLabel[type]}</button>)}</div>
              <button className="primary-cta" onClick={saveSchedule}>{scheduleOffset === 3 ? customScheduleDate : dateChoiceLabel(scheduleOffset)} {mealTypeLabel[scheduleType]}에 등록하기</button>
            </div>
          </div>
        )}

        {toast && <Toast message={toast} />}
      </div>
    </div>
  );
}
