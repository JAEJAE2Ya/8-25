"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  addNutrition,
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
import { BackendError, backendFetch, toFood, toUserFood, type AuthUser, type BackendFood, type CommunityComment, type CommunityPost } from "@/lib/backend-api";
import { rankFoods, scaleNutrition, type FoodSearchResult, type UserCreatedFood } from "@/services/food-search/types";

type Screen = "home" | "ai" | "community" | "favorites" | "my" | "shopping" | "food-search" | "food-detail" | "meal-editor" | "create-food";
type TargetKey = keyof Nutrition;
type TargetInputMode = "ratio" | "direct";
type MacroRatio = "5:3:2" | "4:4:2";
type TargetDraft = Record<TargetKey, string>;
type RecentFood = { food: FoodSearchResult; count: number; lastUsedAt: string };

const diaryMealTypes: DiaryMealType[] = ["breakfast", "lunch", "dinner", "snack"];
const mealIconSrc: Record<DiaryMealType, string> = {
  breakfast: "/meal-breakfast.png",
  lunch: "/meal-lunch.png",
  dinner: "/meal-dinner.png",
  snack: "/meal-snack.png",
};

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

function dedupeFoods<T extends FoodSearchResult>(foods: T[]): T[] {
  const seen = new Set<string>();
  return foods.filter((food) => {
    const normalizedName = food.name.trim().toLocaleLowerCase("ko-KR");
    const key = food.source === "user-created"
      ? `user-created:${normalizedName}`
      : `${food.source}:${food.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

function MealTypeIcon({ type, size }: { type: DiaryMealType; size: number }) {
  return <Image className="meal-type-icon-image" src={mealIconSrc[type]} alt="" width={size} height={size} />;
}

function Header({ title, eyebrow, onBack, action }: { title: React.ReactNode; eyebrow?: string; onBack?: () => void; action?: React.ReactNode }) {
  return (
    <header className="top-header">
      <div>
        {onBack ? <button className="icon-button back-button" onClick={onBack} aria-label="뒤로 가기">←</button> : <Image className="brand-mark" src="/mealfit-logo.png" alt="Mealfit" width={36} height={36} />}
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
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("home");
  const [target, setTarget] = useState<Nutrition>(targetDefault);
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [scheduled, setScheduled] = useState<PlannedMeal[]>([]);
  const [community, setCommunity] = useState<CommunityPost[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [favoriteRecipeIds, setFavoriteRecipeIds] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, CommunityComment[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [communitySchedulePostId, setCommunitySchedulePostId] = useState<string | null>(null);
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
  const [creatingUserFood, setCreatingUserFood] = useState(false);
  const [sharingEntryId, setSharingEntryId] = useState<string | null>(null);
  const [availableIngredients, setAvailableIngredients] = useState("");
  const [shareReviewMeal, setShareReviewMeal] = useState<Meal | null>(null);
  const [shareReviewDraft, setShareReviewDraft] = useState("");
  const [sharingMeal, setSharingMeal] = useState(false);
  const [userFoodDraft, setUserFoodDraft] = useState({ name: "", amount: "100", unit: "g", calories: "", carbs: "", protein: "", fat: "" });
  const [avoidFoods, setAvoidFoods] = useState("");
  const [allergyEditorOpen, setAllergyEditorOpen] = useState(false);
  const [allergyDraft, setAllergyDraft] = useState("");
  const [savingAllergies, setSavingAllergies] = useState(false);
  const [toast, setToast] = useState("");
  const [aiMode, setAiMode] = useState<"live" | "demo" | null>(null);
  const [aiReason, setAiReason] = useState<string | null>(null);
  const [, setAiModel] = useState<string | null>(null);
  const [targetInputMode, setTargetInputMode] = useState<TargetInputMode>("ratio");
  const [macroRatio, setMacroRatio] = useState<MacroRatio>("5:3:2");
  const [targetDraft, setTargetDraft] = useState<TargetDraft>(() => toTargetDraft(targetDefault));
  const today = useMemo(() => new Date(), []);
  const activePlan = plan ?? mockMealPlan;

  useEffect(() => {
    const restore = window.setTimeout(async () => {
      try {
        const savedAiMode = localStorage.getItem("mealfit-ai-mode");
        const savedAiReason = localStorage.getItem("mealfit-ai-reason");
        const savedAiModel = localStorage.getItem("mealfit-ai-model");
        const savedTargetMode = localStorage.getItem("mealfit-target-mode");
        const savedMacroRatio = localStorage.getItem("mealfit-macro-ratio");
        if (savedAiMode === "live" || savedAiMode === "demo") setAiMode(savedAiMode);
        if (savedAiReason) setAiReason(savedAiReason);
        if (savedAiModel) setAiModel(savedAiModel);
        if (savedTargetMode === "ratio" || savedTargetMode === "direct") setTargetInputMode(savedTargetMode);
        if (savedMacroRatio === "5:3:2" || savedMacroRatio === "4:4:2") setMacroRatio(savedMacroRatio);
        const [{ user }, { profile }, favoriteFoodData, favoriteRecipeData, userFoodData, recentFoodData, communityData] = await Promise.all([
          backendFetch<{ user: AuthUser }>("/api/auth/me"),
          backendFetch<{ profile: { dailyCalories: number; carbsTarget: number; proteinTarget: number; fatTarget: number; allergies: string | null } }>("/api/profile/nutrition"),
          backendFetch<{ foods: BackendFood[] }>("/api/favorites/foods"),
          backendFetch<{ recipes: Array<Meal & { favoriteId: string; externalId?: string }> }>("/api/favorites/recipes"),
          backendFetch<{ foods: BackendFood[] }>("/api/foods/user"),
          backendFetch<{ foods: BackendFood[] }>("/api/foods/recent"),
          backendFetch<{ posts: CommunityPost[] }>("/api/community/posts"),
        ]);
        setCurrentUser(user);
        const profileTarget = { calories: profile.dailyCalories, carbs: profile.carbsTarget, protein: profile.proteinTarget, fat: profile.fatTarget };
        setTarget(profileTarget);
        setTargetDraft(toTargetDraft(profileTarget));
        setAvoidFoods(profile.allergies ?? "");
        setFavoriteFoods(favoriteFoodData.foods.map(toFood));
        setFavorites(favoriteRecipeData.recipes.map((recipe) => recipe.externalId ?? recipe.id));
        setFavoriteRecipeIds(Object.fromEntries(favoriteRecipeData.recipes.map((recipe) => [recipe.externalId ?? recipe.id, recipe.favoriteId])));
        setUserFoods(dedupeFoods(userFoodData.foods.map(toUserFood)));
        setRecentFoods(recentFoodData.foods.map((food, index) => ({ food: toFood(food), count: 1, lastUsedAt: new Date(Date.now() - index).toISOString() })));
        setCommunity(communityData.posts);
      } catch (error) {
        if (error instanceof BackendError && error.status === 401) router.replace("/login");
        else setToast("백엔드에 연결하지 못했어요. 서버 상태를 확인해 주세요.");
      }
    }, 0);
    return () => window.clearTimeout(restore);
  }, [router]);

  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    Promise.all([
      backendFetch<{ entries: FoodEntry[] }>(`/api/diary?date=${selectedDate}`),
      backendFetch<{ plannedMeals: PlannedMeal[] }>(`/api/planned-meals?date=${selectedDate}`),
    ]).then(([diary, planned]) => {
      if (!active) return;
      setEntries((items) => [...items.filter((item) => item.date !== selectedDate), ...diary.entries]);
      setScheduled((items) => [...items.filter((item) => item.date !== selectedDate), ...planned.plannedMeals]);
    }).catch(() => setToast("이 날짜의 식단을 불러오지 못했어요."));
    return () => { active = false; };
  }, [currentUser, selectedDate]);

  useEffect(() => {
    if (!currentUser || screen !== "community") return;
    backendFetch<{ posts: CommunityPost[] }>("/api/community/posts")
      .then((data) => setCommunity(data.posts))
      .catch(() => setToast("커뮤니티를 새로 불러오지 못했어요."));
  }, [currentUser, screen]);

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
        const data = await backendFetch<{ foods?: BackendFood[]; warning?: string }>(`/api/foods/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        setSearchResults(rankFoods(dedupeFoods((data.foods ?? []).map(toFood)), query));
        setSearchWarning(data.warning ? "식약처 음식 정보를 불러오지 못해 직접 등록한 음식만 보여드려요." : "");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSearchResults(rankFoods(dedupeFoods(userFoods), query));
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

  const saveTarget = async (next: Nutrition) => {
    setTarget(next);
    setTargetDraft(toTargetDraft(next));
    await backendFetch("/api/profile/nutrition", { method: "PATCH", body: JSON.stringify({ dailyCalories: next.calories, carbsTarget: next.carbs, proteinTarget: next.protein, fatTarget: next.fat }) });
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

  const commitTarget = async () => {
    const next = targetInputMode === "ratio"
      ? ratioPreview
      : {
          calories: Math.max(1, Number.parseInt(targetDraft.calories, 10) || target.calories),
          carbs: Math.max(0, Number.parseInt(targetDraft.carbs, 10) || 0),
          protein: Math.max(0, Number.parseInt(targetDraft.protein, 10) || 0),
          fat: Math.max(0, Number.parseInt(targetDraft.fat, 10) || 0),
        };
    try {
      await saveTarget(next);
    } catch {
      setToast("영양 목표를 저장하지 못했어요");
      return;
    }
    localStorage.setItem("mealfit-target-mode", targetInputMode);
    localStorage.setItem("mealfit-macro-ratio", macroRatio);
    setToast("영양 목표를 저장했어요");
    setScreen("home");
  };

  const openAllergyEditor = () => {
    setAllergyDraft(avoidFoods);
    setAllergyEditorOpen(true);
  };

  const saveAllergies = async () => {
    if (savingAllergies) return;
    setSavingAllergies(true);
    try {
      const data = await backendFetch<{ profile: { allergies: string | null } }>("/api/profile/nutrition", {
        method: "PATCH",
        body: JSON.stringify({ allergies: allergyDraft.trim() }),
      });
      setAvoidFoods(data.profile.allergies ?? "");
      setAllergyEditorOpen(false);
      setToast("알레르기 및 제외 식품을 저장했어요");
    } catch {
      setToast("알레르기 및 제외 식품을 저장하지 못했어요");
    } finally {
      setSavingAllergies(false);
    }
  };

  const toggleFavorite = async (mealId: string) => {
    const meal = getMeal(mealId, activePlan) ?? getMeal(mealId);
    if (!meal) return;
    try {
      if (favorites.includes(mealId)) {
        const favoriteId = favoriteRecipeIds[mealId];
        if (favoriteId) await backendFetch(`/api/favorites/recipes/${favoriteId}`, { method: "DELETE" });
        setFavorites((items) => items.filter((id) => id !== mealId));
        setFavoriteRecipeIds((items) => { const next = { ...items }; delete next[mealId]; return next; });
        setToast("즐겨찾기에서 삭제했어요");
      } else {
        const data = await backendFetch<{ recipe: { favoriteId: string; id: string } }>("/api/favorites/recipes", { method: "POST", body: JSON.stringify(meal) });
        setFavorites((items) => [...items, mealId]);
        setFavoriteRecipeIds((items) => ({ ...items, [mealId]: data.recipe.favoriteId }));
        setToast("즐겨찾기에 저장했어요");
      }
    } catch { setToast("즐겨찾기를 변경하지 못했어요"); }
  };

  const toggleFavoriteFood = async (food: FoodSearchResult) => {
    const exists = favoriteFoods.some((item) => item.id === food.id);
    try {
      if (exists) {
        const favoriteId = (favoriteFoods.find((item) => item.id === food.id) as FoodSearchResult & { favoriteId?: string })?.favoriteId;
        if (favoriteId) await backendFetch(`/api/favorites/foods/${favoriteId}`, { method: "DELETE" });
        setFavoriteFoods((items) => items.filter((item) => item.id !== food.id));
      } else {
        const data = await backendFetch<{ food: BackendFood }>("/api/favorites/foods", { method: "POST", body: JSON.stringify({ id: food.id, name: food.name, manufacturer: food.manufacturer, referenceAmount: food.servingSize ?? 100, unit: food.servingUnit ?? "g", nutrition: food.nutrition, source: food.source }) });
        setFavoriteFoods((items) => [...items, toFood(data.food)]);
      }
      setToast(exists ? "즐겨찾는 음식에서 삭제했어요" : "즐겨찾는 음식에 저장했어요");
    } catch { setToast("음식 즐겨찾기를 변경하지 못했어요"); }
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
      id: `temp-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
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

  const saveMealEntries = async () => {
    const previous = entries.filter((entry) => entry.date === selectedDate && entry.mealType === activeMealType);
    const keptIds = new Set(editingEntries.filter((entry) => !entry.id.startsWith("temp-")).map((entry) => entry.id));
    try {
      await Promise.all(previous.filter((entry) => !keptIds.has(entry.id)).map((entry) => backendFetch(`/api/diary/entries/${entry.id}`, { method: "DELETE" })));
      await Promise.all(editingEntries.filter((entry) => entry.id.startsWith("temp-")).map((entry) => backendFetch("/api/diary/entries", { method: "POST", body: JSON.stringify(entry) })));
      const diary = await backendFetch<{ entries: FoodEntry[] }>(`/api/diary?date=${selectedDate}`);
      setEntries((items) => [...items.filter((item) => item.date !== selectedDate), ...diary.entries]);
      const recents = await backendFetch<{ foods: BackendFood[] }>("/api/foods/recent");
      setRecentFoods(recents.foods.map((food, index) => ({ food: toFood(food), count: 1, lastUsedAt: new Date(Date.now() - index).toISOString() })));
      setScreen("home");
      setToast(`${diaryMealTypeLabel[activeMealType]} 기록을 저장했어요`);
    } catch { setToast("식사 기록을 저장하지 못했어요"); }
  };

  const createUserFood = async () => {
    if (creatingUserFood) return;
    const amount = Math.max(1, Number.parseFloat(userFoodDraft.amount) || 100);
    if (!userFoodDraft.name.trim()) {
      setToast("음식 이름을 입력해 주세요");
      return;
    }
    const nutrition = {
        calories: Math.max(0, Number.parseFloat(userFoodDraft.calories) || 0),
        carbs: Math.max(0, Number.parseFloat(userFoodDraft.carbs) || 0),
        protein: Math.max(0, Number.parseFloat(userFoodDraft.protein) || 0),
        fat: Math.max(0, Number.parseFloat(userFoodDraft.fat) || 0),
    };
    setCreatingUserFood(true);
    try {
      const data = await backendFetch<{ food: BackendFood }>("/api/foods/user", { method: "POST", body: JSON.stringify({ name: userFoodDraft.name.trim(), referenceAmount: amount, unit: userFoodDraft.unit, nutrition }) });
      const food = toUserFood(data.food);
      setUserFoods((items) => dedupeFoods([food, ...items]));
      setUserFoodDraft({ name: "", amount: "100", unit: "g", calories: "", carbs: "", protein: "", fat: "" });
      selectFood(food);
    } catch { setToast("직접 등록 음식을 저장하지 못했어요"); }
    finally { setCreatingUserFood(false); }
  };

  const generatePlan = async () => {
    setGenerating(true);
    setLoadingMessage(0);
    setAiReason(null);
    try {
      const request = backendFetch<{ plan: MealPlan; mode: "live" | "demo"; model?: string; reason?: string }>("/api/ai/meal-plan", {
        method: "POST",
        body: JSON.stringify({
          target,
          preferences: { cuisine: preference, goal, avoidFoods, availableIngredients },
          excludeMealNames: plan ? getAllMeals(plan).map((meal) => meal.name) : [],
          variationSeed: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
        }),
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
      localStorage.setItem("mealfit-ai-mode", nextMode);
      if (nextReason) localStorage.setItem("mealfit-ai-reason", nextReason);
      else localStorage.removeItem("mealfit-ai-reason");
      if (nextModel) localStorage.setItem("mealfit-ai-model", nextModel);
      else localStorage.removeItem("mealfit-ai-model");
      setToast(nextMode === "live" ? "AI 연결 성공" : aiReasonMessage(nextReason));
    } catch (error) {
      const reason = error instanceof Error ? error.message : "client_request_failed";
      const hasExclusions = avoidFoods.trim().length > 0;
      setPlan(hasExclusions ? null : mockMealPlan);
      setAiMode(hasExclusions ? null : "demo");
      setAiReason(reason);
      setAiModel(null);
      if (hasExclusions) localStorage.removeItem("mealfit-ai-mode");
      else localStorage.setItem("mealfit-ai-mode", "demo");
      localStorage.setItem("mealfit-ai-reason", reason);
      localStorage.removeItem("mealfit-ai-model");
      setToast(hasExclusions ? "제외 식품을 확인할 수 없어 추천을 만들지 않았어요. 다시 시도해 주세요." : aiReasonMessage(reason));
    } finally {
      setGenerating(false);
    }
  };

  const saveSchedule = async () => {
    if (!selectedMeal) return;
    const date = scheduleOffset === 3 ? customScheduleDate : isoDate(addDays(today, scheduleOffset));
    try {
      if (communitySchedulePostId) {
        await backendFetch(`/api/community/posts/${communitySchedulePostId}/plan`, { method: "POST", body: JSON.stringify({ date, mealType: scheduleType }) });
      } else {
        const path = editingPlannedId ? `/api/planned-meals/${editingPlannedId}` : "/api/planned-meals";
        await backendFetch(path, { method: editingPlannedId ? "PATCH" : "POST", body: JSON.stringify({ recipeId: selectedMeal.id, recipeName: selectedMeal.name, date, mealType: scheduleType, nutrition: selectedMeal.nutrition, recipe: selectedMeal }) });
      }
      const data = await backendFetch<{ plannedMeals: PlannedMeal[] }>(`/api/planned-meals?date=${date}`);
      setScheduled((items) => [...items.filter((item) => item.date !== date), ...data.plannedMeals]);
      setScheduleOpen(false);
      setSelectedMeal(null);
      setEditingPlannedId(null);
      setCommunitySchedulePostId(null);
      setSelectedDate(date);
      setScreen("home");
      setToast(`${date === isoDate(today) ? "오늘" : date} ${mealTypeLabel[scheduleType]}에 먹을 예정으로 등록했어요`);
    } catch { setToast("예정 식단을 저장하지 못했어요"); }
  };

  const markPlannedConsumed = async (planned: PlannedMeal) => {
    try {
      const data = await backendFetch<{ entry: FoodEntry }>(`/api/planned-meals/${planned.id}/consume`, { method: "POST" });
      setEntries((items) => [...items.filter((entry) => entry.id !== data.entry.id), data.entry]);
      setScheduled((items) => items.filter((item) => item.id !== planned.id));
      setToast(`${planned.recipeName}을 실제 섭취 기록으로 옮겼어요`);
    } catch { setToast("섭취 기록으로 옮기지 못했어요"); }
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

  const openShareReview = (meal: Meal) => {
    setShareReviewMeal(meal);
    setShareReviewDraft("");
  };

  const closeShareReview = () => {
    if (sharingMeal) return;
    setShareReviewMeal(null);
    setShareReviewDraft("");
  };

  const shareMeal = async () => {
    if (!shareReviewMeal || sharingMeal) return;
    const review = shareReviewDraft.trim();
    if (!review) {
      setToast("레시피 후기를 입력해 주세요");
      return;
    }
    setSharingMeal(true);
    try {
      const data = await backendFetch<{ post: CommunityPost }>("/api/community/posts", { method: "POST", body: JSON.stringify({ mealName: shareReviewMeal.name, caption: review, nutrition: shareReviewMeal.nutrition, recipe: shareReviewMeal }) });
      setCommunity((items) => [data.post, ...items]);
      setShareReviewMeal(null);
      setShareReviewDraft("");
      setSelectedMeal(null);
      setScreen("community");
      setToast("후기와 함께 레시피를 공유했어요");
    } catch { setToast("커뮤니티 공유에 실패했어요"); }
    finally { setSharingMeal(false); }
  };

  const shareFoodEntry = async (entry: FoodEntry) => {
    if (sharingEntryId) return;
    setSharingEntryId(entry.id);
    let persistedEntry = entry;
    let persistedDraft = false;
    try {
      if (entry.id.startsWith("temp-")) {
        const saved = await backendFetch<{ entry: FoodEntry }>("/api/diary/entries", { method: "POST", body: JSON.stringify(entry) });
        persistedEntry = saved.entry;
        persistedDraft = true;
        setEditingEntries((items) => items.map((item) => item.id === entry.id ? persistedEntry : item));
        setEntries((items) => [...items.filter((item) => item.id !== entry.id && item.id !== persistedEntry.id), persistedEntry]);
      }
      const data = await backendFetch<{ post: CommunityPost }>("/api/community/posts", { method: "POST", body: JSON.stringify({ foodEntryId: persistedEntry.id, caption: `${persistedEntry.foodName}, 오늘 맛있게 먹었어요!` }) });
      setCommunity((items) => [data.post, ...items]);
      setScreen("community");
      setToast("먹은 식사를 커뮤니티에 공유했어요");
    } catch { setToast(persistedDraft ? "섭취 기록은 저장했지만 커뮤니티에 공유하지 못했어요" : "섭취 기록을 공유하지 못했어요"); }
    finally { setSharingEntryId(null); }
  };

  const mealFromPost = (post: CommunityPost): Meal => post.recipe ?? {
    id: `community-${post.id}`,
    mealType: "dinner",
    name: post.mealName,
    description: post.caption,
    emoji: "🍽️",
    nutrition: post.nutrition,
    tags: ["커뮤니티 식단"],
    ingredients: [{ name: "공유한 식단", amount: "1인분", category: "other" }],
    instructions: ["게시물 작성자의 식단을 참고해 취향에 맞게 준비해 보세요."],
    cookingTimeMinutes: 10,
    difficulty: "easy",
  };

  const toggleCommunityLike = async (post: CommunityPost) => {
    try {
      const result = await backendFetch<{ likeCount: number; likedByMe: boolean }>(`/api/community/posts/${post.id}/like`, { method: post.likedByMe ? "DELETE" : "POST" });
      setCommunity((items) => items.map((item) => item.id === post.id ? { ...item, ...result } : item));
    } catch { setToast("좋아요를 변경하지 못했어요"); }
  };

  const togglePostComments = async (post: CommunityPost) => {
    const opening = !openComments[post.id];
    setOpenComments((items) => ({ ...items, [post.id]: opening }));
    if (opening && !comments[post.id]) {
      try {
        const data = await backendFetch<{ comments: CommunityComment[] }>(`/api/community/posts/${post.id}/comments`);
        setComments((items) => ({ ...items, [post.id]: data.comments }));
      } catch { setToast("댓글을 불러오지 못했어요"); }
    }
  };

  const addComment = async (post: CommunityPost) => {
    const content = commentDrafts[post.id]?.trim();
    if (!content) return;
    try {
      const data = await backendFetch<{ comment: CommunityComment }>(`/api/community/posts/${post.id}/comments`, { method: "POST", body: JSON.stringify({ content }) });
      setComments((items) => ({ ...items, [post.id]: [...(items[post.id] ?? []), data.comment] }));
      setCommentDrafts((items) => ({ ...items, [post.id]: "" }));
      setCommunity((items) => items.map((item) => item.id === post.id ? { ...item, commentCount: item.commentCount + 1 } : item));
    } catch { setToast("댓글을 등록하지 못했어요"); }
  };

  const deleteComment = async (postId: string, commentId: string) => {
    try {
      await backendFetch(`/api/community/comments/${commentId}`, { method: "DELETE" });
      setComments((items) => ({ ...items, [postId]: (items[postId] ?? []).filter((comment) => comment.id !== commentId) }));
      setCommunity((items) => items.map((item) => item.id === postId ? { ...item, commentCount: Math.max(0, item.commentCount - 1) } : item));
    } catch { setToast("댓글을 삭제하지 못했어요"); }
  };

  const deleteCommunityPost = async (postId: string) => {
    try {
      await backendFetch(`/api/community/posts/${postId}`, { method: "DELETE" });
      setCommunity((items) => items.filter((post) => post.id !== postId));
      setToast("게시물을 삭제했어요");
    } catch { setToast("게시물을 삭제하지 못했어요"); }
  };

  const planCommunityPost = (post: CommunityPost) => {
    setSelectedMeal(mealFromPost(post));
    setCommunitySchedulePostId(post.id);
    setEditingPlannedId(null);
    setScheduleOffset(1);
    setScheduleType("dinner");
    setScheduleOpen(true);
  };

  const logout = async () => {
    await backendFetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
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
                      <div><span className="diary-meal-icon"><MealTypeIcon type={mealType} size={34} /></span><h3>{diaryMealTypeLabel[mealType]}</h3></div>
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
          <button className="primary-cta food-add-cta" onClick={addSelectedFood}><span>목록에 담기</span><b>→</b></button>
        </main>
      </>
    );
  };

  const renderMealEditor = () => {
    const nutrition = addNutrition(editingEntries.map((entry) => entry.nutrition));
    return (
      <>
        <Header title={<span className="header-meal-title"><span className="header-meal-icon"><MealTypeIcon type={activeMealType} size={24} /></span>{diaryMealTypeLabel[activeMealType]}</span>} eyebrow={`${selectedDate} 실제 섭취`} onBack={() => setScreen("home")} />
        <main className="screen-content meal-editor-content">
          <section className="meal-editor-summary"><span>총 섭취량</span><h2>{nutrition.calories} <em>kcal</em></h2><MacroRow nutrition={nutrition} /></section>
          <section className="meal-editor-list">
            <div className="section-heading"><h2>먹은 음식</h2><span>{editingEntries.length}개</span></div>
            {editingEntries.length ? editingEntries.map((entry) => <article key={entry.id}><div><span>{entry.manufacturer ?? "섭취 기록"}</span><h3>{entry.foodName}</h3><p>{entry.amount}{entry.unit} · 탄 {entry.nutrition.carbs}g · 단 {entry.nutrition.protein}g · 지 {entry.nutrition.fat}g</p></div><strong>{entry.nutrition.calories} kcal</strong><button onClick={() => setEditingEntries((current) => current.filter((item) => item.id !== entry.id))} aria-label={`${entry.foodName} 삭제`}>×</button></article>) : <div className="meal-editor-empty"><span>＋</span><p>아직 담은 음식이 없어요.</p></div>}
          </section>
          {editingEntries.length > 0 && <div className="entry-share-list">{editingEntries.map((entry) => <button key={entry.id} className="outline-cta" disabled={sharingEntryId !== null} onClick={() => shareFoodEntry(entry)}>♧ {entry.foodName} {entry.id.startsWith("temp-") ? "저장 후 공유" : "커뮤니티에 공유"}</button>)}</div>}
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
          <button className="primary-cta compact" disabled={creatingUserFood} onClick={createUserFood}>{creatingUserFood ? "저장 중…" : "저장하고 섭취량 선택하기"}</button>
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
              <label className="pantry-input"><span><b>집에 있는 식재료</b><em>AI가 먼저 활용해요</em></span><textarea value={availableIngredients} maxLength={300} onChange={(event) => setAvailableIngredients(event.target.value)} placeholder="예: 달걀 4개, 바나나 2개, 오트밀, 김치" /><small>쉼표나 줄바꿈으로 구분해 주세요. 비워두어도 괜찮아요.</small></label>
              <label className="avoid-food-input"><span><b>알레르기·제외 식품</b><em>MY에 저장된 내용을 자동 적용해요</em></span><input maxLength={1000} value={avoidFoods} onChange={(event) => setAvoidFoods(event.target.value)} placeholder="예: 땅콩, 우유, 새우, 버섯" /></label>
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
            {aiMode === "demo" && (
              <div className="ai-connection-status demo" role="status">
                <span>!</span>
                <div>
                  <strong>현재 데모 모드</strong>
                  <p>{aiReasonMessage(aiReason)}</p>
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
            const meal = mealFromPost(post);
            return <article className="post-card" key={post.id}>
              <div className="post-author"><span>{post.author.nickname.slice(0, 1)}</span><div><strong>{post.author.nickname}</strong><em>{new Date(post.createdAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })}</em></div>{post.mine ? <button onClick={() => deleteCommunityPost(post.id)} aria-label="게시물 삭제">삭제</button> : <span />}</div>
              <p>{post.caption}</p>
              <button className="post-meal" onClick={() => openMeal(meal)}><MealVisual meal={meal} large /><div><span>{mealTypeLabel[meal.mealType]} 추천</span><h3>{meal.name}</h3><strong>{meal.nutrition.calories} kcal</strong><MacroRow nutrition={meal.nutrition} compact /></div><b>›</b></button>
              <div className="post-actions"><button className={post.likedByMe ? "active" : ""} onClick={() => toggleCommunityLike(post)}>{post.likedByMe ? "♥" : "♡"} {post.likeCount}</button><button onClick={() => togglePostComments(post)}>댓글 {post.commentCount}</button><button onClick={() => planCommunityPost(post)}>나도 먹어볼래요 →</button></div>
              {openComments[post.id] && <div className="post-comments">
                {(comments[post.id] ?? []).map((comment) => <div key={comment.id}><span>{comment.author.nickname.slice(0, 1)}</span><p><b>{comment.author.nickname}</b>{comment.content}</p>{comment.mine && <button onClick={() => deleteComment(post.id, comment.id)}>삭제</button>}</div>)}
                <form onSubmit={(event) => { event.preventDefault(); addComment(post); }}><input value={commentDrafts[post.id] ?? ""} onChange={(event) => setCommentDrafts((items) => ({ ...items, [post.id]: event.target.value }))} placeholder="따뜻한 댓글을 남겨 주세요" maxLength={1000} /><button>등록</button></form>
              </div>}
            </article>;
          })}
          {!community.length && <div className="compact-empty"><p>아직 공유된 식단이 없어요.</p><span>첫 식단을 공유해 보세요.</span></div>}
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
        <section className="profile-card"><div className="profile-avatar">{currentUser?.nickname.slice(0, 1) ?? "M"}<span>✦</span></div><div><span>오늘도 꾸준한</span><h2>{currentUser?.nickname ?? "밀핏 챌린저"}</h2><p>{currentUser?.email ?? "내 식단을 안전하게 저장하고 있어요"}</p></div></section>
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
        <section className="settings-list"><button onClick={openAllergyEditor}><span>⚑</span><div><b>알레르기 및 제외 식품</b><em>{avoidFoods.trim() || "등록된 식품 없음 · 비공개 프로필에 저장"}</em></div><i>›</i></button><button onClick={logout}><span>↪</span><div><b>로그아웃</b><em>다른 계정으로 전환하기</em></div><i>›</i></button></section>
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
                <div className="recipe-secondary-actions"><button onClick={() => toggleFavorite(selectedMeal.id)}>{favorites.includes(selectedMeal.id) ? "♥ 저장됨" : "♡ 즐겨찾기"}</button><button onClick={() => openShareReview(selectedMeal)}>♧ 후기와 함께 공유</button></div>
                <button className="primary-cta schedule-cta" onClick={() => { setEditingPlannedId(null); setCommunitySchedulePostId(null); setScheduleOpen(true); }}>이 메뉴 먹을래요</button>
              </div>
            </div>
          </div>
        )}

        {shareReviewMeal && (
          <div className="modal-layer share-review-layer" role="dialog" aria-modal="true" aria-label={`${shareReviewMeal.name} 후기 작성`}>
            <button className="modal-scrim" onClick={closeShareReview} aria-label="후기 작성 창 닫기" />
            <form className="share-review-sheet" onSubmit={(event) => { event.preventDefault(); void shareMeal(); }}>
              <div className="sheet-handle" />
              <div className="sheet-heading"><div><span>레시피 공유</span><h2>어땠는지 알려주세요</h2></div><button type="button" onClick={closeShareReview}>×</button></div>
              <div className="selected-meal-chip"><span>{shareReviewMeal.emoji}</span><div><b>{shareReviewMeal.name}</b><em>{shareReviewMeal.nutrition.calories} kcal</em></div></div>
              <label className="review-field"><span>나의 후기</span><textarea autoFocus required maxLength={500} value={shareReviewDraft} onChange={(event) => setShareReviewDraft(event.target.value)} placeholder="맛, 조리 난이도, 다음에 바꾸고 싶은 점을 자유롭게 적어보세요." /><small>{shareReviewDraft.length} / 500</small></label>
              <div className="share-review-actions"><button type="button" onClick={closeShareReview} disabled={sharingMeal}>취소</button><button type="submit" disabled={sharingMeal || !shareReviewDraft.trim()}>{sharingMeal ? "공유 중…" : "후기와 함께 공유"}</button></div>
            </form>
          </div>
        )}

        {allergyEditorOpen && (
          <div className="modal-layer allergy-layer" role="dialog" aria-modal="true" aria-label="알레르기 및 제외 식품 설정">
            <button className="modal-scrim" onClick={() => setAllergyEditorOpen(false)} aria-label="알레르기 설정 창 닫기" />
            <form className="allergy-sheet" onSubmit={(event) => { event.preventDefault(); void saveAllergies(); }}>
              <div className="sheet-handle" />
              <div className="sheet-heading"><div><span>PRIVATE PROFILE</span><h2>알레르기 및 제외 식품</h2></div><button type="button" onClick={() => setAllergyEditorOpen(false)}>×</button></div>
              <label className="allergy-field"><span>먹지 못하거나 피하고 싶은 식품</span><textarea autoFocus maxLength={1000} value={allergyDraft} onChange={(event) => setAllergyDraft(event.target.value)} placeholder="예: 땅콩, 우유, 새우, 복숭아, 버섯" /><small>쉼표나 줄바꿈으로 구분해 주세요. AI 추천 때 자동으로 제외합니다.</small></label>
              <p className="allergy-safety-note">AI가 생성한 레시피도 실제 섭취 전 원재료와 알레르기 표시를 다시 확인해 주세요.</p>
              <div className="share-review-actions"><button type="button" onClick={() => setAllergyEditorOpen(false)} disabled={savingAllergies}>취소</button><button type="submit" disabled={savingAllergies}>{savingAllergies ? "저장 중…" : "저장하기"}</button></div>
            </form>
          </div>
        )}

        {scheduleOpen && selectedMeal && (
          <div className="modal-layer schedule-layer" role="dialog" aria-modal="true" aria-label="식단 일정 선택">
            <button className="modal-scrim" onClick={() => { setScheduleOpen(false); setCommunitySchedulePostId(null); }} aria-label="일정 창 닫기" />
            <div className="schedule-sheet">
              <div className="sheet-handle" />
              <div className="sheet-heading"><div><span>식단에 추가</span><h2>언제 먹을까요?</h2></div><button onClick={() => { setScheduleOpen(false); setCommunitySchedulePostId(null); }}>×</button></div>
              <div className="selected-meal-chip"><span>{selectedMeal.emoji}</span><div><b>{selectedMeal.name}</b><em>{selectedMeal.nutrition.calories} kcal</em></div></div>
              <label className="sheet-label">날짜 선택</label>
              <div className="schedule-options date-options">{[0, 1, 2, 3].map((offset) => <button key={offset} onClick={() => setScheduleOffset(offset)} className={scheduleOffset === offset ? "active" : ""}><span>{dateChoiceLabel(offset)}</span><b>{offset === 3 ? "날짜" : shortDate(addDays(today, offset))}</b></button>)}</div>
              {scheduleOffset === 3 && <label className="custom-date-input"><span>날짜</span><input type="date" value={customScheduleDate} min={isoDate(today)} onChange={(event) => setCustomScheduleDate(event.target.value)} /></label>}
              <label className="sheet-label">끼니 선택</label>
              <div className="schedule-options meal-options">{(["breakfast", "lunch", "dinner"] as MealType[]).map((type) => <button key={type} onClick={() => setScheduleType(type)} className={scheduleType === type ? "active" : ""}><span className="meal-option-icon"><MealTypeIcon type={type} size={24} /></span>{mealTypeLabel[type]}</button>)}</div>
              <button className="primary-cta" onClick={saveSchedule}>{scheduleOffset === 3 ? customScheduleDate : dateChoiceLabel(scheduleOffset)} {mealTypeLabel[scheduleType]}에 등록하기</button>
            </div>
          </div>
        )}

        {toast && <Toast message={toast} />}
      </div>
    </div>
  );
}
