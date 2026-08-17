export type MealType = "breakfast" | "lunch" | "dinner";

export interface Nutrition {
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
}

export interface Ingredient {
  name: string;
  amount: string;
  category: "protein" | "vegetable" | "carbohydrate" | "sauce" | "other";
}

export interface Meal {
  id: string;
  mealType: MealType;
  name: string;
  description: string;
  emoji: string;
  nutrition: Nutrition;
  tags: string[];
  ingredients: Ingredient[];
  instructions: string[];
  cookingTimeMinutes: number;
  difficulty: "easy" | "medium" | "hard";
}

export interface MealPlanDay {
  day: number;
  nutrition: Nutrition;
  meals: Meal[];
}

export interface MealPlan {
  days: MealPlanDay[];
  shoppingSummary: {
    uniqueIngredientCount: number;
    reusedIngredientCount: number;
    reusedIngredients: Array<{
      ingredient: string;
      totalAmount: string;
      usedIn: string[];
    }>;
  };
}

export interface PlannedMeal {
  id: string;
  recipeId: string;
  date: string;
  mealType: MealType;
  completed: boolean;
}

const n = (calories: number, carbs: number, protein: number, fat: number): Nutrition => ({
  calories,
  carbs,
  protein,
  fat,
});

export const mealTypeLabel: Record<MealType, string> = {
  breakfast: "아침",
  lunch: "점심",
  dinner: "저녁",
};

export const mockMealPlan: MealPlan = {
  days: [
    {
      day: 1,
      nutrition: n(1940, 219, 150, 56),
      meals: [
        {
          id: "day1-breakfast",
          mealType: "breakfast",
          name: "그릭요거트 에그 토스트",
          description: "바쁜 아침에도 든든한 단백질 한 접시",
          emoji: "🍳",
          nutrition: n(470, 45, 31, 18),
          tags: ["고단백", "10분"],
          ingredients: [
            { name: "통밀 식빵", amount: "2장", category: "carbohydrate" },
            { name: "달걀", amount: "2개", category: "protein" },
            { name: "그릭요거트", amount: "100g", category: "protein" },
            { name: "양파", amount: "1/4개", category: "vegetable" },
          ],
          instructions: ["달걀을 8분간 삶아 굵게 으깨요.", "그릭요거트와 다진 양파를 섞어 소금·후추로 간해요.", "노릇하게 구운 통밀빵 위에 올려 완성해요."],
          cookingTimeMinutes: 10,
          difficulty: "easy",
        },
        {
          id: "day1-lunch",
          mealType: "lunch",
          name: "닭가슴살 현미 비빔밥",
          description: "채소를 넉넉히 담은 균형 잡힌 한 그릇",
          emoji: "🥗",
          nutrition: n(650, 82, 48, 16),
          tags: ["한그릇", "식이섬유"],
          ingredients: [
            { name: "닭가슴살", amount: "150g", category: "protein" },
            { name: "현미밥", amount: "180g", category: "carbohydrate" },
            { name: "달걀", amount: "1개", category: "protein" },
            { name: "양파", amount: "1/4개", category: "vegetable" },
            { name: "혼합 채소", amount: "150g", category: "vegetable" },
            { name: "고추장", amount: "1큰술", category: "sauce" },
          ],
          instructions: ["닭가슴살은 한입 크기로 잘라 노릇하게 구워요.", "그릇에 현미밥과 손질한 채소를 둘러 담아요.", "달걀 프라이와 닭가슴살을 올리고 고추장 소스를 곁들여요."],
          cookingTimeMinutes: 18,
          difficulty: "easy",
        },
        {
          id: "day1-dinner",
          mealType: "dinner",
          name: "닭다리살 제육볶음",
          description: "매콤달콤하게 볶아낸 오늘의 메인 메뉴",
          emoji: "🍗",
          nutrition: n(820, 92, 71, 22),
          tags: ["고단백", "집밥"],
          ingredients: [
            { name: "닭다리살", amount: "200g", category: "protein" },
            { name: "현미밥", amount: "180g", category: "carbohydrate" },
            { name: "양파", amount: "1/2개", category: "vegetable" },
            { name: "대파", amount: "1/2대", category: "vegetable" },
            { name: "고추장", amount: "1큰술", category: "sauce" },
            { name: "간장", amount: "1큰술", category: "sauce" },
          ],
          instructions: ["닭다리살을 먹기 좋은 크기로 자르고 양념과 버무려요.", "중불 팬에서 닭다리살을 6분간 충분히 익혀요.", "양파와 대파를 넣고 센 불에서 3분 더 볶아 현미밥과 내요."],
          cookingTimeMinutes: 15,
          difficulty: "easy",
        },
      ],
    },
    {
      day: 2,
      nutrition: n(1980, 221, 150, 59),
      meals: [
        {
          id: "day2-breakfast",
          mealType: "breakfast",
          name: "바나나 견과 오트밀 볼",
          description: "은은한 단맛으로 가볍게 여는 아침",
          emoji: "🥣",
          nutrition: n(480, 65, 27, 14),
          tags: ["간단", "포만감"],
          ingredients: [
            { name: "오트밀", amount: "60g", category: "carbohydrate" },
            { name: "그릭요거트", amount: "150g", category: "protein" },
            { name: "바나나", amount: "1개", category: "other" },
            { name: "아몬드", amount: "15g", category: "other" },
          ],
          instructions: ["오트밀에 물을 넣고 전자레인지에서 2분 익혀요.", "그릭요거트와 얇게 썬 바나나를 올려요.", "아몬드를 부숴 뿌리고 취향에 따라 계핏가루를 더해요."],
          cookingTimeMinutes: 6,
          difficulty: "easy",
        },
        {
          id: "day2-lunch",
          mealType: "lunch",
          name: "닭가슴살 김치볶음밥",
          description: "익숙한 맛에 단백질을 꽉 채운 한 끼",
          emoji: "🍚",
          nutrition: n(670, 86, 49, 17),
          tags: ["15분", "냉장고파먹기"],
          ingredients: [
            { name: "닭가슴살", amount: "150g", category: "protein" },
            { name: "현미밥", amount: "200g", category: "carbohydrate" },
            { name: "달걀", amount: "1개", category: "protein" },
            { name: "김치", amount: "100g", category: "vegetable" },
            { name: "양파", amount: "1/4개", category: "vegetable" },
          ],
          instructions: ["닭가슴살과 양파를 작게 썰어 먼저 볶아요.", "김치와 현미밥을 넣고 고슬고슬하게 볶아요.", "그릇에 담고 반숙 달걀 프라이를 올려요."],
          cookingTimeMinutes: 15,
          difficulty: "easy",
        },
        {
          id: "day2-dinner",
          mealType: "dinner",
          name: "두부 소고기 채소전골",
          description: "따뜻한 국물과 채소로 마무리하는 하루",
          emoji: "🍲",
          nutrition: n(830, 70, 74, 28),
          tags: ["고단백", "따뜻한한끼"],
          ingredients: [
            { name: "소고기", amount: "150g", category: "protein" },
            { name: "두부", amount: "200g", category: "protein" },
            { name: "양파", amount: "1/2개", category: "vegetable" },
            { name: "대파", amount: "1/2대", category: "vegetable" },
            { name: "혼합 채소", amount: "200g", category: "vegetable" },
            { name: "간장", amount: "1큰술", category: "sauce" },
          ],
          instructions: ["냄비에 양파와 채소를 깔고 두부를 올려요.", "소고기와 물 450ml, 간장 양념을 넣고 끓여요.", "거품을 걷고 대파를 넣어 7분 더 끓여요."],
          cookingTimeMinutes: 25,
          difficulty: "medium",
        },
      ],
    },
    {
      day: 3,
      nutrition: n(1980, 213, 142, 65),
      meals: [
        {
          id: "day3-breakfast",
          mealType: "breakfast",
          name: "달걀 채소 현미볶음밥",
          description: "남은 재료를 알뜰하게 쓰는 든든한 아침",
          emoji: "🍳",
          nutrition: n(500, 59, 32, 18),
          tags: ["재료재사용", "10분"],
          ingredients: [
            { name: "현미밥", amount: "150g", category: "carbohydrate" },
            { name: "달걀", amount: "2개", category: "protein" },
            { name: "양파", amount: "1/4개", category: "vegetable" },
            { name: "혼합 채소", amount: "100g", category: "vegetable" },
            { name: "간장", amount: "1작은술", category: "sauce" },
          ],
          instructions: ["양파와 남은 채소를 잘게 썰어 볶아요.", "달걀을 넣고 크게 저어 익혀요.", "현미밥과 간장을 넣어 센 불에서 빠르게 볶아요."],
          cookingTimeMinutes: 10,
          difficulty: "easy",
        },
        {
          id: "day3-lunch",
          mealType: "lunch",
          name: "닭다리살 들기름 메밀국수",
          description: "고소하고 산뜻하게 즐기는 단백질 면 요리",
          emoji: "🍜",
          nutrition: n(640, 78, 43, 17),
          tags: ["산뜻한맛", "20분"],
          ingredients: [
            { name: "닭다리살", amount: "180g", category: "protein" },
            { name: "메밀면", amount: "100g", category: "carbohydrate" },
            { name: "대파", amount: "1/2대", category: "vegetable" },
            { name: "혼합 채소", amount: "100g", category: "vegetable" },
            { name: "간장", amount: "1큰술", category: "sauce" },
          ],
          instructions: ["메밀면은 삶아 찬물에 여러 번 헹궈요.", "닭다리살은 소금·후추로 간해 노릇하게 구워요.", "면에 간장과 들기름을 버무리고 채소와 닭을 올려요."],
          cookingTimeMinutes: 20,
          difficulty: "easy",
        },
        {
          id: "day3-dinner",
          mealType: "dinner",
          name: "연어 간장구이와 구운 채소",
          description: "3일 플랜을 산뜻하게 마무리하는 한 접시",
          emoji: "🐟",
          nutrition: n(840, 76, 67, 30),
          tags: ["오메가3", "한접시"],
          ingredients: [
            { name: "연어", amount: "200g", category: "protein" },
            { name: "현미밥", amount: "180g", category: "carbohydrate" },
            { name: "양파", amount: "1/2개", category: "vegetable" },
            { name: "혼합 채소", amount: "200g", category: "vegetable" },
            { name: "간장", amount: "1큰술", category: "sauce" },
          ],
          instructions: ["연어의 물기를 닦고 간장 양념을 얇게 발라요.", "팬에서 껍질 쪽부터 4분, 뒤집어 3분 구워요.", "같은 팬에 양파와 채소를 구워 현미밥과 함께 담아요."],
          cookingTimeMinutes: 20,
          difficulty: "medium",
        },
      ],
    },
  ],
  shoppingSummary: {
    uniqueIngredientCount: 14,
    reusedIngredientCount: 6,
    reusedIngredients: [
      { ingredient: "현미밥", totalAmount: "890g", usedIn: ["DAY 1 점심·저녁", "DAY 2 점심", "DAY 3 아침·저녁"] },
      { ingredient: "달걀", totalAmount: "6개", usedIn: ["DAY 1 아침·점심", "DAY 2 점심", "DAY 3 아침"] },
      { ingredient: "양파", totalAmount: "2¼개", usedIn: ["3일 동안 7개 메뉴"] },
      { ingredient: "닭다리살", totalAmount: "380g", usedIn: ["DAY 1 저녁", "DAY 3 점심"] },
      { ingredient: "혼합 채소", totalAmount: "750g", usedIn: ["DAY 1 점심", "DAY 2 저녁", "DAY 3 세 끼"] },
      { ingredient: "간장", totalAmount: "약 5큰술", usedIn: ["DAY 1 저녁", "DAY 2 저녁", "DAY 3 세 끼"] },
    ],
  },
};

export const getAllMeals = (plan: MealPlan = mockMealPlan) => plan.days.flatMap((day) => day.meals);

export const getMeal = (id: string, plan: MealPlan = mockMealPlan) =>
  getAllMeals(plan).find((meal) => meal.id === id);

export const getIngredientPurchaseUrl = (ingredientName: string) =>
  `https://www.coupang.com/np/search?q=${encodeURIComponent(ingredientName)}`;

export const shoppingItems = [
  ["단백질", ["닭가슴살 300g", "닭다리살 380g", "달걀 6개", "두부 200g", "소고기 150g", "연어 200g", "그릭요거트 250g"]],
  ["채소", ["양파 3개", "대파 2대", "혼합 채소 750g", "김치 100g"]],
  ["탄수화물·기타", ["현미밥 890g", "통밀 식빵 2장", "오트밀 60g", "메밀면 100g", "바나나 1개", "아몬드 15g"]],
] as const;

export const communitySeed = [
  {
    id: "post-1",
    userName: "민지의 한 끼",
    avatar: "민",
    mealId: "day1-dinner",
    comment: "오늘 저녁으로 먹었는데 생각보다 진짜 맛있어요. 양파를 넉넉히 넣으니 더 달큰해요!",
    likes: 24,
    time: "12분 전",
  },
  {
    id: "post-2",
    userName: "프로틴대장",
    avatar: "프",
    mealId: "day2-lunch",
    comment: "닭가슴살이 지겨울 때 딱이에요. 현미밥으로 해도 고슬고슬하게 잘 볶아집니다.",
    likes: 41,
    time: "1시간 전",
  },
  {
    id: "post-3",
    userName: "오늘도 집밥",
    avatar: "오",
    mealId: "day3-dinner",
    comment: "장보기 목록대로 샀더니 냉장고에 애매하게 남는 재료가 거의 없었어요.",
    likes: 18,
    time: "3시간 전",
  },
];
