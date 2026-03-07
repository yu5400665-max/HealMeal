let _aiChatsMigrated = false;
let _aiChatsMigrating = false;
import { getTodayDate } from "./date";
import { DISCLAIMER } from "./constants";
import type {
  AiChatRecord,
  AppSettings,
  ChatSession,
  CheckinPreferences,
  DailyCheckin,
  EcoPost,
  FamilyMessage,
  FamilyTask,
  MealPlan,
  MealSettingsDynamic,
  PublishDraft,
  Profile
} from "./types";

type AIHistoryScenario = "home" | "meal" | "exercise" | "emotion" | "family";

const KEYS = {
  profile: "profile",
  mealSettingsDynamic: "mealSettingsDynamic",
  dailyMealPlan: "dailyMealPlan",
  dailyCheckin: "dailyCheckin",
  ecosystemPosts: "ecosystemPosts",
  familyMessages: "familyMessages",
  familyTasks: "familyTasks",
  aiChatHistoryHome: "aiChatHistory_home",
  aiChatHistoryMeal: "aiChatHistory_meal",
  aiChatHistoryExercise: "aiChatHistory_exercise",
  aiChatHistoryEmotion: "aiChatHistory_emotion",
  aiChatHistoryFamily: "aiChatHistory_family",
  lastCompletedMealKey: "lastCompletedMealKey",
  chatSessions: "chatSessions",
  appSettings: "appSettings",
  homeMotivationHistory: "homeMotivationHistory",
  checkinPreferences: "checkinPreferences",
  pendingPublishDraft: "pendingPublishDraft"
} as const;

const LEGACY_KEYS = {
  todayMealPlan: "todayMealPlan",
  checkins: "checkins",
  ecoPosts: "ecoPosts",
  aiChats: "aiChats"
} as const;

const DEFAULT_NUTRITION = {
  caloriesKcal: 320,
  proteinG: 18,
  carbsG: 32,
  fatG: 9
} as const;

function isBrowser() {
  return typeof window !== "undefined";
}

function nowISO() {
  return new Date().toISOString();
}

function readJSON<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function removeKey(key: string) {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function defaultProfile(): Profile {
  const now = nowISO();
  return {
    role: "patient",
    nickname: "康复伙伴",
    age: 30,
    gender: "female",
    surgeryCategory: "普外",
    surgeryName: "阑尾术后",
    surgeryDisplayName: "阑尾术后",
    chronicDiseaseGroup: "无",
    chronicConditions: [],
    surgeryDate: "",
    postOpDay: 7,
    allergens: [],
    longTermAvoidFoods: ["不吃辛辣"],
    pantryFoods: ["鸡蛋", "南瓜", "豆腐"],
    region: "深圳",
    familyLinkEnabled: true,
    privacyConsentAccepted: true,
    privacyConsentAt: now,
    createdAt: now,
    updatedAt: now
  };
}

function defaultCheckinPreferences(): CheckinPreferences {
  return {
    exerciseGoalMinutes: 30,
    waterGoalMl: 1500
  };
}

function defaultMealSettings(date = getTodayDate(), profile?: Profile): MealSettingsDynamic {
  return {
    date,
    dietStage: "清淡",
    symptom: "无",
    appetite: "一般",
    mealTemplate: "均衡版",
    customMealCounts: { breakfast: 1, lunch: 3, dinner: 3, snack: 1 },
    stylePreference: "家常",
    simplifyGoal: "balanced",
    nauseaLevel: "无",
    dietModes: ["清淡", "温热"],
    avoidFoods: profile?.longTermAvoidFoods || profile?.avoidFoods || [],
    customAvoidFoods: [],
    availableIngredients: (profile?.pantryFoods || []).join("，"),
    cookingTimeMinutes: 30,
    strategyHint: "优先蒸煮炖，保持少量多餐，避免辛辣和过烫。",
    updatedAt: nowISO()
  };
}

function defaultEcoPosts(profile?: Profile): EcoPost[] {
  const surgery = profile?.surgeryDisplayName || "术后恢复";
  const now = nowISO();
  return [
    {
      id: "eco-1",
      user: "术后小雨",
      surgeryTag: surgery,
      postOpDay: 12,
      category: "术后饮食",
      title: "术后第12天，南瓜粥+蒸蛋真的友好",
      content: "把晚餐改成蒸煮后，胃胀明显少了。少量多餐更稳。",
      imageUrl: "/meal-placeholder.svg",
      tags: ["清淡", "易消化"],
      likes: 128,
      favorites: 58,
      comments: 26,
      shares: 12,
      privacy: "public",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "eco-2",
      user: "康复小棠",
      surgeryTag: "甲状腺术后",
      postOpDay: 21,
      category: "术后饮食",
      title: "一周早餐不重样，我这样做",
      content: "山药粥、鸡丝面、豆腐羹轮换，重点是温热和软烂。",
      tags: ["早餐", "不重样", "温热"],
      likes: 77,
      favorites: 30,
      comments: 14,
      shares: 8,
      privacy: "public",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "eco-3",
      user: "慢慢恢复中",
      surgeryTag: "骨科术后",
      postOpDay: 32,
      category: "康复训练",
      title: "每天拉伸10分钟，坚持比强度更重要",
      content: "从10分钟开始更容易坚持，体感也更好。",
      tags: ["拉伸", "坚持", "循序渐进"],
      likes: 88,
      favorites: 33,
      comments: 17,
      shares: 9,
      privacy: "public",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "eco-4",
      user: "清晨散步人",
      surgeryTag: "泌尿术后",
      postOpDay: 18,
      category: "康复训练",
      title: "30分钟散步拆成3段，完成率更高",
      content: "早餐后10分钟、午后10分钟、晚饭后10分钟，轻松不少。",
      tags: ["散步", "分段训练"],
      likes: 65,
      favorites: 26,
      comments: 11,
      shares: 6,
      privacy: "public",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "eco-5",
      user: "今天也要好好吃饭",
      surgeryTag: "术后恢复",
      postOpDay: 15,
      category: "情绪陪伴",
      title: "情绪低落时，我会这样和自己说",
      content: "恢复慢一点没关系，今天按时吃一餐就是进步。",
      tags: ["情绪", "鼓励"],
      likes: 143,
      favorites: 88,
      comments: 26,
      shares: 17,
      privacy: "public",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "eco-6",
      user: "夜晚的微光",
      surgeryTag: "心胸术后",
      postOpDay: 9,
      category: "情绪陪伴",
      title: "焦虑的时候先做这三件小事",
      content: "喝温水、深呼吸、写下今天做成的一件事。",
      tags: ["陪伴", "自我调节"],
      likes: 52,
      favorites: 21,
      comments: 9,
      shares: 5,
      privacy: "public",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "eco-7",
      user: "陪护阿姨",
      surgeryTag: "家属陪护",
      postOpDay: 1,
      category: "家属经验",
      title: "给长辈做饭的三个小技巧",
      content: "提前备菜、一次少做、温热上桌，既减轻负担也能保证节奏。",
      tags: ["家属", "备餐", "实操"],
      likes: 72,
      favorites: 32,
      comments: 11,
      shares: 9,
      privacy: "public",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "eco-8",
      user: "温柔提醒员",
      surgeryTag: "家属陪护",
      postOpDay: 1,
      category: "家属经验",
      title: "提醒喝水别硬催，这样说更有效",
      content: "把提醒拆成具体动作：现在喝三口、十分钟后再补一点。",
      tags: ["沟通", "提醒"],
      likes: 41,
      favorites: 17,
      comments: 7,
      shares: 4,
      privacy: "public",
      createdAt: now,
      updatedAt: now
    }
  ];
}

function normalizeDishFlags(plan: MealPlan): MealPlan {
  return {
    ...plan,
    meals: (Array.isArray(plan.meals) ? plan.meals : []).map((dish) => {
      const rawNutrition = dish.nutrition || {};
      return {
        ...dish,
        id: dish.id || `${dish.mealType}-${dish.dishName}-${Math.random().toString(36).slice(2, 8)}`,
        ingredients: Array.isArray(dish.ingredients) ? dish.ingredients : [],
        steps: Array.isArray(dish.steps) ? dish.steps : [],
        tags: Array.isArray(dish.tags) ? dish.tags : [],
        alternatives: Array.isArray(dish.alternatives) ? dish.alternatives : [],
        nutrition: {
          caloriesKcal: Number(rawNutrition.caloriesKcal) || DEFAULT_NUTRITION.caloriesKcal,
          proteinG: Number(rawNutrition.proteinG) || DEFAULT_NUTRITION.proteinG,
          carbsG: Number(rawNutrition.carbsG) || DEFAULT_NUTRITION.carbsG,
          fatG: Number(rawNutrition.fatG) || DEFAULT_NUTRITION.fatG
        },
        adopted: Boolean(dish.adopted),
        completed: Boolean(dish.completed)
      };
    })
  };
}

function readPlanRecord() {
  const current = readJSON<Record<string, MealPlan>>(KEYS.dailyMealPlan, {});
  if (Object.keys(current).length > 0) return current;

  const legacy = readJSON<MealPlan | null>(LEGACY_KEYS.todayMealPlan, null);
  if (legacy?.date) {
    const migrated = { [legacy.date]: normalizeDishFlags(legacy) };
    writeJSON(KEYS.dailyMealPlan, migrated);
    return migrated;
  }

  return {} as Record<string, MealPlan>;
}

function readCheckinRecord() {
  const current = readJSON<Record<string, DailyCheckin>>(KEYS.dailyCheckin, {});
  if (Object.keys(current).length > 0) return current;

  const legacy = readJSON<Record<string, DailyCheckin>>(LEGACY_KEYS.checkins, {});
  if (Object.keys(legacy).length > 0) {
    writeJSON(KEYS.dailyCheckin, legacy);
    return legacy;
  }

  return {} as Record<string, DailyCheckin>;
}

function readEcosystemPosts() {
  const current = readJSON<EcoPost[]>(KEYS.ecosystemPosts, []);
  if (current.length > 0) return current;
  const legacy = readJSON<EcoPost[]>(LEGACY_KEYS.ecoPosts, []);
  if (legacy.length > 0) {
    writeJSON(KEYS.ecosystemPosts, legacy);
    return legacy;
  }
  return [];
}

function getHistoryKey(scenario: AIHistoryScenario) {
  if (scenario === "home") return KEYS.aiChatHistoryHome;
  if (scenario === "meal") return KEYS.aiChatHistoryMeal;
  if (scenario === "exercise") return KEYS.aiChatHistoryExercise;
  if (scenario === "emotion") return KEYS.aiChatHistoryEmotion;
  return KEYS.aiChatHistoryFamily;
}

function normalizeScenarioFromMode(mode: AiChatRecord["mode"]): AIHistoryScenario {
  if (mode === "meal" || mode === "meal-qa") return "meal";
  if (mode === "exercise") return "exercise";
  if (mode === "emotion" || mode === "emotion-summary" || mode === "checkin-summary" || mode === "journal-summary") return "emotion";
  if (mode === "family" || mode === "family-encourage") return "family";
  return "home";
}

function migrateLegacyAiChats() {
  if (_aiChatsMigrated || _aiChatsMigrating) return;
  _aiChatsMigrating = true;

  try {
    // ✅ 不要调用 getAiChatHistory（会递归）
    const hasNewHistory =
      readJSON<AiChatRecord[]>(getHistoryKey("home"), []).length +
      readJSON<AiChatRecord[]>(getHistoryKey("meal"), []).length +
      readJSON<AiChatRecord[]>(getHistoryKey("exercise"), []).length +
      readJSON<AiChatRecord[]>(getHistoryKey("emotion"), []).length +
      readJSON<AiChatRecord[]>(getHistoryKey("family"), []).length >
      0;

    if (hasNewHistory) {
      _aiChatsMigrated = true;
      return;
    }

    const legacy = readJSON<AiChatRecord[]>(LEGACY_KEYS.aiChats, []);
    if (legacy.length === 0) {
      _aiChatsMigrated = true;
      return;
    }

    const buckets: Record<AIHistoryScenario, AiChatRecord[]> = {
      home: [],
      meal: [],
      exercise: [],
      emotion: [],
      family: [],
    };

    legacy.forEach((item) => {
      buckets[normalizeScenarioFromMode(item.mode)].push(item);
    });

    (Object.keys(buckets) as AIHistoryScenario[]).forEach((scenario) => {
      if (buckets[scenario].length > 0) {
        writeJSON(getHistoryKey(scenario), buckets[scenario].slice(0, 200));
      }
    });

    _aiChatsMigrated = true;
  } finally {
    _aiChatsMigrating = false;
  }
}

export function getProfile(): Profile | null {
  const raw = readJSON<Partial<Profile> | null>(KEYS.profile, null);
  if (!raw) return null;
  const now = nowISO();

  return {
    ...defaultProfile(),
    ...raw,
    gender: raw.gender === "male" ? "male" : "female",
    surgeryCategory: raw.surgeryCategory === "甲乳外科" ? "甲乳" : raw.surgeryCategory || defaultProfile().surgeryCategory,
    surgeryDisplayName:
      raw.surgeryDisplayName || raw.surgeryFinal || raw.surgeryName || raw.surgeryCustomName || raw.surgeryCustom,
    chronicDiseaseGroup: raw.chronicDiseaseGroup || "无",
    chronicConditions: Array.isArray(raw.chronicConditions) ? raw.chronicConditions : [],
    longTermAvoidFoods: Array.isArray(raw.longTermAvoidFoods)
      ? raw.longTermAvoidFoods
      : Array.isArray(raw.avoidFoods)
        ? raw.avoidFoods
        : [],
    allergens: Array.isArray(raw.allergens) ? raw.allergens : [],
    pantryFoods: Array.isArray(raw.pantryFoods) ? raw.pantryFoods : [],
    region: raw.region || "深圳",
    familyLinkEnabled: typeof raw.familyLinkEnabled === "boolean" ? raw.familyLinkEnabled : true,
    privacyConsentAccepted: typeof raw.privacyConsentAccepted === "boolean" ? raw.privacyConsentAccepted : true,
    privacyConsentAt: raw.privacyConsentAt || undefined,
    supabaseUserId: raw.supabaseUserId || undefined,
    createdAt: raw.createdAt || now,
    updatedAt: now
  };
}

export function setProfile(profile: Profile) {
  const previous = getProfile();
  writeJSON(KEYS.profile, {
    ...profile,
    createdAt: profile.createdAt || previous?.createdAt || nowISO(),
    updatedAt: nowISO()
  });
}

export function patchProfile(patch: Partial<Profile>) {
  const current = getProfile();
  if (!current) return null;
  const next = {
    ...current,
    ...patch,
    updatedAt: nowISO()
  } as Profile;
  writeJSON(KEYS.profile, next);
  return next;
}

export function ensureMockProfile() {
  const profile = getProfile();
  if (!profile) {
    const fallback = defaultProfile();
    setProfile(fallback);
    return fallback;
  }
  return profile;
}

export function getMealSettingsDynamic(date = getTodayDate()): MealSettingsDynamic {
  const profile = getProfile() || defaultProfile();
  const all = readJSON<Record<string, MealSettingsDynamic>>(KEYS.mealSettingsDynamic, {});
  const found = all[date];
  if (found) {
    const defaults = defaultMealSettings(date, profile);
    const defaultCounts = defaults.customMealCounts || { breakfast: 1, lunch: 3, dinner: 3, snack: 1 };
    return {
      ...defaults,
      ...found,
      customMealCounts: {
        ...defaultCounts,
        ...(found.customMealCounts || {})
      },
      customAvoidFoods: Array.isArray(found.customAvoidFoods) ? found.customAvoidFoods : defaults.customAvoidFoods
    };
  }
  const fallback = defaultMealSettings(date, profile);
  all[date] = fallback;
  writeJSON(KEYS.mealSettingsDynamic, all);
  return fallback;
}

export function setMealSettingsDynamic(settings: MealSettingsDynamic) {
  const all = readJSON<Record<string, MealSettingsDynamic>>(KEYS.mealSettingsDynamic, {});
  all[settings.date] = { ...settings, updatedAt: nowISO() };
  writeJSON(KEYS.mealSettingsDynamic, all);
}

export function getDailyMealPlan(date = getTodayDate()): MealPlan | null {
  const all = readPlanRecord();
  const plan = all[date];
  return plan ? normalizeDishFlags(plan) : null;
}

export function setDailyMealPlan(plan: MealPlan) {
  const all = readPlanRecord();
  all[plan.date] = normalizeDishFlags(plan);
  writeJSON(KEYS.dailyMealPlan, all);
}

export function updateDishStatus(date: string, dishId: string, patch: Partial<MealPlan["meals"][number]>) {
  const plan = getDailyMealPlan(date);
  if (!plan) return null;
  let lastCompletedMeal = "";
  const next: MealPlan = {
    ...plan,
    meals: plan.meals.map((dish) => {
      if (dish.id !== dishId) return dish;
      const updated = { ...dish, ...patch };
      if (!dish.completed && Boolean(updated.completed)) {
        lastCompletedMeal = `${dish.mealType}|${updated.dishName}`;
      }
      return updated;
    })
  };
  setDailyMealPlan(next);
  if (lastCompletedMeal) {
    writeJSON(KEYS.lastCompletedMealKey, lastCompletedMeal);
  }
  return next;
}

export function computeMealCompletionFromPlan(plan: MealPlan | null) {
  if (!plan) return 0;
  const weights: Record<string, number> = { 早餐: 25, 午餐: 30, 晚餐: 30, 加餐: 15 };
  const seen: Record<string, boolean> = { 早餐: false, 午餐: false, 晚餐: false, 加餐: false };
  let score = 0;
  plan.meals.forEach((dish) => {
    if (dish.completed && !seen[dish.mealType]) {
      score += weights[dish.mealType] || 0;
      seen[dish.mealType] = true;
    }
  });
  return Math.min(100, Math.max(0, score));
}

export function getDailyCheckin(date = getTodayDate()): DailyCheckin | null {
  return readCheckinRecord()[date] || null;
}

export function setDailyCheckin(entry: DailyCheckin) {
  const all = readCheckinRecord();
  all[entry.date] = { ...entry, updatedAt: nowISO() };
  writeJSON(KEYS.dailyCheckin, all);
}

export function getAllCheckins() {
  return readCheckinRecord();
}

export function getEcoPosts() {
  const profile = getProfile() || defaultProfile();
  const posts = readEcosystemPosts();
  if (posts.length > 0) return posts;
  const fallback = defaultEcoPosts(profile);
  writeJSON(KEYS.ecosystemPosts, fallback);
  return fallback;
}

export function setEcoPosts(posts: EcoPost[]) {
  writeJSON(KEYS.ecosystemPosts, posts);
}

export function addEcoPost(post: EcoPost) {
  const list = getEcoPosts();
  setEcoPosts([{ ...post, updatedAt: nowISO() }, ...list]);
}

export function updateEcoPostCounters(id: string, patch: Partial<Pick<EcoPost, "likes" | "favorites" | "comments" | "shares">>) {
  const list = getEcoPosts().map((item) => (item.id === id ? { ...item, ...patch, updatedAt: nowISO() } : item));
  setEcoPosts(list);
}

export function getFamilyMessages() {
  return readJSON<FamilyMessage[]>(KEYS.familyMessages, []);
}

export function addFamilyMessage(content: string) {
  const list = getFamilyMessages();
  const message: FamilyMessage = {
    id: `${Date.now()}`,
    content,
    createdAt: nowISO()
  };
  writeJSON(KEYS.familyMessages, [message, ...list].slice(0, 100));
}

export function getFamilyTasks(date = getTodayDate()) {
  const all = readJSON<Record<string, FamilyTask[]>>(KEYS.familyTasks, {});
  return Array.isArray(all[date]) ? all[date] : [];
}

export function getFamilyTasksWindow(startDate = getTodayDate(), days = 7) {
  const all = readJSON<Record<string, FamilyTask[]>>(KEYS.familyTasks, {});
  const safeDays = Math.max(1, Math.min(30, Math.floor(days || 7)));
  const start = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return [];

  const result: FamilyTask[] = [];
  for (let index = 0; index < safeDays; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    const list = Array.isArray(all[key]) ? all[key] : [];
    result.push(...list);
  }
  return result.sort((a, b) => {
    if (a.date === b.date) return a.createdAt > b.createdAt ? 1 : -1;
    return a.date > b.date ? 1 : -1;
  });
}

export function addFamilyTask(task: Omit<FamilyTask, "id" | "createdAt" | "updatedAt">) {
  const all = readJSON<Record<string, FamilyTask[]>>(KEYS.familyTasks, {});
  const nextTask: FamilyTask = {
    ...task,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: nowISO(),
    updatedAt: nowISO()
  };
  const current = Array.isArray(all[task.date]) ? all[task.date] : [];
  all[task.date] = [nextTask, ...current];
  writeJSON(KEYS.familyTasks, all);
  return nextTask;
}

export function updateFamilyTask(date: string, taskId: string, patch: Partial<FamilyTask>) {
  const all = readJSON<Record<string, FamilyTask[]>>(KEYS.familyTasks, {});
  const current = Array.isArray(all[date]) ? all[date] : [];
  const next = current.map((task) => (task.id === taskId ? { ...task, ...patch, updatedAt: nowISO() } : task));
  all[date] = next;
  writeJSON(KEYS.familyTasks, all);
  return next;
}

export function removeFamilyTask(date: string, taskId: string) {
  const all = readJSON<Record<string, FamilyTask[]>>(KEYS.familyTasks, {});
  const current = Array.isArray(all[date]) ? all[date] : [];
  all[date] = current.filter((task) => task.id !== taskId);
  writeJSON(KEYS.familyTasks, all);
}

export function getAiChatHistory(scenario: AIHistoryScenario) {
  migrateLegacyAiChats();
  return readJSON<AiChatRecord[]>(getHistoryKey(scenario), []);
}

export function pushAiChatHistory(scenario: AIHistoryScenario, record: AiChatRecord) {
  const list = getAiChatHistory(scenario);
  writeJSON(getHistoryKey(scenario), [record, ...list].slice(0, 200));
}

export function getAiChats() {
  migrateLegacyAiChats();
  return [
    ...getAiChatHistory("home"),
    ...getAiChatHistory("meal"),
    ...getAiChatHistory("exercise"),
    ...getAiChatHistory("emotion"),
    ...getAiChatHistory("family")
  ].sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
}

export function addAiChat(record: AiChatRecord) {
  pushAiChatHistory(normalizeScenarioFromMode(record.mode), record);
}

export function getChatSessions() {
  return readJSON<ChatSession[]>(KEYS.chatSessions, []);
}

export function setChatSessions(sessions: ChatSession[]) {
  writeJSON(KEYS.chatSessions, sessions);
}

export function getAppSettings(): AppSettings {
  return readJSON<AppSettings>(KEYS.appSettings, { hasSeenDisclaimer: false });
}

export function setAppSettings(settings: AppSettings) {
  writeJSON(KEYS.appSettings, settings);
}

export function getMotivationHistory() {
  return readJSON<string[]>(KEYS.homeMotivationHistory, []);
}

export function pushMotivationHistory(text: string, limit = 7) {
  const current = getMotivationHistory().filter((item) => item !== text);
  writeJSON(KEYS.homeMotivationHistory, [text, ...current].slice(0, limit));
}

export function getLastCompletedMealKey() {
  return readJSON<string>(KEYS.lastCompletedMealKey, "");
}

function clampPositive(value: number, fallback: number) {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.round(value);
}

export function getCheckinPreferences(): CheckinPreferences {
  const raw = readJSON<Partial<CheckinPreferences>>(KEYS.checkinPreferences, {});
  const defaults = defaultCheckinPreferences();
  return {
    exerciseGoalMinutes: clampPositive(Number(raw.exerciseGoalMinutes), defaults.exerciseGoalMinutes),
    waterGoalMl: clampPositive(Number(raw.waterGoalMl), defaults.waterGoalMl)
  };
}

export function setCheckinPreferences(patch: Partial<CheckinPreferences>) {
  const current = getCheckinPreferences();
  const next: CheckinPreferences = {
    exerciseGoalMinutes: clampPositive(
      Number(patch.exerciseGoalMinutes ?? current.exerciseGoalMinutes),
      current.exerciseGoalMinutes
    ),
    waterGoalMl: clampPositive(Number(patch.waterGoalMl ?? current.waterGoalMl), current.waterGoalMl)
  };
  writeJSON(KEYS.checkinPreferences, next);
  return next;
}

export function getPendingPublishDraft() {
  return readJSON<PublishDraft | null>(KEYS.pendingPublishDraft, null);
}

export function setPendingPublishDraft(draft: PublishDraft) {
  writeJSON(KEYS.pendingPublishDraft, draft);
}

export function clearPendingPublishDraft() {
  removeKey(KEYS.pendingPublishDraft);
}

// compatibility exports
export const getTodayMealPlan = () => getDailyMealPlan(getTodayDate());
export const setTodayMealPlan = (plan: MealPlan) => setDailyMealPlan(plan);
export const getCheckins = () => getAllCheckins();
export const getTodayCheckin = () => getDailyCheckin(getTodayDate());
export const saveCheckin = (entry: DailyCheckin) => setDailyCheckin(entry);

export function clearAllAppData() {
  if (!isBrowser()) return;
  Object.values(KEYS).forEach(removeKey);
  Object.values(LEGACY_KEYS).forEach(removeKey);
}

export function defaultDisclaimer() {
  return DISCLAIMER;
}
