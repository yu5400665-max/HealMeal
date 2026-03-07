"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppContainer from "@/components/AppContainer";
import Card from "@/components/Card";
import PageTitle from "@/components/PageTitle";
import { useI18n } from "@/src/lib/i18n";
import {
  INGREDIENT_CATEGORIES,
  addCustomIngredientToCategory,
  getIngredientPreferenceStats,
  parseIngredientText
} from "@/src/lib/ingredientsCatalog";
import { useSpeechToText } from "@/src/hooks/useSpeechToText";
import { AVOID_TAGS, DIET_STAGE_OPTIONS, SYMPTOM_OPTIONS } from "@/src/lib/constants";
import { computePostOpDay } from "@/src/lib/date";
import { toFriendlyError } from "@/src/lib/errorText";
import { buildFallbackMealPlan } from "@/src/lib/mockData";
import {
  getDailyMealPlan,
  getMealSettingsDynamic,
  getProfile,
  setDailyMealPlan,
  setMealSettingsDynamic,
  updateDishStatus
} from "@/src/lib/storage";
import type {
  DietStage,
  MealCountConfig,
  MealDish,
  MealPlan,
  MealSimplifyGoal,
  MealStylePreference,
  MealTemplateMode,
  Profile,
  SymptomType
} from "@/src/lib/types";

type PickerField = "dietStage" | "symptom" | "appetite";
type GenerationStage = "idle" | "preparing" | "requesting" | "parsing" | "rendering" | "done";
type PlatformKey = "douyin" | "xiaohongshu" | "bilibili";

const DEFAULT_COUNTS: MealCountConfig = { breakfast: 1, lunch: 3, dinner: 3, snack: 1 };
const TEMPLATE_OPTIONS: MealTemplateMode[] = ["省心版", "均衡版", "家常版", "自定义"];
const STYLE_OPTIONS: MealStylePreference[] = ["中式", "西式", "家常", "清淡", "轻食"];
const STAGE_CEILING: Record<GenerationStage, number> = {
  idle: 0,
  preparing: 18,
  requesting: 58,
  parsing: 84,
  rendering: 97,
  done: 100
};
const MEAL_ORDER: MealDish["mealType"][] = ["早餐", "午餐", "晚餐", "加餐"];

function parseIngredients(input: string) {
  return parseIngredientText(input);
}

function parseSpeechIngredients(input: string) {
  const normalized = input
    .replace(/[。！!？?]/g, "，")
    .replace(/(?:和|跟|以及|还有|再加|加上|外加|并且)/g, "，")
    .replace(/\s+/g, "，");
  return parseIngredients(normalized)
    .map((item) =>
      item
        .replace(/^(我有|家里有|可用食材(?:有)?|食材(?:有)?|还有|再加|加上|外加|请加入|帮我加)/, "")
        .replace(/(可以吗|谢谢|麻烦了|就这些|就这些了)$/g, "")
        .trim()
    )
    .filter(Boolean);
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeCounts(input?: MealCountConfig): MealCountConfig {
  return {
    breakfast: clamp(Number(input?.breakfast) || DEFAULT_COUNTS.breakfast, 1, 4),
    lunch: clamp(Number(input?.lunch) || DEFAULT_COUNTS.lunch, 1, 5),
    dinner: clamp(Number(input?.dinner) || DEFAULT_COUNTS.dinner, 1, 5),
    snack: clamp(Number(input?.snack) || DEFAULT_COUNTS.snack, 1, 3)
  };
}

function sanitizeDishName(name: string) {
  let next = (name || "").trim();
  next = next.replace(/^可(?:改|替|变)?为[:：]?\s*/i, "");
  next = next.replace(/^建议(?:改成|替换为)?[:：]?\s*/i, "");
  next = next.replace(/^换成[:：]?\s*/i, "");
  // Strip noisy parenthetical ingredient suffixes like "（生菜）（西红柿）"
  next = next.replace(/[（(][^）)]{1,10}[）)]/g, "").trim();
  const splitIndex = next.search(/[，,。；;].*(可改|可替|换成|也可|或)/);
  if (splitIndex > 0) next = next.slice(0, splitIndex).trim();
  next = next.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();
  return next || "温和家常菜";
}

function sanitizeDish(raw: Partial<MealDish>, mealType: MealDish["mealType"], index: number): MealDish {
  return {
    id: raw.id || `${mealType}-${index}-${Date.now()}`,
    mealType,
    slotLabel: raw.slotLabel,
    dishName: sanitizeDishName(raw.dishName || `${mealType}建议`),
    ingredients: Array.isArray(raw.ingredients) ? unique(raw.ingredients).slice(0, 8) : ["请按医生建议选择食材"],
    steps: Array.isArray(raw.steps) ? raw.steps : ["采用蒸煮炖等温和方式烹饪"],
    tags: Array.isArray(raw.tags) ? raw.tags : ["温和"],
    estimatedMinutes: Number(raw.estimatedMinutes) || 20,
    safetyLabel: raw.safetyLabel || "需结合个人耐受",
    cautionNote: raw.cautionNote || "若出现明显不适请暂停并咨询医生。",
    alternatives: Array.isArray(raw.alternatives) ? raw.alternatives.map((item) => sanitizeDishName(String(item))) : ["清粥", "蒸蛋"],
    whyThisMeal: raw.whyThisMeal || "基于当前状态给出的温和饮食建议。",
    nutrition: raw.nutrition || { caloriesKcal: 320, proteinG: 18, carbsG: 30, fatG: 9 },
    imageUrl: raw.imageUrl || "/meal-placeholder.svg",
    adopted: Boolean(raw.adopted),
    completed: Boolean(raw.completed)
  };
}

function normalizePlan(raw: unknown, fallback: MealPlan) {
  if (!raw || typeof raw !== "object") return fallback;
  const obj = raw as any;
  const candidate = obj?.mealPlan ?? obj?.meal_plan ?? obj?.plan ?? obj?.data ?? obj;
  const payload = (candidate?.meals ? candidate : candidate?.mealPlan) ?? candidate;
  if (!payload || !Array.isArray(payload.meals)) return fallback;

  const meals = payload.meals
    .map((item: any, index: number) => {
      const mealType = MEAL_ORDER.includes(item?.mealType) ? item.mealType : MEAL_ORDER[index % MEAL_ORDER.length];
      return sanitizeDish(item, mealType, index + 1);
    })
    .sort((a: MealDish, b: MealDish) => MEAL_ORDER.indexOf(a.mealType) - MEAL_ORDER.indexOf(b.mealType));

  if (meals.length === 0) return fallback;
  return {
    date: fallback.date,
    disclaimer: fallback.disclaimer,
    basisSummary: payload.basisSummary || fallback.basisSummary,
    contextSummary: payload.contextSummary || fallback.contextSummary,
    meals
  } as MealPlan;
}

function templateCounts(template: MealTemplateMode, customCounts: MealCountConfig) {
  if (template === "省心版") return { breakfast: 1, lunch: 2, dinner: 2, snack: 1 };
  if (template === "家常版") return { breakfast: 1, lunch: 3, dinner: 3, snack: 1 };
  if (template === "自定义") return normalizeCounts(customCounts);
  return { breakfast: 1, lunch: 3, dinner: 3, snack: 1 };
}

function slotLabel(mealType: MealDish["mealType"], index: number) {
  const labels: Record<MealDish["mealType"], string[]> = {
    早餐: ["菜位 1（主食建议）", "菜位 2（配菜）", "菜位 3（汤）", "菜位 4（配菜）"],
    午餐: ["菜位 1（主菜）", "菜位 2（配菜）", "菜位 3（汤）", "菜位 4（主食建议）", "菜位 5（配菜）"],
    晚餐: ["菜位 1（主菜）", "菜位 2（配菜）", "菜位 3（汤）", "菜位 4（主食建议）", "菜位 5（配菜）"],
    加餐: ["菜位 1（主食建议）", "菜位 2（配菜）", "菜位 3（汤）"]
  };
  return labels[mealType][index] || `菜位 ${index + 1}`;
}

function applyTemplate(plan: MealPlan, template: MealTemplateMode, customCounts: MealCountConfig, ingredientHints: string[]) {
  const counts = templateCounts(template, customCounts);
  const grouped: Record<MealDish["mealType"], MealDish[]> = { 早餐: [], 午餐: [], 晚餐: [], 加餐: [] };
  plan.meals.forEach((dish) => grouped[dish.mealType].push(dish));
  const fallbackPool = plan.meals.length > 0 ? plan.meals : [sanitizeDish({}, "午餐", 1)];
  const hints = unique(ingredientHints).slice(0, 20);

  const pickByType = (mealType: MealDish["mealType"], count: number) => {
    const pool = grouped[mealType].length > 0 ? grouped[mealType] : fallbackPool;
    return Array.from({ length: count }, (_, index) => {
      const base = pool[index % pool.length];
      const hint = hints[(index + count) % Math.max(1, hints.length)];
      const dishName = sanitizeDishName(base.dishName);
      return {
        ...base,
        id: `${mealType}-${index}-${base.id}-${Date.now()}`,
        mealType,
        slotLabel: slotLabel(mealType, index),
        dishName,
        ingredients: unique([...(base.ingredients || []), ...(hint ? [hint] : [])]).slice(0, 8)
      };
    });
  };

  const meals = [
    ...pickByType("早餐", counts.breakfast),
    ...pickByType("午餐", counts.lunch),
    ...pickByType("晚餐", counts.dinner),
    ...pickByType("加餐", counts.snack)
  ];
  return { ...plan, meals };
}

async function safeCopy(text: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function isSoup(name: string) {
  return /汤|羹|粥|煲/.test(name);
}

function isStaple(name: string) {
  return /饭|面|粥|粉|馒头|包子|主食|饼/.test(name);
}

function inferSlot(dish: MealDish): "soup" | "staple" | "main" {
  const slot = dish.slotLabel || "";
  if (slot.includes("汤") || isSoup(dish.dishName)) return "soup";
  if (slot.includes("主食") || isStaple(dish.dishName)) return "staple";
  return "main";
}

function normalizeIngredientToken(raw: string) {
  return raw
    .toLowerCase()
    .replace(/[0-9]+(?:\.[0-9]+)?\s*(g|kg|ml|克|毫升|份|个|只|片|勺|块)/gi, "")
    .replace(/[()（）【】\[\]·]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function coreComboKeyFromDish(dish: MealDish) {
  const tokens = unique((dish.ingredients || []).map((item) => normalizeIngredientToken(item)).filter(Boolean))
    .slice(0, 4)
    .sort();
  if (tokens.length === 0) return sanitizeDishName(dish.dishName).toLowerCase();
  return tokens.join("|");
}

function normalizeAvoidToken(raw: string) {
  return raw
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/^不吃/, "")
    .replace(/^不喝/, "")
    .replace(/^不碰/, "")
    .replace(/^忌/, "")
    .replace(/^禁/, "")
    .replace(/^避免/, "")
    .trim();
}

function ingredientConflictsWithAvoid(ingredient: string, avoid: string) {
  const ing = normalizeIngredientToken(ingredient);
  const avoidRaw = avoid.toLowerCase().replace(/\s+/g, "");
  const avoidCore = normalizeAvoidToken(avoid);
  if (!ing || !avoidCore) return false;

  const containsAny = (keywords: string[]) => keywords.some((item) => ing.includes(item));

  if (avoidRaw.includes("蛋类") || avoidCore.includes("蛋类")) {
    return containsAny(["蛋", "鸡蛋", "鸭蛋", "鹅蛋", "鹌鹑蛋", "皮蛋"]);
  }
  if (avoidRaw.includes("海鲜") || avoidCore.includes("海鲜") || avoidCore.includes("海产")) {
    return containsAny(["鱼", "虾", "蟹", "贝", "海带", "紫菜", "鲈鱼", "鳕鱼", "虾仁", "蛤蜊", "扇贝", "海鲜"]);
  }
  if (avoidRaw.includes("猪肉") || avoidCore.includes("猪肉")) {
    return containsAny(["猪", "猪肉", "里脊", "梅花肉"]);
  }
  if (avoidRaw.includes("辛辣") || avoidCore.includes("辛辣")) {
    return containsAny(["辣椒", "辣", "花椒", "麻椒", "辣酱", "辣条"]);
  }
  if (avoidRaw.includes("生冷") || avoidCore.includes("生冷")) {
    return containsAny(["刺身", "生", "冰"]);
  }

  if (avoidCore.length >= 2) {
    return ing.includes(avoidCore) || avoidCore.includes(ing);
  }

  return false;
}

export default function MealPlanPage() {
  const { locale, t } = useI18n();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [plan, setPlan] = useState<MealPlan | null>(null);

  const [loading, setLoading] = useState(false);
  const [generationStage, setGenerationStage] = useState<GenerationStage>("idle");
  const [generationProgress, setGenerationProgress] = useState(0);
  const [error, setError] = useState("");
  const [statusText, setStatusText] = useState("");
  const [replacingDishId, setReplacingDishId] = useState<string | null>(null);
  const [settingsHydrated, setSettingsHydrated] = useState(false);

  const [dietStage, setDietStage] = useState<DietStage>("清淡");
  const [symptom, setSymptom] = useState<SymptomType>("无");
  const [appetite, setAppetite] = useState<"差" | "一般" | "好">("一般");
  const [activePicker, setActivePicker] = useState<PickerField | null>(null);

  const [mealTemplate, setMealTemplate] = useState<MealTemplateMode>("均衡版");
  const [customMealCounts, setCustomMealCounts] = useState<MealCountConfig>(DEFAULT_COUNTS);
  const [stylePreference, setStylePreference] = useState<MealStylePreference>("家常");
  const [simplifyGoal, setSimplifyGoal] = useState<MealSimplifyGoal>("balanced");

  const [avoidFoods, setAvoidFoods] = useState<string[]>([]);
  const [builtInAvoidTags, setBuiltInAvoidTags] = useState<string[]>([...AVOID_TAGS]);
  const [customAvoidInput, setCustomAvoidInput] = useState("");
  const [customAvoidFoods, setCustomAvoidFoods] = useState<string[]>([]);

  const [ingredientDraft, setIngredientDraft] = useState("");
  const [ingredientChips, setIngredientChips] = useState<string[]>([]);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogKeyword, setCatalogKeyword] = useState("");
  const [activeCatalogId, setActiveCatalogId] = useState("common");
  const [catalogSelected, setCatalogSelected] = useState<string[]>([]);
  const [catalogCustomDraft, setCatalogCustomDraft] = useState("");
  const [catalogCustomByCategory, setCatalogCustomByCategory] = useState<Record<string, string[]>>({});

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showContext, setShowContext] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareSelection, setShareSelection] = useState<Record<MealDish["mealType"], boolean>>({ 早餐: true, 午餐: true, 晚餐: true, 加餐: true });
  const [copyToast, setCopyToast] = useState("");

  const fetchAbortRef = useRef<AbortController | null>(null);
  const generationRunRef = useRef(0);
  const progressTimerRef = useRef<number | null>(null);
  const copyToastTimerRef = useRef<number | null>(null);
  const speechBaseRef = useRef("");
  const quickLongPressTimerRef = useRef<number | null>(null);
  const quickLongPressTriggeredRef = useRef(false);

  const speech = useSpeechToText("zh-CN");
  const {
    isSupported: speechSupported,
    isListening: speechIsListening,
    transcript: speechTranscript,
    error: speechError,
    start: startSpeech,
    stop: stopSpeech,
    reset: resetSpeech
  } = speech;
  const localizeLabel = useCallback(
    (value: string) => {
      if (locale !== "en") return value;
      const map: Record<string, string> = {
        早餐: "Breakfast",
        午餐: "Lunch",
        晚餐: "Dinner",
        加餐: "Snack",
        流食: "Liquid",
        软食: "Soft",
        清淡: "Light",
        少油: "Low oil",
        少盐: "Low salt",
        温热: "Warm",
        高蛋白: "High protein",
        无: "None",
        恶心: "Nausea",
        吞咽不适: "Swallow discomfort",
        胀气: "Bloating",
        便秘: "Constipation",
        食欲差: "Low appetite",
        咽痛: "Sore throat",
        差: t("meal.appetiteBad"),
        一般: t("meal.appetiteNormal"),
        好: t("meal.appetiteGood"),
        省心版: "Simple",
        均衡版: "Balanced",
        家常版: "Home",
        自定义: "Custom",
        中式: "Chinese",
        西式: "Western",
        家常: "Home style",
        轻食: "Light meal"
      };
      return map[value] || value;
    },
    [locale, t]
  );

  useEffect(() => {
    const p = getProfile();
    if (!p) return;
    const normalized = { ...p, postOpDay: computePostOpDay(p.surgeryDate) || p.postOpDay };
    setProfile(normalized);

    const cached = getDailyMealPlan();
    if (cached) setPlan(cached);

    const settings = getMealSettingsDynamic();
    setDietStage(settings.dietStage);
    setSymptom(settings.symptom);
    setAppetite(settings.appetite);
    setMealTemplate(settings.mealTemplate || "均衡版");
    setCustomMealCounts(normalizeCounts(settings.customMealCounts));
    setStylePreference(settings.stylePreference || "家常");
    setSimplifyGoal(settings.simplifyGoal || "balanced");
    setAvoidFoods(settings.avoidFoods?.length ? settings.avoidFoods : normalized.longTermAvoidFoods || []);
    setCustomAvoidFoods(Array.isArray(settings.customAvoidFoods) ? settings.customAvoidFoods : []);
    setIngredientChips(parseIngredients(settings.availableIngredients || ""));
    setBuiltInAvoidTags([...AVOID_TAGS]);
    const prefs = getIngredientPreferenceStats();
    setCatalogCustomByCategory(prefs.customByCategory || {});
    setSettingsHydrated(true);
  }, []);

  useEffect(() => {
    return () => {
      fetchAbortRef.current?.abort();
      if (copyToastTimerRef.current) {
        window.clearTimeout(copyToastTimerRef.current);
        copyToastTimerRef.current = null;
      }
      if (quickLongPressTimerRef.current) {
        window.clearTimeout(quickLongPressTimerRef.current);
        quickLongPressTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!speechIsListening || !speechTranscript) return;
    const next = `${speechBaseRef.current} ${speechTranscript}`.trim();
    setIngredientDraft(next);
  }, [speechIsListening, speechTranscript]);

  useEffect(() => {
    if (speechIsListening) return;
    if (!speechTranscript) return;
    const parsed = parseSpeechIngredients(speechTranscript);
    if (parsed.length > 0) {
      setIngredientDraft(parsed.join("，"));
      setIngredientChips((prev) => unique([...prev, ...parsed]));
      setStatusText(t("meal.statusSpeechIngredientAdded", { items: parsed.join("、") }));
    } else {
      setIngredientDraft(speechTranscript.trim());
    }
    resetSpeech();
  }, [resetSpeech, speechIsListening, speechTranscript, t]);

  useEffect(() => {
    const clearTimer = () => {
      if (progressTimerRef.current) {
        window.clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    };
    if (!loading) {
      clearTimer();
      if (generationStage === "idle") setGenerationProgress(0);
      return clearTimer;
    }
    clearTimer();
    progressTimerRef.current = window.setInterval(() => {
      setGenerationProgress((prev) => {
        const ceiling = STAGE_CEILING[generationStage];
        if (prev >= ceiling) return prev;
        const delta = generationStage === "done" ? Math.max(4, (ceiling - prev) * 0.45) : Math.max(0.5, (ceiling - prev) * 0.1);
        return Math.min(ceiling, Number((prev + delta).toFixed(1)));
      });
    }, 120);
    return clearTimer;
  }, [generationStage, loading]);

  useEffect(() => {
    if (!settingsHydrated) return;
    setMealSettingsDynamic({
      date: new Date().toISOString().slice(0, 10),
      dietStage,
      symptom,
      appetite,
      mealTemplate,
      customMealCounts,
      stylePreference,
      simplifyGoal,
      nauseaLevel: "无",
      dietModes: [dietStage],
      avoidFoods,
      customAvoidFoods,
      availableIngredients: ingredientChips.join("，"),
      cookingTimeMinutes: 0,
      strategyHint: "",
      updatedAt: new Date().toISOString()
    });
  }, [appetite, customAvoidFoods, customMealCounts, dietStage, ingredientChips, mealTemplate, settingsHydrated, simplifyGoal, stylePreference, symptom, avoidFoods]);

  const groupedMeals = useMemo(() => {
    if (!plan) return [] as Array<{ mealType: MealDish["mealType"]; dishes: MealDish[] }>;
    const map: Record<MealDish["mealType"], MealDish[]> = { 早餐: [], 午餐: [], 晚餐: [], 加餐: [] };
    plan.meals.forEach((dish) => map[dish.mealType].push(dish));
    return MEAL_ORDER.map((mealType) => ({ mealType, dishes: map[mealType] })).filter((item) => item.dishes.length > 0);
  }, [plan]);

  const catalogItems = useMemo(() => {
    const keyword = catalogKeyword.trim();
    const base =
      activeCatalogId === "common"
        ? INGREDIENT_CATEGORIES.flatMap((item) => item.items).slice(0, 80)
        : INGREDIENT_CATEGORIES.find((item) => item.id === activeCatalogId)?.items || [];
    const custom = activeCatalogId === "common" ? [] : catalogCustomByCategory[activeCatalogId] || [];
    const merged = unique([...base, ...custom]);
    if (!keyword) return merged;
    return merged.filter((item) => item.includes(keyword));
  }, [activeCatalogId, catalogCustomByCategory, catalogKeyword]);

  const contextSummary = useMemo(() => {
    if (!profile) return locale === "en" ? "Please complete onboarding first." : "请先完成建档。";
    if (locale === "en") return `Condition: ${profile.surgeryDisplayName || profile.surgeryFinal || "Not filled"} · Day ${profile.postOpDay || 1}`;
    return `健康档案：${profile.surgeryDisplayName || profile.surgeryFinal || "未填写"} · Day ${profile.postOpDay || 1}`;
  }, [locale, profile]);

  const generationPercent = useMemo(() => Math.round(generationProgress), [generationProgress]);

  const generationHint = useMemo(() => {
    if (generationStage === "preparing") return t("meal.stagePreparing");
    if (generationStage === "requesting") return t("meal.stageRequesting");
    if (generationStage === "parsing") return t("meal.stageParsing");
    if (generationStage === "rendering") return t("meal.stageRendering");
    if (generationStage === "done") return t("meal.stageDone");
    return "";
  }, [generationStage, t]);

  const pickField = (field: PickerField, item: string) => {
    if (field === "dietStage") setDietStage(item as DietStage);
    if (field === "symptom") setSymptom(item as SymptomType);
    if (field === "appetite") {
      if (item === t("meal.appetiteBad")) setAppetite("差");
      else if (item === t("meal.appetiteGood")) setAppetite("好");
      else setAppetite("一般");
    }
    setActivePicker(null);
  };

  const appendIngredients = (value: string) => {
    const parsed = parseIngredients(value);
    if (parsed.length === 0) return;
    setIngredientChips((prev) => unique([...prev, ...parsed]));
    setIngredientDraft("");
  };

  const addCustomAvoid = (value: string) => {
    const parsed = parseIngredients(value);
    if (parsed.length === 0) return;
    setCustomAvoidFoods((prev) => unique([...prev, ...parsed]));
    setCustomAvoidInput("");
  };

  const fillIngredientDraft = (value: string) => {
    const parsed = parseIngredients(value);
    if (parsed.length === 0) return;
    setIngredientDraft((prev) => unique([...parseIngredients(prev), ...parsed]).join("，"));
  };

  const toggleIngredientSpeech = () => {
    if (!speechSupported) {
      setError(t("meal.speechUnsupported"));
      return;
    }
    setError("");
    if (speechIsListening) {
      stopSpeech();
      return;
    }
    speechBaseRef.current = ingredientDraft.trim();
    startSpeech();
  };

  const startQuickIngredientLongPress = (item: string) => {
    if (quickLongPressTimerRef.current) {
      window.clearTimeout(quickLongPressTimerRef.current);
      quickLongPressTimerRef.current = null;
    }
    quickLongPressTriggeredRef.current = false;
    quickLongPressTimerRef.current = window.setTimeout(() => {
      quickLongPressTriggeredRef.current = true;
      const confirmed = window.confirm(t("meal.deleteQuickIngredientConfirm", { item }));
      if (confirmed) {
        setIngredientChips((prev) => prev.filter((tag) => tag !== item));
        setStatusText(t("meal.statusQuickIngredientDeleted", { item }));
      }
    }, 600);
  };

  const cancelQuickIngredientLongPress = () => {
    if (quickLongPressTimerRef.current) {
      window.clearTimeout(quickLongPressTimerRef.current);
      quickLongPressTimerRef.current = null;
    }
  };

  const handleQuickIngredientClick = (item: string) => {
    if (quickLongPressTriggeredRef.current) {
      quickLongPressTriggeredRef.current = false;
      return;
    }
    fillIngredientDraft(item);
  };

  const resolveIngredientConflicts = (ingredients: string[]) => {
    const avoidList = unique([...avoidFoods, ...customAvoidFoods]);
    if (avoidList.length === 0) return { cleaned: unique(ingredients), removed: [] as Array<{ ingredient: string; avoid: string }> };

    const removed: Array<{ ingredient: string; avoid: string }> = [];
    const cleaned = ingredients.filter((ingredient) => {
      const hit = avoidList.find((avoid) => ingredientConflictsWithAvoid(ingredient, avoid));
      if (!hit) return true;
      removed.push({ ingredient, avoid: hit });
      return false;
    });
    return { cleaned: unique(cleaned), removed };
  };

  const showCopySuccessToast = () => {
    setCopyToast(t("meal.copySuccessToast"));
    if (copyToastTimerRef.current) {
      window.clearTimeout(copyToastTimerRef.current);
    }
    copyToastTimerRef.current = window.setTimeout(() => {
      setCopyToast("");
      copyToastTimerRef.current = null;
    }, 3000);
  };

  const changeCount = (key: keyof MealCountConfig, delta: number) => {
    setCustomMealCounts((prev) => {
      const next = { ...prev };
      const limit = key === "snack" ? [1, 3] : [1, 5];
      next[key] = clamp((prev[key] || 1) + delta, limit[0], limit[1]);
      return next;
    });
  };

  const applyCatalogSelected = () => {
    setIngredientChips((prev) => unique([...prev, ...catalogSelected]));
    setCatalogSelected([]);
    setCatalogOpen(false);
  };

  const addCustomCatalog = () => {
    const parsed = parseIngredients(catalogCustomDraft);
    if (parsed.length === 0 || activeCatalogId === "common") return;
    let latest = getIngredientPreferenceStats();
    parsed.forEach((item) => {
      latest = addCustomIngredientToCategory(activeCatalogId, item);
    });
    setCatalogCustomByCategory(latest.customByCategory || {});
    setCatalogSelected((prev) => unique([...prev, ...parsed]));
    setStatusText(t("meal.statusCatalogCustomAdded"));
    setCatalogCustomDraft("");
  };

  const toggleAdopt = (dishId: string, adopted: boolean) => {
    if (!plan) return;
    const next = updateDishStatus(plan.date, dishId, { adopted: !adopted });
    if (next) {
      setPlan(next);
      setStatusText(!adopted ? t("meal.statusAdopted") : t("meal.statusAdoptCanceled"));
    }
  };

  const toggleCompleted = (dishId: string, completed: boolean) => {
    if (!plan) return;
    const next = updateDishStatus(plan.date, dishId, { completed: !completed, adopted: true });
    if (next) {
      setPlan(next);
      setStatusText(!completed ? t("meal.statusCompleted") : t("meal.statusCompletedCanceled"));
    }
  };
  const generateMealPlan = async (forceRegenerate = false) => {
    if (!profile) return;
    const runId = Date.now();
    generationRunRef.current = runId;

    if (loading) fetchAbortRef.current?.abort();

    setError("");
    setStatusText("");
    setGenerationStage("preparing");
    setGenerationProgress(0);

    const selectedIngredients = unique(ingredientChips);
    if (selectedIngredients.length === 0) {
      setError(t("meal.statusNeedSelectedIngredients"));
      setGenerationStage("idle");
      return;
    }
    const conflictResult = resolveIngredientConflicts(selectedIngredients);
    const ingredientList = conflictResult.cleaned;

    if (conflictResult.removed.length > 0) {
      const removedText = unique(conflictResult.removed.map((item) => item.ingredient)).join("、");
      const avoidText = unique(conflictResult.removed.map((item) => item.avoid)).join("、");
      setStatusText(t("meal.statusIngredientConflictRemoved", { items: removedText, avoids: avoidText }));
      setIngredientChips(ingredientList);
    }

    if (ingredientList.length === 0) {
      setError(t("meal.statusIngredientConflictAllRemoved"));
      setGenerationStage("idle");
      return;
    }

    setLoading(true);
    setGenerationStage("requesting");
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    const fallback = applyTemplate(
      buildFallbackMealPlan({
        profile,
        todayState: {
          appetite,
          dietStage,
          symptom,
          mealTemplate,
          customMealCounts: normalizeCounts(customMealCounts),
          stylePreference,
          simplifyGoal,
          avoidFoods,
          customAvoidFoods,
          availableIngredients: ingredientList
        },
        availableIngredients: ingredientList
      }),
      mealTemplate,
      normalizeCounts(customMealCounts),
      ingredientList
    );

    try {
      const response = await fetch("/api/generate-meal-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          profile,
          todayState: {
            appetite,
            dietStage,
            symptom,
            mealTemplate,
            customMealCounts: normalizeCounts(customMealCounts),
            stylePreference,
            simplifyGoal,
            avoidFoods,
            customAvoidFoods,
            availableIngredients: ingredientList
          },
          availableIngredients: ingredientList,
          forceRegenerate
        })
      });

      const raw = await response.text();
      if (generationRunRef.current === runId) setGenerationStage("parsing");
      if (!response.ok) throw new Error(raw || "generate failed");

      let data: any = {};
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error("invalid json");
      }

      if (generationRunRef.current === runId) setGenerationStage("rendering");
      const next = normalizePlan(data, fallback);
      if (generationRunRef.current !== runId) return;

      setDailyMealPlan(next);
      setPlan(next);
      setGenerationStage("done");

      const source = data?.source || "ai";
      if (source === "safe-fallback") setStatusText(t("meal.statusSafeFallback"));
      else if (source === "mock") setStatusText(t("meal.statusMock"));
      else setStatusText(t("meal.statusGenerated"));
      await new Promise((resolve) => window.setTimeout(resolve, 700));
    } catch (err) {
      if (generationRunRef.current !== runId) return;
      if (err instanceof DOMException && err.name === "AbortError") {
        setStatusText(t("meal.statusCanceled"));
      } else {
        setError(toFriendlyError(err, t("meal.retryHint")));
        setStatusText(t("meal.statusFailed"));
      }
    } finally {
      if (generationRunRef.current !== runId) return;
      setLoading(false);
      setGenerationStage("idle");
      fetchAbortRef.current = null;
    }
  };

  const replaceOneDish = async (dish: MealDish) => {
    if (!plan || !profile) return;
    if (replacingDishId) return;

    const slot = inferSlot(dish);
    const selectedIngredients = unique(ingredientChips);
    if (selectedIngredients.length === 0) {
      setError(t("meal.statusNeedSelectedIngredients"));
      return;
    }
    const conflictResult = resolveIngredientConflicts(selectedIngredients);
    const ingredientList = conflictResult.cleaned;
    if (conflictResult.removed.length > 0) {
      const removedText = unique(conflictResult.removed.map((item) => item.ingredient)).join("、");
      const avoidText = unique(conflictResult.removed.map((item) => item.avoid)).join("、");
      setStatusText(t("meal.statusIngredientConflictRemoved", { items: removedText, avoids: avoidText }));
      setIngredientChips(ingredientList);
    }
    if (ingredientList.length === 0) {
      setError(t("meal.statusIngredientConflictAllRemoved"));
      return;
    }

    const blacklistNames = plan.meals.map((item) => sanitizeDishName(item.dishName));
    const blacklistCombos = plan.meals.map((item) => coreComboKeyFromDish(item));

    setReplacingDishId(dish.id);
    setError("");
    setStatusText(t("meal.stagePreparing"));

    try {
      const response = await fetch("/api/generate-meal-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "replace",
          profile,
          todayState: {
            appetite,
            dietStage,
            symptom,
            mealTemplate,
            customMealCounts: normalizeCounts(customMealCounts),
            stylePreference,
            simplifyGoal,
            avoidFoods,
            customAvoidFoods,
            availableIngredients: ingredientList
          },
          availableIngredients: ingredientList,
          replace: {
            dishId: dish.id,
            mealType: dish.mealType,
            slotLabel: dish.slotLabel,
            slotType: slot,
            blacklistNames,
            blacklistCombos
          }
        })
      });

      const raw = await response.text();
      if (!response.ok) throw new Error(raw || "replace failed");

      let data: any = {};
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error("invalid replace json");
      }

      if (!data?.dish) {
        setStatusText(t("meal.statusReplaceUnavailable"));
        return;
      }

      const patched = updateDishStatus(plan.date, dish.id, {
        slotLabel: data.dish.slotLabel || dish.slotLabel,
        dishName: sanitizeDishName(data.dish.dishName || dish.dishName),
        ingredients: Array.isArray(data.dish.ingredients) ? data.dish.ingredients : dish.ingredients,
        steps: Array.isArray(data.dish.steps) ? data.dish.steps : dish.steps,
        tags: Array.isArray(data.dish.tags) ? data.dish.tags : dish.tags,
        estimatedMinutes: Number(data.dish.estimatedMinutes) || dish.estimatedMinutes,
        safetyLabel: data.dish.safetyLabel || dish.safetyLabel,
        cautionNote: data.dish.cautionNote || dish.cautionNote,
        alternatives: Array.isArray(data.dish.alternatives) ? data.dish.alternatives : dish.alternatives,
        whyThisMeal: data.dish.whyThisMeal || dish.whyThisMeal,
        nutrition: data.dish.nutrition || dish.nutrition,
        adopted: false,
        completed: false
      });
      if (patched) {
        setPlan(patched);
        setStatusText(t("meal.statusReplaced"));
      } else {
        setStatusText(t("meal.statusReplaceUnavailable"));
      }
    } catch (err) {
      setError(toFriendlyError(err, t("meal.retryHint")));
      setStatusText(t("meal.statusReplaceUnavailable"));
    } finally {
      setReplacingDishId(null);
    }
  };

  const openPlatform = async (platform: PlatformKey, dishName: string) => {
    const pureName = sanitizeDishName(dishName);
    const copied = await safeCopy(pureName);
    const encoded = encodeURIComponent(pureName);
    const links: Record<PlatformKey, string> = {
      douyin: `https://www.douyin.com/search/${encoded}`,
      xiaohongshu: `https://www.xiaohongshu.com/search_result?keyword=${encoded}`,
      bilibili: `https://search.bilibili.com/all?keyword=${encoded}`
    };
    const opened = window.open(links[platform], "_blank", "noopener,noreferrer");
    if (!opened) {
      setStatusText(copied ? t("meal.searchCopiedFallback") : t("meal.searchFallback"));
      return;
    }
    setStatusText(copied ? t("meal.searchCopied") : t("meal.searchOpened"));
  };

  const shareText = useMemo(() => {
    if (!plan) return "";
    const selected = MEAL_ORDER.filter((item) => shareSelection[item]);
    if (selected.length === 0) return "";
    const sections = selected
      .map((mealType) => {
        const dishes = plan.meals.filter((item) => item.mealType === mealType);
        if (dishes.length === 0) return "";
        const lines = dishes.map((dish, index) => `${index + 1}. ${sanitizeDishName(dish.dishName)}`).join("\n");
        return `${localizeLabel(mealType)}\n${lines}`;
      })
      .filter(Boolean);
    return sections.length ? `${t("meal.shareTextTitle")}\n${sections.join("\n\n")}` : "";
  }, [localizeLabel, plan, shareSelection, t]);

  const shareCopyText = async () => {
    if (!shareText) {
      setStatusText(t("meal.shareSelectHint"));
      return;
    }
    const copied = await safeCopy(shareText);
    setStatusText(copied ? t("meal.shareCopied") : t("meal.shareCopyFailed"));
    if (copied) showCopySuccessToast();
  };

  const shareSystem = async () => {
    if (!shareText) {
      setStatusText(t("meal.shareSelectHint"));
      return;
    }
    if (typeof navigator === "undefined" || !navigator.share) {
      setStatusText(t("meal.shareNotSupported"));
      return;
    }
    try {
      await navigator.share({ title: t("meal.shareTitle"), text: shareText });
      setStatusText(t("meal.shareDone"));
    } catch {
      setStatusText(t("meal.shareCanceled"));
    }
  };

  const shareCopyLink = async () => {
    if (typeof window === "undefined") return;
    const copied = await safeCopy(window.location.href);
    setStatusText(copied ? t("meal.shareLinkCopied") : t("meal.shareCopyFailed"));
    if (copied) showCopySuccessToast();
  };

  if (!profile) {
    return (
      <AppContainer>
        <PageTitle title={t("meal.title")} center />
        <Card>
          <p className="text-[15px] text-[#636E72]">{t("common.noProfile")}</p>
          <Link href="/onboarding" className="mt-3 inline-block rounded-2xl bg-[#8AB4F8] px-4 py-2 text-[14px] text-white">
            {t("common.goOnboarding")}
          </Link>
        </Card>
      </AppContainer>
    );
  }

  return (
    <AppContainer>
      <PageTitle title={t("meal.title")} center />

      <Card className="mt-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[20px] font-semibold text-[#2C3E50]">{t("meal.planTitle")}</p>
            <p className="mt-1 text-[13px] text-[#636E72]">{t("meal.syncHint")}</p>
          </div>
          <button type="button" onClick={() => setShowContext((prev) => !prev)} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EEF4FF] text-[#8AB4F8]">
            i
          </button>
        </div>
        {showContext ? <p className="mt-2 rounded-2xl bg-[#F4F8FF] px-3 py-2 text-[12px] text-[#6D7F93]">{contextSummary}</p> : null}

        <div className="mt-4 grid grid-cols-3 items-start gap-2">
          {[
            { key: "dietStage" as PickerField, label: t("meal.dietStage"), value: localizeLabel(dietStage), options: Array.from(DIET_STAGE_OPTIONS) },
            { key: "symptom" as PickerField, label: t("meal.symptom"), value: localizeLabel(symptom), options: Array.from(SYMPTOM_OPTIONS) },
            { key: "appetite" as PickerField, label: t("meal.appetite"), value: localizeLabel(appetite), options: [t("meal.appetiteBad"), t("meal.appetiteNormal"), t("meal.appetiteGood")] }
          ].map((field) => (
            <div key={field.key} className="relative rounded-2xl bg-[#F4F8FF] p-2">
              <button type="button" onClick={() => setActivePicker((prev) => (prev === field.key ? null : field.key))} className="w-full text-center">
                <p className="text-[12px] text-[#7A8792]">{field.label}</p>
                <p className="mt-1 text-[14px] font-semibold text-[#2C3E50]">{field.value}</p>
              </button>
              {activePicker === field.key ? (
                <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 space-y-1 rounded-2xl bg-white p-2 shadow-[0_10px_30px_rgba(138,180,248,0.22)]">
                  {field.options.map((item) => (
                    <button key={`${field.key}-${item}`} type="button" onClick={() => pickField(field.key, item)} className="w-full rounded-xl bg-[#F4F8FF] px-2 py-1.5 text-center text-[12px] text-[#5F7080]">
                      {localizeLabel(item)}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="mt-4">
          <p className="text-[13px] text-[#636E72]">{t("meal.template")}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {TEMPLATE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setMealTemplate(option)}
                className={`rounded-2xl px-3 py-2 text-[13px] ${mealTemplate === option ? "bg-[#8AB4F8] text-white" : "bg-[#EEF4FF] text-[#636E72]"}`}
              >
                {localizeLabel(option)}
              </button>
            ))}
          </div>
          {mealTemplate === "自定义" ? (
            <div className="mt-3 rounded-2xl bg-[#F4F8FF] p-3">
              <p className="text-[13px] text-[#636E72]">{t("meal.customCountTitle")}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[
                  { key: "breakfast" as keyof MealCountConfig, label: t("meal.breakfastCount") },
                  { key: "lunch" as keyof MealCountConfig, label: t("meal.lunchCount") },
                  { key: "dinner" as keyof MealCountConfig, label: t("meal.dinnerCount") },
                  { key: "snack" as keyof MealCountConfig, label: t("meal.snackCount") }
                ].map((item) => (
                  <div key={item.key} className="rounded-xl bg-white p-2">
                    <p className="text-[12px] text-[#7A8792]">{item.label}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <button type="button" onClick={() => changeCount(item.key, -1)} className="h-7 w-7 rounded-full bg-[#EEF4FF] text-[#6D7F93]">-</button>
                      <span className="text-[14px] font-semibold text-[#2C3E50]">{customMealCounts[item.key]}</span>
                      <button type="button" onClick={() => changeCount(item.key, 1)} className="h-7 w-7 rounded-full bg-[#EEF4FF] text-[#6D7F93]">+</button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[13px] text-[#636E72]">{t("meal.stylePreference")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {STYLE_OPTIONS.map((style) => (
                  <button key={style} type="button" onClick={() => setStylePreference(style)} className={`rounded-full px-3 py-1 text-[12px] ${stylePreference === style ? "bg-[#CDB4DB] text-white" : "bg-white text-[#636E72]"}`}>
                    {localizeLabel(style)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-4 rounded-2xl bg-[#F4F8FF] p-2">
          <p className="text-[13px] text-[#636E72]">{t("meal.ingredients")}</p>
          <div className="mt-2 relative">
            <input
              value={ingredientDraft}
              onChange={(event) => setIngredientDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return;
                if (event.key === "Enter") {
                  event.preventDefault();
                  appendIngredients(ingredientDraft);
                }
              }}
              className="h-10 w-full rounded-full bg-white px-4 pr-12 text-[14px]"
              placeholder={t("meal.ingredientInput")}
            />
            <button
              type="button"
              onClick={toggleIngredientSpeech}
              className={`absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full ${
                speechIsListening ? "bg-[#EAF2FF] text-[#8AB4F8]" : "bg-[#EEF4FF] text-[#7A8792]"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="4" width="6" height="10" rx="3" />
                <path d="M6 10C6 13.3 8.7 16 12 16C15.3 16 18 13.3 18 10" strokeLinecap="round" />
                <path d="M12 16V20" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="mt-2">
            <p className="text-[12px] text-[#7A8792]">{t("meal.presetIngredients")}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {ingredientChips.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => handleQuickIngredientClick(item)}
                  onMouseDown={() => startQuickIngredientLongPress(item)}
                  onMouseUp={cancelQuickIngredientLongPress}
                  onMouseLeave={cancelQuickIngredientLongPress}
                  onTouchStart={() => startQuickIngredientLongPress(item)}
                  onTouchEnd={cancelQuickIngredientLongPress}
                  onTouchCancel={cancelQuickIngredientLongPress}
                  className="rounded-full bg-white px-3 py-1 text-[12px] text-[#6D7F93]"
                >
                  {item}
                </button>
              ))}
            </div>
            {ingredientChips.length === 0 ? (
              <p className="mt-2 text-[12px] text-[#7A8792]">{t("meal.quickIngredientsEmpty")}</p>
            ) : (
              <p className="mt-2 text-[12px] text-[#7A8792]">{t("meal.quickIngredientsHint")}</p>
            )}
          </div>
          <button type="button" onClick={() => setCatalogOpen(true)} className="mt-2 w-full rounded-2xl bg-white px-3 py-2 text-[13px] text-[#6D7F93]">
            {t("meal.catalogTitle")}
          </button>
          <p className="mt-2 text-[12px] text-[#636E72]">{speechError || (speechIsListening ? t("meal.speechListening") : t("meal.ingredientVoiceHint"))}</p>
        </div>

        <div className="mt-4">
          <p className="text-[13px] text-[#636E72]">{t("meal.avoidFoods")}</p>
          <div className="mt-2">
            <div className="grid grid-cols-3 gap-2">
              {builtInAvoidTags.map((tag) => {
                const selected = avoidFoods.includes(tag);
                return (
                  <span
                    key={tag}
                    className={`relative inline-flex h-10 w-full items-center justify-center rounded-full px-3 pr-7 text-center text-[13px] ${
                      selected ? "bg-[#B5EAD7] text-[#4F8D74]" : "bg-[#EEF4FF] text-[#636E72]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setAvoidFoods((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]))}
                      className="w-full whitespace-nowrap text-center"
                    >
                      {localizeLabel(tag)}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBuiltInAvoidTags((prev) => prev.filter((item) => item !== tag));
                        setAvoidFoods((prev) => prev.filter((item) => item !== tag));
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[13px] text-[#7F95B3]"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
              <input
                value={customAvoidInput}
                onChange={(event) => setCustomAvoidInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing) return;
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCustomAvoid(customAvoidInput);
                  }
                }}
                onBlur={() => addCustomAvoid(customAvoidInput)}
                className="h-10 w-full rounded-full bg-[#F4F8FF] px-3 text-center text-[12px]"
                placeholder={t("meal.customAvoidShort")}
              />
            </div>
            {customAvoidFoods.length > 0 ? (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                {customAvoidFoods.map((item) => (
                  <span key={item} className="inline-flex items-center rounded-full bg-[#EEF4FF] px-2 py-1 text-[12px] text-[#7A8792]">
                    {item}
                    <button type="button" onClick={() => setCustomAvoidFoods((prev) => prev.filter((tag) => tag !== item))} className="ml-1 text-[#7F95B3]">
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { key: "easy" as MealSimplifyGoal, label: t("meal.simplifyEasy") },
            { key: "balanced" as MealSimplifyGoal, label: t("meal.simplifyBalanced") },
            { key: "gentle" as MealSimplifyGoal, label: t("meal.simplifyGentle") }
          ].map((item) => (
            <button key={item.key} type="button" onClick={() => setSimplifyGoal(item.key)} className={`rounded-2xl px-2 py-2 text-[12px] ${simplifyGoal === item.key ? "bg-[#8AB4F8] text-white" : "bg-[#EEF4FF] text-[#636E72]"}`}>
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => generateMealPlan(false)} disabled={loading} className="rounded-2xl bg-[#8AB4F8] py-2 text-[14px] font-medium text-white disabled:opacity-60">
            {loading ? t("meal.regenerating") : t("meal.generate")}
          </button>
          <button type="button" onClick={() => generateMealPlan(true)} className="rounded-2xl bg-[#EEF4FF] py-2 text-[14px] font-medium text-[#636E72]">
            {t("meal.regenerate")}
          </button>
        </div>

        {loading ? (
          <div className="mt-3 rounded-2xl bg-[#F4F8FF] px-3 py-3">
            <div className="flex items-center justify-between text-[12px] text-[#636E72]">
              <span>{generationHint}</span>
              <span className="font-semibold text-[#8AB4F8]">{generationPercent}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-gradient-to-r from-[#8AB4F8] via-[#9AC8EB] to-[#B5EAD7]" style={{ width: `${generationPercent}%` }} />
            </div>
          </div>
        ) : null}
        {statusText ? <p className="mt-2 text-[12px] text-[#8AB4F8]">{statusText}</p> : null}
        {error ? <p className="mt-2 text-[12px] text-[#C27774]">{error}</p> : null}
      </Card>

      <Card className="mt-3">
        <div className="flex items-center justify-between">
          <p className="text-[20px] font-semibold text-[#2C3E50]">{t("meal.todayMenuTitle")}</p>
          {plan?.basisSummary ? <span className="text-[12px] text-[#7A8792]">{t("meal.generatedTag")}</span> : null}
        </div>
        {plan?.basisSummary ? <p className="mt-1 text-[12px] text-[#7A8792]">{plan.basisSummary}</p> : null}

        {groupedMeals.length > 0 ? (
          <div className="mt-3 space-y-4">
            {groupedMeals.map((group) => (
              <section key={group.mealType}>
                <p className="mb-2 text-[16px] font-semibold text-[#2C3E50]">{localizeLabel(group.mealType)}</p>
                <div className="space-y-2">
                  {group.dishes.map((dish) => {
                    const isOpen = expanded[dish.id] ?? false;
                    const nutrition = dish.nutrition || { caloriesKcal: 320, proteinG: 18, carbsG: 32, fatG: 9 };
                    return (
                      <div key={dish.id} className="rounded-2xl bg-[#F4F8FF] p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            {dish.slotLabel ? <p className="text-[12px] text-[#7A8792]">{localizeLabel(dish.slotLabel)}</p> : null}
                            <p className="text-[16px] font-semibold text-[#2C3E50]">{sanitizeDishName(dish.dishName)}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <button
                              type="button"
                              disabled={replacingDishId === dish.id}
                              onClick={() => void replaceOneDish(dish)}
                              className="text-[13px] text-[#8AB4F8] disabled:opacity-50"
                            >
                              {replacingDishId === dish.id ? t("meal.regenerating") : t("meal.replaceDish")}
                            </button>
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={() => void openPlatform("douyin", dish.dishName)} className="flex h-6 w-6 items-center justify-center rounded-full bg-black text-[11px] text-white">音</button>
                              <button type="button" onClick={() => void openPlatform("xiaohongshu", dish.dishName)} className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FF4D6D] text-[11px] text-white">书</button>
                              <button type="button" onClick={() => void openPlatform("bilibili", dish.dishName)} className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FB7299] text-[11px] text-white">站</button>
                            </div>
                          </div>
                        </div>
                        <p className="mt-2 text-[12px] text-[#7A8792]">
                          {t("meal.nutritionLine", { minutes: dish.estimatedMinutes || 20, calories: nutrition.caloriesKcal, protein: nutrition.proteinG, carbs: nutrition.carbsG, fat: nutrition.fatG })}
                        </p>
                        <button type="button" onClick={() => setExpanded((prev) => ({ ...prev, [dish.id]: !isOpen }))} className="mt-1 text-[13px] text-[#95A3AF]">
                          {isOpen ? t("meal.collapseDetail") : t("meal.viewDetail")}
                        </button>
                        {isOpen ? (
                          <div className="mt-2 space-y-1 text-[13px] text-[#636E72]">
                            <p>{t("meal.detailIngredients", { value: dish.ingredients?.length ? dish.ingredients.join("；") : "-" })}</p>
                            <p>{t("meal.detailSteps", { value: dish.steps?.length ? dish.steps.join("；") : "-" })}</p>
                            <p>{t("meal.detailReminder", { value: dish.cautionNote || "-" })}</p>
                          </div>
                        ) : null}
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => toggleAdopt(dish.id, Boolean(dish.adopted))} className={`rounded-xl py-1.5 text-[13px] ${dish.adopted ? "bg-[#EEF4FF] text-[#8AB4F8]" : "bg-white text-[#636E72]"}`}>{dish.adopted ? t("meal.adopted") : t("meal.adopt")}</button>
                          <button type="button" onClick={() => toggleCompleted(dish.id, Boolean(dish.completed))} className={`rounded-xl py-1.5 text-[13px] ${dish.completed ? "bg-[#D4EDDA] text-[#5FA287]" : "bg-white text-[#636E72]"}`}>{dish.completed ? t("meal.done") : t("meal.markDone")}</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-[13px] text-[#7A8792]">{t("meal.emptyMenuHint")}</p>
        )}

        <button type="button" onClick={() => setShareOpen(true)} className="mt-4 w-full rounded-full bg-[#8AB4F8] py-2.5 text-[14px] font-semibold text-white">{t("meal.shareMenu")}</button>
      </Card>

      {catalogOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#6E86A333] px-4">
          <div className="w-full max-w-[390px] rounded-[24px] bg-white p-4 shadow-[0_16px_36px_rgba(0,0,0,0.08)]">
            <div className="flex items-center justify-between">
              <p className="text-[16px] font-semibold text-[#2C3E50]">{t("meal.catalogTitle")}</p>
              <button type="button" onClick={() => setCatalogOpen(false)} className="text-[13px] text-[#7A8792]">{t("common.close")}</button>
            </div>
            <input value={catalogKeyword} onChange={(event) => setCatalogKeyword(event.target.value)} className="mt-2 h-10 w-full rounded-full bg-[#F4F8FF] px-4 text-[14px]" placeholder={t("meal.catalogSearchPlaceholder")} />
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {[{ id: "common", label: locale === "en" ? "Frequent" : "常用" }, ...INGREDIENT_CATEGORIES.map((item) => ({ id: item.id, label: item.label }))].map((item) => (
                <button key={item.id} type="button" onClick={() => setActiveCatalogId(item.id)} className={`whitespace-nowrap rounded-full px-3 py-1 text-[12px] ${activeCatalogId === item.id ? "bg-[#8AB4F8] text-white" : "bg-[#EEF4FF] text-[#636E72]"}`}>{item.label}</button>
              ))}
            </div>
            {activeCatalogId !== "common" ? (
              <div className="mt-2 flex gap-2">
                <input value={catalogCustomDraft} onChange={(event) => setCatalogCustomDraft(event.target.value)} className="h-9 flex-1 rounded-full bg-[#F4F8FF] px-3 text-[13px]" placeholder={t("meal.customCategoryPlaceholder")} />
                <button type="button" onClick={addCustomCatalog} className="rounded-full bg-[#EEF4FF] px-3 py-1 text-[12px] text-[#5E7A96]">{t("meal.add")}</button>
              </div>
            ) : null}
            <div className="mt-3 max-h-[36vh] overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {catalogItems.map((item) => {
                  const selected = catalogSelected.includes(item);
                  return (
                    <button key={`${activeCatalogId}-${item}`} type="button" onClick={() => setCatalogSelected((prev) => (prev.includes(item) ? prev.filter((v) => v !== item) : [...prev, item]))} className={`rounded-full px-3 py-1 text-[13px] ${selected ? "bg-[#8AB4F8] text-white" : "bg-[#EEF4FF] text-[#7A8792]"}`}>
                      {selected ? "✓ " : ""}{item}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setCatalogOpen(false)} className="rounded-full bg-[#EEF4FF] py-2 text-[13px] text-[#636E72]">{t("common.close")}</button>
              <button type="button" onClick={applyCatalogSelected} className="rounded-full bg-[#8AB4F8] py-2 text-[13px] text-white">{t("meal.addSelectedIngredients")}</button>
            </div>
          </div>
        </div>
      ) : null}

      {shareOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#6E86A333] px-4">
          <div className="w-full max-w-[390px] rounded-[24px] bg-white p-4 shadow-[0_16px_36px_rgba(0,0,0,0.08)]">
            <div className="flex items-center justify-between">
              <p className="text-[16px] font-semibold text-[#2C3E50]">{t("meal.shareTitle")}</p>
              <button type="button" onClick={() => setShareOpen(false)} className="text-[13px] text-[#7A8792]">{t("common.close")}</button>
            </div>
            <p className="mt-1 text-[12px] text-[#7A8792]">{t("meal.sharePickMealType")}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {MEAL_ORDER.map((mealType) => (
                <button key={mealType} type="button" onClick={() => setShareSelection((prev) => ({ ...prev, [mealType]: !prev[mealType] }))} className={`rounded-2xl px-3 py-2 text-[13px] ${shareSelection[mealType] ? "bg-[#8AB4F8] text-white" : "bg-[#EEF4FF] text-[#636E72]"}`}>
                  {localizeLabel(mealType)}
                </button>
              ))}
            </div>
            <div className="mt-3 whitespace-pre-line rounded-2xl bg-[#F4F8FF] p-2 text-[12px] text-[#6D7F93]">{shareText || t("meal.shareSelectHint")}</div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button type="button" onClick={() => void shareCopyText()} className="rounded-full bg-[#EEF4FF] py-2 text-[12px] text-[#636E72]">{t("meal.shareCopyText")}</button>
              <button type="button" onClick={() => void shareSystem()} className="rounded-full bg-[#EEF4FF] py-2 text-[12px] text-[#636E72]">{t("meal.shareSystem")}</button>
              <button type="button" onClick={() => void shareCopyLink()} className="rounded-full bg-[#EEF4FF] py-2 text-[12px] text-[#636E72]">{t("meal.shareCopyLink")}</button>
            </div>
          </div>
        </div>
      ) : null}

      {copyToast ? (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-white px-4 py-2 text-[13px] text-[#4F8D74] shadow-[0_10px_24px_rgba(0,0,0,0.12)]">
          <span className="mr-1 text-[#4F8D74]">✓</span>
          {copyToast}
        </div>
      ) : null}
    </AppContainer>
  );
}
