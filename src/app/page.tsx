"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  communitySeed,
  getAllMeals,
  getIngredientPurchaseUrl,
  getMeal,
  mealTypeLabel,
  mockMealPlan,
  shoppingItems,
  type Meal,
  type MealPlan,
  type MealType,
  type Nutrition,
  type PlannedMeal,
} from "@/lib/data";

type Screen = "home" | "ai" | "community" | "favorites" | "my" | "shopping";

const targetDefault: Nutrition = { calories: 2000, carbs: 220, protein: 150, fat: 60 };
const loadingMessages = [
  "목표 영양소를 계산하고 있어요",
  "겹쳐서 사용할 수 있는 식재료를 찾고 있어요",
  "3일치 아침·점심·저녁을 조합하고 있어요",
];

const navItems: Array<{ id: Screen; icon: string; label: string }> = [
  { id: "home", icon: "⌂", label: "홈" },
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
  return "모레";
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

function MiniMealCard({ meal, onOpen, isFavorite, onFavorite }: { meal: Meal; onOpen: () => void; isFavorite: boolean; onFavorite: () => void }) {
  return (
    <article className="mini-meal-card" onClick={onOpen} tabIndex={0} onKeyDown={(event) => event.key === "Enter" && onOpen()}>
      <MealVisual meal={meal} />
      <div className="mini-meal-body">
        <div className="meal-card-topline">
          <span>{mealTypeLabel[meal.mealType]}</span>
          <button
            className={`heart-button ${isFavorite ? "active" : ""}`}
            onClick={(event) => { event.stopPropagation(); onFavorite(); }}
            aria-label={isFavorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}
          >{isFavorite ? "♥" : "♡"}</button>
        </div>
        <h3>{meal.name}</h3>
        <div className="calorie-line"><strong>{meal.nutrition.calories}</strong> kcal <MacroRow nutrition={meal.nutrition} compact /></div>
      </div>
      <span className="card-arrow">›</span>
    </article>
  );
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
  const [scheduleType, setScheduleType] = useState<MealType>("dinner");
  const [selectedDay, setSelectedDay] = useState(0);
  const [toast, setToast] = useState("");
  const [aiMode, setAiMode] = useState<"live" | "demo" | null>(null);
  const today = useMemo(() => new Date(), []);
  const activePlan = plan ?? mockMealPlan;

  useEffect(() => {
    const restore = window.setTimeout(() => {
      try {
        const savedTarget = localStorage.getItem("mealfit-target");
        const savedPlan = localStorage.getItem("mealfit-plan");
        const savedFavorites = localStorage.getItem("mealfit-favorites");
        const savedScheduled = localStorage.getItem("mealfit-scheduled");
        if (savedTarget) setTarget(JSON.parse(savedTarget));
        if (savedPlan) setPlan(JSON.parse(savedPlan));
        if (savedFavorites) setFavorites(JSON.parse(savedFavorites));
        if (savedScheduled) setScheduled(JSON.parse(savedScheduled));
      } catch {
        // A damaged browser cache should never block the demo.
      }
    }, 0);
    return () => window.clearTimeout(restore);
  }, []);

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
    localStorage.setItem("mealfit-target", JSON.stringify(next));
  };

  const toggleFavorite = (mealId: string) => {
    const next = favorites.includes(mealId) ? favorites.filter((id) => id !== mealId) : [...favorites, mealId];
    setFavorites(next);
    localStorage.setItem("mealfit-favorites", JSON.stringify(next));
    setToast(next.includes(mealId) ? "즐겨찾기에 저장했어요" : "즐겨찾기에서 삭제했어요");
  };

  const generatePlan = async () => {
    setGenerating(true);
    setLoadingMessage(0);
    try {
      const request = fetch("/api/meal-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, preferences: { cuisine: preference, goal } }),
      }).then(async (response) => {
        if (!response.ok) throw new Error("meal plan request failed");
        return response.json();
      });
      const [data] = await Promise.all([request, new Promise((resolve) => setTimeout(resolve, 2300))]);
      const nextPlan = data.plan as MealPlan;
      if (!nextPlan?.days || nextPlan.days.length !== 3 || nextPlan.days.some((day) => day.meals.length !== 3)) throw new Error("invalid plan");
      setPlan(nextPlan);
      setAiMode(data.mode === "live" ? "live" : "demo");
      localStorage.setItem("mealfit-plan", JSON.stringify(nextPlan));
    } catch {
      setPlan(mockMealPlan);
      setAiMode("demo");
      localStorage.setItem("mealfit-plan", JSON.stringify(mockMealPlan));
      setToast("AI 연결이 불안정해 준비된 추천을 보여드려요");
    } finally {
      setGenerating(false);
    }
  };

  const saveSchedule = () => {
    if (!selectedMeal) return;
    const date = isoDate(addDays(today, scheduleOffset));
    const withoutSameSlot = scheduled.filter((item) => !(item.date === date && item.mealType === scheduleType));
    const next = [...withoutSameSlot, { id: `${date}-${scheduleType}`, recipeId: selectedMeal.id, date, mealType: scheduleType, completed: false }];
    setScheduled(next);
    localStorage.setItem("mealfit-scheduled", JSON.stringify(next));
    setScheduleOpen(false);
    setSelectedMeal(null);
    setSelectedDay(scheduleOffset);
    setScreen("home");
    setToast(`${dateChoiceLabel(scheduleOffset)} ${mealTypeLabel[scheduleType]} 식단에 추가했어요`);
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
  const selectedDate = isoDate(addDays(today, selectedDay));
  const dateTabs = [0, 1, 2].map((offset) => addDays(today, offset));

  const renderHome = () => {
    const defaultMeals = mockMealPlan.days[Math.min(selectedDay, 2)].meals;
    const dateScheduled = scheduled.filter((item) => item.date === selectedDate);
    const displayMeals = (["breakfast", "lunch", "dinner"] as MealType[]).map((type) => {
      const planned = dateScheduled.find((item) => item.mealType === type);
      const recipe = planned ? getMeal(planned.recipeId, activePlan) ?? getMeal(planned.recipeId) : undefined;
      return recipe ? { ...recipe, mealType: type } : defaultMeals.find((meal) => meal.mealType === type)!;
    });
    const consumed = selectedDay === 0 ? 1240 : displayMeals.reduce((sum, meal) => sum + meal.nutrition.calories, 0);
    const percent = Math.min(100, Math.round((consumed / target.calories) * 100));
    return (
      <>
        <Header title="오늘도 가볍게," eyebrow="안녕하세요 👋" />
        <main className="screen-content home-content">
          <section className="nutrition-hero">
            <div className="hero-title-row">
              <div><span className="section-kicker">오늘의 영양</span><h2>목표까지 잘 가고 있어요</h2></div>
              <button className="text-button" onClick={() => setScreen("my")}>목표 수정</button>
            </div>
            <div className="nutrition-main">
              <div className="progress-ring" style={{ "--progress": `${percent * 3.6}deg` } as CSSProperties}>
                <div><strong>{consumed.toLocaleString()}</strong><span>/ {target.calories.toLocaleString()} kcal</span></div>
              </div>
              <div className="macro-progress-list">
                {(["carbs", "protein", "fat"] as const).map((key, index) => {
                  const labels = ["탄수화물", "단백질", "지방"];
                  const current = selectedDay === 0 ? [136, 92, 38][index] : Math.round(target[key] * 0.96);
                  return <div key={key}><span>{labels[index]} <b>{current}</b> / {target[key]}g</span><i><em style={{ width: `${Math.min(100, current / target[key] * 100)}%` }} /></i></div>;
                })}
              </div>
            </div>
            <p className="estimate-note">영양 정보는 식재료와 조리법에 따른 추정치예요.</p>
          </section>

          <section className="ai-banner">
            <div className="spark-orb">✦</div>
            <div><span>3일 식단, 고민은 AI에게</span><h3>목표에 맞는 아홉 끼를<br />한 번에 설계해 드려요</h3></div>
            <button onClick={() => setScreen("ai")}>AI 식단 추천 <b>→</b></button>
          </section>

          <section className="today-section">
            <div className="section-heading"><div><span className="section-kicker">MEAL SCHEDULE</span><h2>나의 식단</h2></div><span className="count-badge">{dateScheduled.length ? `${dateScheduled.length}개 등록` : "오늘"}</span></div>
            <div className="date-tabs">
              {dateTabs.map((date, index) => <button key={isoDate(date)} className={selectedDay === index ? "active" : ""} onClick={() => setSelectedDay(index)}><span>{["일", "월", "화", "수", "목", "금", "토"][date.getDay()]}</span><strong>{date.getDate()}</strong>{index === 0 && <i />}</button>)}
            </div>
            <div className="meal-list">
              {displayMeals.map((meal) => <MiniMealCard key={`${selectedDate}-${meal.mealType}`} meal={meal} onOpen={() => openMeal(meal)} isFavorite={favorites.includes(meal.id)} onFavorite={() => toggleFavorite(meal.id)} />)}
            </div>
          </section>
        </main>
      </>
    );
  };

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
              <div className="chip-group">{["한식", "간편식", "집밥", "매콤한 맛"].map((item) => <button key={item} onClick={() => setPreference(item)} className={preference === item ? "active" : ""}>{item}</button>)}</div>
              <div className="chip-group secondary">{["고단백", "균형식", "저탄수", "재료 최소화"].map((item) => <button key={item} onClick={() => setGoal(item)} className={goal === item ? "active" : ""}>{item}</button>)}</div>
            </section>
            <button className="primary-cta" onClick={generatePlan}><span>✦</span> 3일 식단 만들기 <b>→</b></button>
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
              <span>{aiMode === "live" ? "AI 식단 완성" : "안정적인 데모 식단"}</span>
              <h2>다음 3일의 식사가<br />준비됐어요</h2>
              <p>목표 영양과 장보기 효율을 함께 맞췄어요.</p>
            </div>
            <div className="plan-summary-strip"><div><strong>3</strong><span>일</span></div><i /><div><strong>9</strong><span>끼</span></div><i /><div><strong>{plan.shoppingSummary.uniqueIngredientCount}</strong><span>주요 재료</span></div></div>
            {plan.days.map((day) => (
              <article className="plan-day" key={day.day}>
                <div className="plan-day-header"><div><span>DAY {day.day}</span><h3>{day.day === 1 ? "기분 좋은 시작" : day.day === 2 ? "익숙한 재료, 새로운 조합" : "가볍고 든든한 마무리"}</h3></div><div><strong>{day.nutrition.calories.toLocaleString()}</strong><span>kcal</span></div></div>
                <MacroRow nutrition={day.nutrition} />
                <div className="plan-meals">{day.meals.map((meal) => <MiniMealCard key={meal.id} meal={meal} onOpen={() => openMeal(meal)} isFavorite={favorites.includes(meal.id)} onFavorite={() => toggleFavorite(meal.id)} />)}</div>
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
            <button className="outline-cta" onClick={() => { setPlan(null); setAiMode(null); }}>취향을 바꿔 다시 추천받기</button>
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
        <Header title="즐겨찾기" eyebrow="SAVED RECIPES" />
        <main className="screen-content favorites-content">
          <section className="simple-hero"><span>나중에도 꺼내 먹을</span><h2>나의 레시피 서랍</h2><p>마음에 든 메뉴를 다시 보고, 바로 식단에 등록하세요.</p></section>
          {meals.length ? <div className="favorite-grid">{meals.map((meal) => <article key={meal.id} className="favorite-card" onClick={() => openMeal(meal)}><MealVisual meal={meal} large /><button onClick={(event) => { event.stopPropagation(); toggleFavorite(meal.id); }}>♥</button><div><span>{meal.cookingTimeMinutes}분 · {meal.difficulty === "easy" ? "쉬움" : "보통"}</span><h3>{meal.name}</h3><strong>{meal.nutrition.calories} kcal</strong><MacroRow nutrition={meal.nutrition} compact /></div></article>)}</div> : <section className="empty-state"><div>♡</div><h3>아직 저장한 레시피가 없어요</h3><p>추천 식단에서 마음에 드는 메뉴에<br />하트를 눌러 저장해 보세요.</p><button onClick={() => setScreen("ai")}>AI 추천 보러 가기</button></section>}
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
          {(["calories", "carbs", "protein", "fat"] as const).map((key, index) => {
            const labels = ["칼로리", "탄수화물", "단백질", "지방"];
            const units = ["kcal", "g", "g", "g"];
            return <label className="goal-input" key={key}><span><i className={key} />{labels[index]}</span><div><input type="number" min="1" value={target[key]} onChange={(event) => saveTarget({ ...target, [key]: Number(event.target.value) })} /><em>{units[index]}</em></div></label>;
          })}
          <button className="primary-cta compact" onClick={() => { setToast("영양 목표를 저장했어요"); setScreen("home"); }}>목표 저장하기</button>
        </section>
        <section className="settings-list"><button><span>🥬</span><div><b>선호 식단</b><em>한식 · 고단백</em></div><i>›</i></button><button><span>⚑</span><div><b>알레르기 및 제외 식품</b><em>설정 안 함</em></div><i>›</i></button><button><span>↻</span><div><b>데모 데이터 초기화</b><em>저장된 식단과 즐겨찾기 삭제</em></div><i>›</i></button></section>
      </main>
    </>
  );

  const currentContent = screen === "home" ? renderHome() : screen === "ai" ? renderAI() : screen === "shopping" ? renderShopping() : screen === "community" ? renderCommunity() : screen === "favorites" ? renderFavorites() : renderMy();

  return (
    <div className="page-backdrop">
      <div className="app-shell">
        {currentContent}
        {screen !== "shopping" && (
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
                <button className="primary-cta schedule-cta" onClick={() => setScheduleOpen(true)}>＋ 식단에 추가</button>
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
              <div className="schedule-options date-options">{[0, 1, 2].map((offset) => <button key={offset} onClick={() => setScheduleOffset(offset)} className={scheduleOffset === offset ? "active" : ""}><span>{dateChoiceLabel(offset)}</span><b>{shortDate(addDays(today, offset))}</b></button>)}</div>
              <label className="sheet-label">끼니 선택</label>
              <div className="schedule-options meal-options">{(["breakfast", "lunch", "dinner"] as MealType[]).map((type) => <button key={type} onClick={() => setScheduleType(type)} className={scheduleType === type ? "active" : ""}><span>{type === "breakfast" ? "☀" : type === "lunch" ? "◐" : "☾"}</span>{mealTypeLabel[type]}</button>)}</div>
              <button className="primary-cta" onClick={saveSchedule}>{dateChoiceLabel(scheduleOffset)} {mealTypeLabel[scheduleType]}에 추가하기</button>
            </div>
          </div>
        )}

        {toast && <Toast message={toast} />}
      </div>
    </div>
  );
}
