import { NextResponse } from "next/server";
import { askAIJson, isAIConfigured } from "@/src/lib/aiClient";
import { DISCLAIMER } from "@/src/lib/constants";
import { buildFallbackMealPlan } from "@/src/lib/mockData";
import { buildRuleSummary } from "@/src/lib/recoveryRules";
import type {
  MealCountConfig,
  MealDish,
  MealPlan,
  MealSimplifyGoal,
  MealStylePreference,
  Profile,
  TodayState
} from "@/src/lib/types";

interface GenerateMealPlanBody {
  mode?: "full" | "replace";
  profile?: Profile;
  todayState?: TodayState;
  availableIngredients?: string[];
  replace?: {
    dishId?: string;
    mealType?: MealDish["mealType"];
    slotLabel?: string;
    slotType?: "soup" | "staple" | "main";
    blacklistNames?: string[];
    blacklistCombos?: string[];
  };
}

interface GenerationContext {
  baseConditions: string[];
  allergens: string[];
  avoidFoods: string[];
  stylePreference: MealStylePreference;
  mealTemplate: string;
  mealCounts: MealCountConfig;
  dietStage: string;
  symptom: string;
  appetite: string;
  simplifyGoal: MealSimplifyGoal;
  availableIngredients: string[];
}

type ValidationResult = { valid: true } | { valid: false; reason: string };

const MAX_INGREDIENT_HINTS = 20;
const MAX_INGREDIENTS_PER_DISH = 8;
const MEAL_ORDER: MealDish["mealType"][] = ["早餐", "午餐", "晚餐", "加餐"];
const DEFAULT_COUNTS: MealCountConfig = { breakfast: 1, lunch: 3, dinner: 3, snack: 1 };
const STYLE_OPTIONS: MealStylePreference[] = ["中式", "西式", "家常", "清淡", "轻食"];
const SIMPLIFY_OPTIONS: MealSimplifyGoal[] = ["easy", "balanced", "gentle"];

const DARK_COMBO_PATTERNS = [
  "草莓炒蛋",
  "香蕉炒",
  "榴莲炒",
  "奥利奥拌饭",
  "可乐炖",
  "辣条",
  "奶茶煮",
  "月饼炒",
  "臭豆腐冰淇淋"
];

const OILY_OR_IRRITATING_WORDS = ["油炸", "爆炒", "麻辣", "火锅", "烧烤", "腌制", "重口", "生冷"];
const SOFT_DISH_KEYWORDS = ["粥", "羹", "糊", "汤", "泥", "蒸蛋", "软面", "豆腐脑", "米糊", "半流"];
const PROTEIN_INGREDIENT_KEYWORDS = ["鸡蛋", "鸡", "牛", "鱼", "虾", "豆腐", "豆浆", "奶", "蛋白"];
const FIBER_INGREDIENT_KEYWORDS = ["芹菜", "白菜", "香菇", "西兰花", "菠菜", "燕麦", "红薯", "南瓜"];
const INTERNET_SLANG_PATTERNS = ["YYDS", "yyds", "绝绝子", "网红", "爆款", "段子", "梗", "胡闹", "离谱"];
const STAPLE_KEYWORDS = ["米", "饭", "面", "粥", "粉", "馒头", "燕麦", "土豆", "红薯", "玉米"];
const VEG_KEYWORDS = ["菜", "白菜", "青菜", "番茄", "西红柿", "胡萝卜", "西兰花", "冬瓜", "南瓜", "菠菜", "香菇", "黄瓜"];
const DISH_PREFIX_PATTERNS = [/^可(?:改|替|变)?为[:：]?\s*/i, /^建议(?:改成|替换为)?[:：]?\s*/i, /^换成[:：]?\s*/i];

function uniqueList(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.map((item) => (item || "").trim()).filter(Boolean)));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeMealCounts(input?: TodayState["customMealCounts"]): MealCountConfig {
  return {
    breakfast: clamp(Number(input?.breakfast) || DEFAULT_COUNTS.breakfast, 1, 4),
    lunch: clamp(Number(input?.lunch) || DEFAULT_COUNTS.lunch, 1, 5),
    dinner: clamp(Number(input?.dinner) || DEFAULT_COUNTS.dinner, 1, 5),
    snack: clamp(Number(input?.snack) || DEFAULT_COUNTS.snack, 1, 3)
  };
}

function normalizeIngredients(items: string[]) {
  return uniqueList(items).slice(0, MAX_INGREDIENT_HINTS);
}

function sanitizeDishName(name: string) {
  let next = (name || "").trim();
  DISH_PREFIX_PATTERNS.forEach((pattern) => {
    next = next.replace(pattern, "");
  });
  next = next.replace(/^(可选|也可|或可|可以)(改成|替换成)?/g, "").trim();
  // Remove noisy bracketed ingredient suffixes that read like "黑暗料理"
  next = next.replace(/[（(][^）)]{1,10}[）)]/g, "").trim();
  const splitter = next.search(/[，,。；;].*(可改|可替|换成|也可|或)/);
  if (splitter > 0) next = next.slice(0, splitter).trim();
  next = next.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();
  return next || "温和家常菜";
}

function normalizeIngredientToken(raw: string) {
  return raw
    .toLowerCase()
    .replace(/[0-9]+(?:\.[0-9]+)?\s*(g|kg|ml|克|毫升|份|个|只|片|勺|块)/gi, "")
    .replace(/[()（）【】\[\]·]/g, "")
    .replace(/(少量|适量|少许|温水|清水|热水|饮用水)/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function isSoup(name: string) {
  return /(汤|羹|粥|煲|盅)/.test(name);
}

function isStaple(name: string) {
  return /(饭|面|粥|粉|馒头|主食|饼|燕麦|小米)/.test(name);
}

function slotMatchesType(name: string, slotType: "soup" | "staple" | "main") {
  if (slotType === "soup") return isSoup(name);
  if (slotType === "staple") return isStaple(name);
  return !isSoup(name);
}

function expectedCountByMealType(mealCounts: MealCountConfig) {
  return {
    早餐: mealCounts.breakfast,
    午餐: mealCounts.lunch,
    晚餐: mealCounts.dinner,
    加餐: mealCounts.snack
  } as Record<MealDish["mealType"], number>;
}

function textIncludesAny(text: string, words: string[]) {
  const lower = text.toLowerCase();
  return words.some((word) => lower.includes(word.toLowerCase()));
}

function isRealDishName(name: string) {
  if (!name || name.length < 2 || name.length > 14) return false;
  if (/[`~!@#$%^&*_=+\\/<>\[\]{}]/.test(name)) return false;
  if (/[()（）]/.test(name)) return false;
  if (INTERNET_SLANG_PATTERNS.some((word) => name.toLowerCase().includes(word.toLowerCase()))) return false;
  if (/可改|建议|换成|任选|或者/.test(name)) return false;
  if (!/(粥|羹|汤|蒸|煮|炖|炒|拌|面|饭|泥|盅|煲|卷|饼|豆腐|鸡|鱼|牛|虾|菜|蛋)/.test(name)) return false;
  return true;
}

function buildCoreComboKey(dish: Pick<MealDish, "dishName" | "ingredients">) {
  const normalizedIngredients = uniqueList((dish.ingredients || []).map((item) => normalizeIngredientToken(item)))
    .slice(0, 4)
    .sort();
  if (normalizedIngredients.length === 0) return sanitizeDishName(dish.dishName).toLowerCase();
  return normalizedIngredients.join("|");
}

function buildAllowedIngredientSet(context: GenerationContext) {
  return new Set(normalizeIngredients(context.availableIngredients).map((item) => normalizeIngredientToken(item)).filter(Boolean));
}

function ingredientAllowed(ingredient: string, allowedSet: Set<string>) {
  if (allowedSet.size === 0) return false;
  const token = normalizeIngredientToken(ingredient);
  if (!token) return false;
  for (const allowed of allowedSet) {
    if (!allowed) continue;
    if (token === allowed || token.includes(allowed) || allowed.includes(token)) {
      return true;
    }
  }
  return false;
}

function slotLabelFor(mealType: MealDish["mealType"], index: number) {
  const labels: Record<MealDish["mealType"], string[]> = {
    早餐: ["菜位 1（主食建议）", "菜位 2（配菜）", "菜位 3（汤）", "菜位 4（配菜）"],
    午餐: ["菜位 1（主菜）", "菜位 2（配菜）", "菜位 3（汤）", "菜位 4（主食建议）", "菜位 5（配菜）"],
    晚餐: ["菜位 1（主菜）", "菜位 2（配菜）", "菜位 3（汤）", "菜位 4（主食建议）", "菜位 5（配菜）"],
    加餐: ["菜位 1（主食建议）", "菜位 2（配菜）", "菜位 3（汤）"]
  };
  return labels[mealType][index] || `菜位 ${index + 1}`;
}

function hasIngredientHint(dish: MealDish, ingredient: string) {
  return dish.dishName.includes(ingredient) || (dish.ingredients || []).some((item) => item.includes(ingredient));
}

function sanitizeMealDish(raw: Partial<MealDish>, mealType: MealDish["mealType"], index: number): MealDish {
  return {
    id: raw.id || `${mealType}-${index}-${Date.now()}`,
    mealType,
    slotLabel: raw.slotLabel || slotLabelFor(mealType, Math.max(0, index - 1)),
    dishName: sanitizeDishName(raw.dishName || `${mealType}建议`),
    ingredients: Array.isArray(raw.ingredients) ? uniqueList(raw.ingredients).slice(0, MAX_INGREDIENTS_PER_DISH) : [],
    steps: Array.isArray(raw.steps) ? raw.steps : ["采用蒸煮炖等温和方式烹饪"],
    tags: Array.isArray(raw.tags) ? raw.tags : ["温和"],
    estimatedMinutes: Number(raw.estimatedMinutes) || 20,
    safetyLabel: raw.safetyLabel || "需结合个人耐受",
    cautionNote: raw.cautionNote || "若出现明显不适请暂停并咨询医生。",
    alternatives: Array.isArray(raw.alternatives) ? raw.alternatives.map((item) => sanitizeDishName(String(item))).filter(Boolean) : ["清粥", "蒸蛋"],
    whyThisMeal: raw.whyThisMeal || "基于当前状态给出的温和饮食建议。",
    nutrition: raw.nutrition || { caloriesKcal: 320, proteinG: 18, carbsG: 30, fatG: 9 },
    imageUrl: raw.imageUrl || "/meal-placeholder.svg",
    adopted: Boolean(raw.adopted),
    completed: Boolean(raw.completed)
  };
}

function enforceIngredientCoverage(meals: MealDish[], availableIngredients: string[]) {
  const normalizedIngredients = normalizeIngredients(availableIngredients);
  if (normalizedIngredients.length === 0 || meals.length === 0) return meals;

  const nextMeals = meals.map((dish) => ({
    ...dish,
    ingredients: Array.isArray(dish.ingredients) ? [...dish.ingredients] : []
  }));

  normalizedIngredients.forEach((ingredient, index) => {
    const covered = nextMeals.some((dish) => hasIngredientHint(dish, ingredient));
    if (covered) return;
    const target = nextMeals[index % nextMeals.length];
    target.ingredients = Array.from(new Set([...(target.ingredients || []), ingredient])).slice(0, MAX_INGREDIENTS_PER_DISH);
  });

  return nextMeals;
}

function normalizeMealPlan(raw: unknown, fallback: MealPlan, availableIngredients: string[] = []): MealPlan {
  if (!raw || typeof raw !== "object") return fallback;

  const data = raw as {
    mealPlan?: Partial<MealPlan>;
    plan?: Partial<MealPlan>;
    meal_plan?: Partial<MealPlan>;
    data?: Partial<MealPlan>;
  };
  const plan = data.mealPlan || data.plan || data.meal_plan || data.data;
  if (!plan || !Array.isArray(plan.meals)) return fallback;

  const normalizedMeals: MealDish[] = plan.meals
    .map((item, index) => {
      const mealType = MEAL_ORDER.includes(item.mealType) ? item.mealType : MEAL_ORDER[Math.min(MEAL_ORDER.length - 1, index % MEAL_ORDER.length)];
      return sanitizeMealDish(item, mealType, index + 1);
    })
    .sort((a, b) => MEAL_ORDER.indexOf(a.mealType) - MEAL_ORDER.indexOf(b.mealType));

  if (normalizedMeals.length === 0) return fallback;
  const adjustedMeals = enforceIngredientCoverage(normalizedMeals, availableIngredients);

  return {
    date: fallback.date,
    disclaimer: DISCLAIMER,
    basisSummary: plan.basisSummary || fallback.basisSummary,
    contextSummary: plan.contextSummary || fallback.contextSummary,
    meals: adjustedMeals
  };
}

function validateDishAgainstContext(
  dish: MealDish,
  context: GenerationContext,
  options?: {
    mealType?: MealDish["mealType"];
    slotType?: "soup" | "staple" | "main";
    blacklistNames?: Set<string>;
    blacklistCombos?: Set<string>;
  }
) {
  if (options?.mealType && dish.mealType !== options.mealType) {
    return `菜品餐次不匹配：${dish.dishName}`;
  }

  const name = sanitizeDishName(dish.dishName);
  if (!isRealDishName(name)) return `菜名不符合家常菜规则：${dish.dishName}`;

  if (options?.slotType && !slotMatchesType(name, options.slotType)) {
    return `换一道菜位类型不匹配：${dish.dishName}`;
  }

  const normalizedName = name.toLowerCase();
  if (options?.blacklistNames?.has(normalizedName)) {
    return `命中换菜黑名单：${dish.dishName}`;
  }

  const comboKey = buildCoreComboKey(dish);
  if (options?.blacklistCombos?.has(comboKey)) {
    return `命中换菜食材组合黑名单：${dish.dishName}`;
  }

  const text = `${name} ${(dish.ingredients || []).join(" ")} ${(dish.steps || []).join(" ")}`.toLowerCase();
  if (textIncludesAny(text, DARK_COMBO_PATTERNS)) return `命中黑暗料理风险：${dish.dishName}`;

  const blockedWords = uniqueList([...context.avoidFoods, ...context.allergens]);
  if (blockedWords.some((word) => word && text.includes(word.toLowerCase()))) {
    return `命中忌口/过敏：${dish.dishName}`;
  }

  if ((context.dietStage === "少油" || context.dietStage === "少盐") && textIncludesAny(text, ["油炸", "红烧", "爆炒"])) {
    return `不符合少油少盐要求：${dish.dishName}`;
  }

  if ((context.dietStage === "流食" || context.dietStage === "软食") && !SOFT_DISH_KEYWORDS.some((word) => text.includes(word))) {
    return `不符合流食/软食要求：${dish.dishName}`;
  }

  if ((context.symptom === "吞咽不适" || context.symptom === "恶心" || context.symptom === "食欲差") && textIncludesAny(text, OILY_OR_IRRITATING_WORDS)) {
    return `不符合当前症状优化：${dish.dishName}`;
  }

  const allowedSet = buildAllowedIngredientSet(context);
  const ingredients = uniqueList(dish.ingredients || []);
  if (allowedSet.size === 0) return "可用食材为空";
  if (ingredients.length === 0) return `菜品缺少食材明细：${dish.dishName}`;
  const invalidIngredient = ingredients.find((item) => !ingredientAllowed(item, allowedSet));
  if (invalidIngredient) {
    return `使用了非可用食材：${invalidIngredient}`;
  }

  if (!dish.nutrition) return `缺少营养信息：${dish.dishName}`;
  const nutrition = [dish.nutrition.caloriesKcal, dish.nutrition.proteinG, dish.nutrition.carbsG, dish.nutrition.fatG].map((item) => Number(item));
  if (nutrition.some((item) => !Number.isFinite(item) || item < 0)) return `营养信息格式错误：${dish.dishName}`;

  return "";
}

function validateMealPlan(plan: MealPlan, context: GenerationContext): ValidationResult {
  if (!Array.isArray(plan.meals) || plan.meals.length === 0) {
    return { valid: false, reason: "菜单为空" };
  }

  const expected = expectedCountByMealType(context.mealCounts);
  const actual = { 早餐: 0, 午餐: 0, 晚餐: 0, 加餐: 0 } as Record<MealDish["mealType"], number>;
  const globalNames = new Set<string>();
  const globalCombos = new Set<string>();
  const mealNameMap: Record<MealDish["mealType"], Set<string>> = {
    早餐: new Set(),
    午餐: new Set(),
    晚餐: new Set(),
    加餐: new Set()
  };

  for (const dish of plan.meals) {
    actual[dish.mealType] += 1;

    const reason = validateDishAgainstContext(dish, context);
    if (reason) return { valid: false, reason };

    const normalizedName = sanitizeDishName(dish.dishName).toLowerCase();
    const comboKey = buildCoreComboKey(dish);

    if (mealNameMap[dish.mealType].has(normalizedName)) {
      return { valid: false, reason: `同餐次菜名重复：${dish.dishName}` };
    }
    mealNameMap[dish.mealType].add(normalizedName);

    if (globalNames.has(normalizedName)) {
      return { valid: false, reason: `全日菜名重复：${dish.dishName}` };
    }
    globalNames.add(normalizedName);

    if (globalCombos.has(comboKey)) {
      return { valid: false, reason: `全日核心食材组合重复：${dish.dishName}` };
    }
    globalCombos.add(comboKey);
  }

  for (const mealType of MEAL_ORDER) {
    if (actual[mealType] !== expected[mealType]) {
      return { valid: false, reason: `${mealType}份数不匹配，期望${expected[mealType]}，实际${actual[mealType]}` };
    }
  }

  if (context.dietStage === "高蛋白") {
    const proteinCount = plan.meals.filter((dish) => textIncludesAny(`${dish.dishName} ${(dish.ingredients || []).join(" ")}`, PROTEIN_INGREDIENT_KEYWORDS)).length;
    if (proteinCount < Math.max(2, Math.ceil(plan.meals.length * 0.45))) {
      return { valid: false, reason: "高蛋白阶段下优质蛋白菜品不足" };
    }
  }

  if (context.symptom === "便秘") {
    const allText = plan.meals.map((dish) => `${dish.dishName} ${(dish.ingredients || []).join(" ")}`).join(" ");
    if (!textIncludesAny(allText, FIBER_INGREDIENT_KEYWORDS)) {
      return { valid: false, reason: "便秘场景下高纤维食材覆盖不足" };
    }
  }

  if (context.symptom === "吞咽不适") {
    const allSoft = plan.meals.every((dish) => SOFT_DISH_KEYWORDS.some((word) => `${dish.dishName} ${(dish.steps || []).join(" ")}`.includes(word)));
    if (!allSoft) return { valid: false, reason: "吞咽不适场景存在非软食菜品" };
  }

  for (const mealType of ["早餐", "午餐", "晚餐"] as MealDish["mealType"][]) {
    const mealText = plan.meals
      .filter((dish) => dish.mealType === mealType)
      .map((dish) => `${dish.dishName} ${(dish.ingredients || []).join(" ")}`)
      .join(" ");
    const stapleAvailable = context.availableIngredients.some((item) => textIncludesAny(item, STAPLE_KEYWORDS));
    const proteinAvailable = context.availableIngredients.some((item) => textIncludesAny(item, PROTEIN_INGREDIENT_KEYWORDS));
    const vegAvailable = context.availableIngredients.some((item) => textIncludesAny(item, VEG_KEYWORDS));

    if (stapleAvailable && !textIncludesAny(mealText, STAPLE_KEYWORDS)) return { valid: false, reason: `${mealType}缺少主食结构` };
    if (proteinAvailable && !textIncludesAny(mealText, PROTEIN_INGREDIENT_KEYWORDS)) return { valid: false, reason: `${mealType}缺少优质蛋白` };
    if (vegAvailable && !textIncludesAny(mealText, VEG_KEYWORDS)) return { valid: false, reason: `${mealType}缺少蔬菜结构` };
  }

  return { valid: true };
}

function buildGenerationContext(profile: Profile | undefined, todayState: TodayState | undefined, availableIngredients: string[]): GenerationContext {
  const avoidFoods = uniqueList([
    ...(profile?.longTermAvoidFoods || profile?.avoidFoods || []),
    ...(todayState?.avoidFoods || []),
    ...(todayState?.customAvoidFoods || [])
  ]);
  const baseConditions = uniqueList([
    profile?.surgeryDisplayName || profile?.surgeryFinal,
    profile?.surgeryCategory,
    profile?.surgeryName,
    profile?.chronicDiseaseGroup && profile.chronicDiseaseGroup !== "无" ? profile.chronicDiseaseGroup : undefined,
    ...(profile?.chronicConditions || [])
  ]);

  const stylePreference = STYLE_OPTIONS.includes(todayState?.stylePreference as MealStylePreference)
    ? (todayState?.stylePreference as MealStylePreference)
    : "家常";
  const simplifyGoal = SIMPLIFY_OPTIONS.includes(todayState?.simplifyGoal as MealSimplifyGoal)
    ? (todayState?.simplifyGoal as MealSimplifyGoal)
    : "balanced";

  return {
    baseConditions,
    allergens: uniqueList(profile?.allergens || []),
    avoidFoods,
    stylePreference,
    mealTemplate: todayState?.mealTemplate || "均衡版",
    mealCounts: normalizeMealCounts(todayState?.customMealCounts),
    dietStage: todayState?.dietStage || "清淡",
    symptom: todayState?.symptom || "无",
    appetite: todayState?.appetite || "一般",
    simplifyGoal,
    availableIngredients
  };
}

async function requestMealPlanFromAI(
  systemPrompt: string,
  userPrompt: string,
  options: { timeoutMs: number; maxAttempts: number; model?: string }
) {
  return askAIJson<{ mealPlan: Partial<MealPlan> }>(systemPrompt, userPrompt, {
    temperature: 0.15,
    timeoutMs: options.timeoutMs,
    maxAttempts: options.maxAttempts,
    model: options.model
  });
}

async function requestReplaceDishFromAI(
  systemPrompt: string,
  userPrompt: string,
  options: { timeoutMs: number; maxAttempts: number; model?: string }
) {
  return askAIJson<{ dish: Partial<MealDish> }>(systemPrompt, userPrompt, {
    temperature: 0.12,
    timeoutMs: options.timeoutMs,
    maxAttempts: options.maxAttempts,
    model: options.model
  });
}

function buildRequestOptions() {
  const timeoutEnv = Number((process.env.MEAL_AI_TIMEOUT_MS || "").trim());
  const timeoutMs = Number.isFinite(timeoutEnv) && timeoutEnv > 0 ? Math.floor(timeoutEnv) : 30000;
  const attemptEnv = Number((process.env.MEAL_AI_MAX_ATTEMPTS || "").trim());
  const maxAttempts = Number.isFinite(attemptEnv) && attemptEnv >= 1 ? Math.min(Math.floor(attemptEnv), 3) : 1;
  const model =
    (process.env.AI_MODEL_MEAL_TEXT || "").trim() ||
    (process.env.AI_MODEL_FAST_TEXT || "").trim() ||
    (process.env.AI_MODEL_TEXT || "").trim() ||
    undefined;
  return { timeoutMs, maxAttempts, model };
}

function buildMealPlanPrompt(profile: Profile | undefined, context: GenerationContext, rulePrompt: string, failureReasons: string[]) {
  const counts = context.mealCounts;
  return [
    "【患者基础信息】",
    `- 基础背景：${context.baseConditions.join("、") || "日常调养"}`,
    `- 饮食阶段：${context.dietStage}`,
    `- 当前症状：${context.symptom || "无"}`,
    `- 胃口：${context.appetite}`,
    `- 饮食禁忌：${context.avoidFoods.join("、") || "无"}`,
    `- 可用食材：${context.availableIngredients.join("、") || "无"}`,
    `- 套餐偏好：${context.mealTemplate}`,
    `- 自定义餐次：早餐${counts.breakfast}、午餐${counts.lunch}、晚餐${counts.dinner}、加餐${counts.snack}`,
    `- 菜系偏好：${context.stylePreference}`,
    `- 过敏：${context.allergens.join("、") || "无"}`,
    `- 慢病：${uniqueList([profile?.chronicDiseaseGroup, ...(profile?.chronicConditions || [])]).join("、") || "无"}`,
    "",
    "【核心任务】",
    "你是一位专业临床营养师，请生成科学、安全、个性化全日餐单。",
    "",
    "【严格规则】",
    "1. 餐次结构必须严格匹配餐次数量。",
    "2. 同一餐次内菜品不能重复；全日菜名与核心食材组合不能重复。",
    "3. 所有菜品仅使用可用食材，严禁命中禁忌或过敏。",
    "4. 若为少油/少盐，只能蒸、煮、炖、清炒、凉拌，禁油炸和红烧。",
    "5. 若为流食/软食，菜品须为糊、羹、汤、粥或软烂半流食。",
    "6. 若为高蛋白，优先鸡蛋、牛肉、豆腐、鱼虾等优质蛋白。",
    "7. 便秘优先高纤维；恶心/食欲差优先清淡易消化；吞咽不适优先流食半流食。",
    "8. 菜名必须是现实存在的家常菜，严禁网络流行语、段子或不存在菜名。",
    "9. 每道菜必须包含预计耗时和营养字段(caloriesKcal/proteinG/carbsG/fatG)。",
    "",
    "【输出格式(JSON，禁止Markdown)】",
    "{",
    '  "mealPlan": {',
    '    "basisSummary": "string",',
    '    "contextSummary": "string",',
    '    "meals": [',
    '      {"mealType":"早餐|午餐|晚餐|加餐","slotLabel":"string","dishName":"string","ingredients":["string"],"steps":["string"],"tags":["string"],"estimatedMinutes":20,"safetyLabel":"string","cautionNote":"string","alternatives":["string"],"whyThisMeal":"string","nutrition":{"caloriesKcal":0,"proteinG":0,"carbsG":0,"fatG":0},"imageUrl":"/meal-placeholder.svg"}',
    "    ]",
    "  }",
    "}",
    "",
    `【术后/病程规则补充】${rulePrompt}`,
    failureReasons.length > 0 ? `【上次失败原因】${failureReasons.join("；")}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

function buildReplacePrompt(
  context: GenerationContext,
  replace: Required<NonNullable<GenerateMealPlanBody["replace"]>>,
  rulePrompt: string,
  failureReasons: string[]
) {
  return [
    "【换一道任务】",
    `- 目标餐次：${replace.mealType}`,
    `- 菜位：${replace.slotLabel || "同菜位"}`,
    `- 菜位类型：${replace.slotType}`,
    `- 全日黑名单菜名：${(replace.blacklistNames || []).join("、") || "无"}`,
    `- 全日黑名单组合：${(replace.blacklistCombos || []).join("、") || "无"}`,
    `- 饮食阶段：${context.dietStage}`,
    `- 当前症状：${context.symptom || "无"}`,
    `- 胃口：${context.appetite}`,
    `- 忌口：${context.avoidFoods.join("、") || "无"}`,
    `- 可用食材：${context.availableIngredients.join("、") || "无"}`,
    "",
    "【规则】",
    "1. 只输出一道新菜，且与黑名单不重复；",
    "2. 必须保持同菜位类型；",
    "3. 菜名必须是纯家常菜名，不要“可改为/建议/换成”等前缀；",
    "4. 仅可使用可用食材，严禁忌口和过敏；",
    "5. 输出完整营养字段。",
    "",
    "【输出格式(JSON，禁止Markdown)】",
    "{",
    '  "dish": {"mealType":"早餐|午餐|晚餐|加餐","slotLabel":"string","dishName":"string","ingredients":["string"],"steps":["string"],"tags":["string"],"estimatedMinutes":20,"safetyLabel":"string","cautionNote":"string","alternatives":["string"],"whyThisMeal":"string","nutrition":{"caloriesKcal":0,"proteinG":0,"carbsG":0,"fatG":0},"imageUrl":"/meal-placeholder.svg"}',
    "}",
    "",
    `【术后/病程规则补充】${rulePrompt}`,
    failureReasons.length > 0 ? `【上次失败原因】${failureReasons.join("；")}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSafeDish(
  mealType: MealDish["mealType"],
  index: number,
  context: GenerationContext,
  usedNames: Set<string>,
  usedCombos: Set<string>,
  forcedSlotType?: "soup" | "staple" | "main"
) {
  const pool = context.availableIngredients.length > 0 ? context.availableIngredients : ["南瓜", "鸡蛋", "豆腐", "白菜"];
  const softMode = context.dietStage === "流食" || context.dietStage === "软食" || context.symptom === "吞咽不适";

  for (let seed = 0; seed < 24; seed += 1) {
    const a = pool[(index + seed) % pool.length];
    const b = pool[(index + seed + 1) % pool.length];
    const combo = uniqueList([a, b]).slice(0, 2);

    const candidates =
      mealType === "早餐"
        ? [softMode ? `${combo.join("")}羹` : `${combo.join("")}粥`, `${combo[0]}蒸蛋羹`]
        : mealType === "加餐"
          ? [softMode ? `${combo[0]}泥` : `${combo[0]}羹`, `${combo.join("")}羹`]
          : softMode
            ? [`${combo.join("")}汤`, `${combo[0]}豆腐羹`]
            : [`清炖${combo[0]}`, `${combo.join("")}汤`];

    for (const dishNameRaw of candidates) {
      const dishName = sanitizeDishName(dishNameRaw);
      if (forcedSlotType && !slotMatchesType(dishName, forcedSlotType)) continue;
      if (!isRealDishName(dishName)) continue;
      const nameKey = dishName.toLowerCase();
      const comboKey = combo.map((item) => normalizeIngredientToken(item)).sort().join("|");
      if (usedNames.has(nameKey) || usedCombos.has(comboKey)) continue;

      usedNames.add(nameKey);
      usedCombos.add(comboKey);
      return sanitizeMealDish(
        {
          mealType,
          slotLabel: slotLabelFor(mealType, index),
          dishName,
          ingredients: combo,
          steps: ["食材处理为软烂状态", "优先蒸煮炖，温热食用"],
          tags: ["温和", context.stylePreference],
          estimatedMinutes: 20,
          safetyLabel: "温和家常",
          cautionNote: "若有不适请暂停并咨询医生。",
          alternatives: ["清粥", "蒸蛋羹"],
          whyThisMeal: "在可用食材与当前限制下提供稳妥可执行方案。",
          nutrition: { caloriesKcal: 220, proteinG: 12, carbsG: 24, fatG: 7 }
        },
        mealType,
        index + 1
      );
    }
  }

  const fallbackName =
    forcedSlotType === "soup"
      ? `${pool[0]}汤`
      : forcedSlotType === "staple"
        ? `${pool[0]}粥`
        : mealType === "加餐"
          ? "温和加餐羹"
          : `${mealType}温和汤`;

  return sanitizeMealDish(
    {
      mealType,
      slotLabel: slotLabelFor(mealType, index),
      dishName: fallbackName,
      ingredients: pool.slice(0, 2),
      steps: ["食材煮软后温热食用"],
      tags: ["温和"],
      estimatedMinutes: 18,
      safetyLabel: "温和家常",
      cautionNote: "若有不适请暂停并咨询医生。",
      alternatives: ["清粥"],
      whyThisMeal: "在严格约束下提供保底可执行方案。",
      nutrition: { caloriesKcal: 200, proteinG: 10, carbsG: 22, fatG: 6 }
    },
    mealType,
    index + 1
  );
}

function alignMealPlanWithCounts(plan: MealPlan, context: GenerationContext, seedNames = new Set<string>(), seedCombos = new Set<string>()) {
  const expected = expectedCountByMealType(context.mealCounts);
  const usedNames = new Set(seedNames);
  const usedCombos = new Set(seedCombos);
  const meals: MealDish[] = [];

  for (const mealType of MEAL_ORDER) {
    const source = plan.meals.filter((dish) => dish.mealType === mealType);
    const picked: MealDish[] = [];
    for (const candidate of source) {
      if (picked.length >= expected[mealType]) break;
      const normalized = sanitizeMealDish(candidate, mealType, picked.length + 1);
      normalized.slotLabel = slotLabelFor(mealType, picked.length);
      const baseRuleReason = validateDishAgainstContext(normalized, context);
      if (baseRuleReason) continue;
      const nameKey = sanitizeDishName(normalized.dishName).toLowerCase();
      const comboKey = buildCoreComboKey(normalized);
      if (usedNames.has(nameKey) || usedCombos.has(comboKey)) continue;
      usedNames.add(nameKey);
      usedCombos.add(comboKey);
      picked.push(normalized);
    }
    while (picked.length < expected[mealType]) {
      picked.push(buildSafeDish(mealType, picked.length, context, usedNames, usedCombos));
    }
    meals.push(...picked);
  }

  return { ...plan, meals };
}

function normalizeSingleDish(raw: unknown, fallback: MealDish, mealType: MealDish["mealType"]) {
  if (!raw || typeof raw !== "object") return fallback;
  const obj = raw as { dish?: Partial<MealDish>; meal?: Partial<MealDish>; mealPlan?: Partial<MealPlan> };
  const candidate =
    obj.dish ||
    obj.meal ||
    (Array.isArray(obj.mealPlan?.meals) ? obj.mealPlan?.meals?.[0] : undefined) ||
    undefined;
  if (!candidate) return fallback;
  return sanitizeMealDish({ ...candidate, mealType }, mealType, 1);
}

async function handleFullGeneration(body: GenerateMealPlanBody) {
  const profile = body.profile;
  const todayState = body.todayState || {};
  const availableIngredients = normalizeIngredients(body.availableIngredients || todayState.availableIngredients || []);
  if (availableIngredients.length === 0) {
    return NextResponse.json({ ok: false, source: "error", error: "请先添加可用食材后再生成餐单" }, { status: 400 });
  }
  const context = buildGenerationContext(profile, todayState, availableIngredients);
  const summary = buildRuleSummary(profile?.surgeryCategory, profile?.surgeryDisplayName || profile?.surgeryFinal, profile?.postOpDay);
  const options = buildRequestOptions();
  const failureReasons: string[] = [];

  const fallbackRaw = buildFallbackMealPlan({
    profile,
    todayState: {
      ...todayState,
      avoidFoods: context.avoidFoods,
      customMealCounts: context.mealCounts,
      stylePreference: context.stylePreference,
      simplifyGoal: context.simplifyGoal
    },
    availableIngredients: context.availableIngredients
  });

  const fallbackPlan = alignMealPlanWithCounts(normalizeMealPlan({ mealPlan: fallbackRaw }, fallbackRaw, availableIngredients), context);
  const useMock = String(process.env.USE_MOCK || "").toLowerCase() === "true";
  if (useMock) {
    return NextResponse.json({ ok: true, source: "mock", mealPlan: fallbackPlan });
  }
  if (!isAIConfigured()) {
    return NextResponse.json({ ok: true, source: "safe-fallback", mealPlan: fallbackPlan });
  }

  const systemPrompt =
    "你是愈后食光的临床营养助手。只输出 JSON，不输出 Markdown。" +
    "\n必须严格遵守用户前置条件和限制，优先可执行、安全、家常的菜品。" +
    "\n若不满足约束，请主动重排结果，禁止输出网络流行语和不存在菜名。";

  for (let round = 0; round < 2; round += 1) {
    const prompt = buildMealPlanPrompt(profile, context, summary.prompt, failureReasons);
    const raw = await requestMealPlanFromAI(systemPrompt, prompt, options);
    const normalized = normalizeMealPlan(raw, fallbackPlan, availableIngredients);
    const aligned = alignMealPlanWithCounts(normalized, context);
    const validation = validateMealPlan(aligned, context);
    if (validation.valid) {
      return NextResponse.json({ ok: true, source: round === 0 ? "ai" : "ai-retry", mealPlan: aligned, failureReasons });
    }
    failureReasons.push(validation.reason || "未知校验失败");
  }

  console.warn("[generate-meal-plan] fallback reasons:", failureReasons);
  return NextResponse.json({
    ok: true,
    source: "safe-fallback",
    mealPlan: fallbackPlan,
    warning: failureReasons[failureReasons.length - 1] || "校验未通过",
    failureReasons
  });
}

async function handleReplaceGeneration(body: GenerateMealPlanBody) {
  const profile = body.profile;
  const todayState = body.todayState || {};
  const availableIngredients = normalizeIngredients(body.availableIngredients || todayState.availableIngredients || []);
  if (availableIngredients.length === 0) {
    return NextResponse.json({ ok: false, source: "error", error: "请先添加可用食材后再换菜" }, { status: 400 });
  }
  const context = buildGenerationContext(profile, todayState, availableIngredients);
  const replace = body.replace;

  if (!replace?.mealType || !MEAL_ORDER.includes(replace.mealType)) {
    return NextResponse.json({ ok: false, source: "error", error: "换菜参数缺少 mealType" }, { status: 400 });
  }

  const replaceInfo: Required<NonNullable<GenerateMealPlanBody["replace"]>> = {
    dishId: replace.dishId || "",
    mealType: replace.mealType,
    slotLabel: replace.slotLabel || "",
    slotType: replace.slotType || "main",
    blacklistNames: (replace.blacklistNames || []).map((item) => sanitizeDishName(item)).filter(Boolean),
    blacklistCombos: (replace.blacklistCombos || []).filter(Boolean)
  };

  const nameBlacklist = new Set(replaceInfo.blacklistNames.map((item) => item.toLowerCase()));
  const comboBlacklist = new Set(replaceInfo.blacklistCombos);
  const usedNames = new Set(nameBlacklist);
  const usedCombos = new Set(comboBlacklist);
  const fallbackDish = buildSafeDish(replaceInfo.mealType, 0, context, usedNames, usedCombos, replaceInfo.slotType);
  fallbackDish.slotLabel = replaceInfo.slotLabel || fallbackDish.slotLabel;

  if (!isAIConfigured()) {
    return NextResponse.json({ ok: true, source: "safe-fallback", dish: fallbackDish, failureReasons: [] });
  }

  const options = buildRequestOptions();
  const summary = buildRuleSummary(profile?.surgeryCategory, profile?.surgeryDisplayName || profile?.surgeryFinal, profile?.postOpDay);
  const failureReasons: string[] = [];
  const systemPrompt =
    "你是愈后食光的换菜助手。只输出一道可执行家常菜 JSON。" +
    "\n必须严格遵守黑名单、可用食材、忌口过敏和同菜位类型约束。";

  for (let round = 0; round < 2; round += 1) {
    const prompt = buildReplacePrompt(context, replaceInfo, summary.prompt, failureReasons);
    const raw = await requestReplaceDishFromAI(systemPrompt, prompt, options);
    const candidate = normalizeSingleDish(raw, fallbackDish, replaceInfo.mealType);
    candidate.slotLabel = replaceInfo.slotLabel || candidate.slotLabel;
    const reason = validateDishAgainstContext(candidate, context, {
      mealType: replaceInfo.mealType,
      slotType: replaceInfo.slotType,
      blacklistNames: nameBlacklist,
      blacklistCombos: comboBlacklist
    });
    if (!reason) {
      return NextResponse.json({ ok: true, source: round === 0 ? "ai-replace" : "ai-replace-retry", dish: candidate, failureReasons });
    }
    failureReasons.push(reason);
  }

  console.warn("[generate-meal-plan] replace fallback reasons:", failureReasons);
  return NextResponse.json({
    ok: true,
    source: "safe-fallback",
    dish: fallbackDish,
    warning: failureReasons[failureReasons.length - 1] || "换菜校验失败",
    failureReasons
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GenerateMealPlanBody;
    if (body.mode === "replace") {
      return await handleReplaceGeneration(body);
    }
    return await handleFullGeneration(body);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    console.error("[generate-meal-plan] failed:", detail);
    return NextResponse.json({ ok: false, source: "error", error: "餐单AI生成失败", detail }, { status: 502 });
  }
}
