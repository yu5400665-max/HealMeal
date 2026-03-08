import { NextResponse } from "next/server";
import { askAIJson, isAIConfigured } from "@/src/lib/aiClient";

type MealSlot = "breakfast" | "lunch" | "dinner";
type MealTemplate = "省心版" | "均衡版" | "家常版" | "自定义";
type Appetite = "差" | "一般" | "好";

interface MealPlanRequestBody {
  dietStage?: string;
  currentSymptom?: string;
  appetite?: Appetite | string;
  template?: MealTemplate | string;
  availableIngredients?: string[];
  forbidden?: string[];
  preference?: string;
}

interface MenuDish {
  name: string;
  time: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients: string[];
  steps: string[];
  tips: string;
}

type MenuResult = Record<MealSlot, MenuDish[]>;

const SLOT_ORDER: MealSlot[] = ["breakfast", "lunch", "dinner"];
const DEFAULT_MODEL = "Qwen/Qwen3-8B-Instruct";
const DEFAULT_TIMEOUT_MS = 90000;
const DEFAULT_MAX_ATTEMPTS = 3;

const TEMPLATE_COUNTS: Record<string, Record<MealSlot, number>> = {
  省心版: { breakfast: 1, lunch: 1, dinner: 1 },
  均衡版: { breakfast: 1, lunch: 2, dinner: 2 },
  家常版: { breakfast: 1, lunch: 2, dinner: 2 },
  自定义: { breakfast: 1, lunch: 1, dinner: 1 }
};

const FORBIDDEN_GROUPS: Record<string, string[]> = {
  辛辣: ["辣椒", "花椒", "麻椒", "辣酱", "辣条", "麻辣"],
  海鲜: ["海鲜", "鱼", "虾", "蟹", "贝", "扇贝", "蛤蜊", "鳕鱼", "鲈鱼", "紫菜", "海带"],
  蛋类: ["蛋", "鸡蛋", "鸭蛋", "鹅蛋", "鹌鹑蛋", "皮蛋"],
  生冷: ["生", "冰", "刺身", "凉拌"],
  油炸: ["油炸", "炸", "酥炸", "炸鸡", "炸薯", "油条"],
  猪肉: ["猪", "五花", "里脊", "猪排", "排骨"]
};

const FALLBACK_LIBRARY: Record<MealSlot, MenuDish[]> = {
  breakfast: [
    {
      name: "南瓜小米粥",
      time: 20,
      calories: 210,
      protein: 5,
      carbs: 40,
      fat: 2,
      ingredients: ["南瓜", "小米"],
      steps: ["南瓜切小块与小米同煮", "小火煮至软糯", "温热后食用"],
      tips: "术后第7天建议温热软烂、少量多餐。"
    },
    {
      name: "香菇豆腐羹",
      time: 18,
      calories: 190,
      protein: 12,
      carbs: 14,
      fat: 8,
      ingredients: ["香菇", "豆腐"],
      steps: ["香菇切丁煮软", "加入豆腐小火煮开", "少盐调味即可"],
      tips: "蛋白和纤维兼顾，清淡易消化。"
    }
  ],
  lunch: [
    {
      name: "清炖乌鸡香菇汤",
      time: 40,
      calories: 320,
      protein: 28,
      carbs: 8,
      fat: 18,
      ingredients: ["乌鸡", "香菇"],
      steps: ["乌鸡焯水后入锅", "加香菇小火慢炖", "少盐调味后食用"],
      tips: "恢复期优先蒸煮炖，避免辛辣刺激。"
    },
    {
      name: "南瓜蒸豆腐",
      time: 20,
      calories: 220,
      protein: 14,
      carbs: 24,
      fat: 7,
      ingredients: ["南瓜", "豆腐"],
      steps: ["南瓜切块蒸至软", "豆腐切块同蒸", "少许温水调匀即可"],
      tips: "口感软烂，适合术后早期。"
    }
  ],
  dinner: [
    {
      name: "乌鸡豆腐炖汤",
      time: 35,
      calories: 280,
      protein: 24,
      carbs: 10,
      fat: 14,
      ingredients: ["乌鸡", "豆腐", "香菇"],
      steps: ["乌鸡与香菇先炖", "加入豆腐再煮10分钟", "少盐温热食用"],
      tips: "晚餐建议控制油脂并保持温热。"
    },
    {
      name: "香菇南瓜软煮",
      time: 22,
      calories: 230,
      protein: 9,
      carbs: 34,
      fat: 6,
      ingredients: ["香菇", "南瓜"],
      steps: ["南瓜与香菇切小块", "加水小火煮至软烂", "按口味少盐调味"],
      tips: "易咀嚼、易消化，减轻胃肠负担。"
    }
  ]
};

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  );
}

function normalizeToken(raw: string) {
  return raw
    .toLowerCase()
    .replace(/[0-9]+(?:\.[0-9]+)?\s*(g|kg|ml|克|毫升|份|个|只|片|勺|块)/gi, "")
    .replace(/[()（）【】\[\]·\s]/g, "")
    .trim();
}

function normalizeForbidden(raw: string) {
  return raw
    .replace(/^不吃|^不喝|^不碰|^忌|^禁|^避免/g, "")
    .trim();
}

function ingredientInAvailable(ingredient: string, allowedSet: Set<string>) {
  const token = normalizeToken(ingredient);
  if (!token || allowedSet.size === 0) return false;
  for (const allowed of allowedSet) {
    if (!allowed) continue;
    if (token === allowed || token.includes(allowed) || allowed.includes(token)) return true;
  }
  return false;
}

function ingredientConflictsForbidden(ingredient: string, forbidden: string[]) {
  const token = normalizeToken(ingredient);
  if (!token) return false;
  return forbidden.some((item) => {
    const raw = item.replace(/\s+/g, "");
    const core = normalizeForbidden(raw);
    if (!core) return false;
    const group = Object.entries(FORBIDDEN_GROUPS).find(([key]) => raw.includes(key) || core.includes(key));
    if (group) {
      return group[1].some((word) => token.includes(normalizeToken(word)));
    }
    const coreToken = normalizeToken(core);
    return Boolean(coreToken && (token.includes(coreToken) || coreToken.includes(token)));
  });
}

function parsePositiveInt(raw: string | undefined, fallback: number, min: number, max: number) {
  const value = Number((raw || "").trim());
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function normalizeDish(raw: unknown, fallbackName: string): MenuDish {
  const item = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    name: String(item.name || fallbackName).trim(),
    time: Math.max(5, Number(item.time) || 20),
    calories: Math.max(80, Number(item.calories) || 220),
    protein: Math.max(1, Number(item.protein) || 12),
    carbs: Math.max(1, Number(item.carbs) || 20),
    fat: Math.max(1, Number(item.fat) || 6),
    ingredients: toStringArray(item.ingredients).slice(0, 8),
    steps: toStringArray(item.steps).slice(0, 6),
    tips: String(item.tips || "请遵医嘱，出现不适及时咨询医生。").trim()
  };
}

function extractMenuLike(raw: unknown): Partial<Record<MealSlot, unknown>> {
  const base = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const candidates: Array<Record<string, unknown>> = [base];
  if (base.data && typeof base.data === "object") candidates.push(base.data as Record<string, unknown>);
  if (base.menu && typeof base.menu === "object") candidates.push(base.menu as Record<string, unknown>);
  if (base.result && typeof base.result === "object") candidates.push(base.result as Record<string, unknown>);

  for (const candidate of candidates) {
    if (SLOT_ORDER.some((slot) => Array.isArray(candidate[slot]))) {
      return candidate;
    }
  }
  return {};
}

function normalizeMenu(raw: unknown): MenuResult {
  const payload = extractMenuLike(raw);
  return {
    breakfast: (Array.isArray(payload.breakfast) ? payload.breakfast : []).map((item, index) => normalizeDish(item, `早餐建议${index + 1}`)),
    lunch: (Array.isArray(payload.lunch) ? payload.lunch : []).map((item, index) => normalizeDish(item, `午餐建议${index + 1}`)),
    dinner: (Array.isArray(payload.dinner) ? payload.dinner : []).map((item, index) => normalizeDish(item, `晚餐建议${index + 1}`))
  };
}

function validateMenu(menu: MenuResult, input: { availableIngredients: string[]; forbidden: string[]; template: string }) {
  const allowedSet = new Set(input.availableIngredients.map((item) => normalizeToken(item)).filter(Boolean));
  const reasons: string[] = [];
  const nameSet = new Set<string>();
  const expected = TEMPLATE_COUNTS[input.template] || TEMPLATE_COUNTS["均衡版"];

  SLOT_ORDER.forEach((slot) => {
    const dishes = menu[slot] || [];
    const minCount = Math.max(1, expected[slot] || 1);
    if (dishes.length < minCount) {
      reasons.push(`${slot} 菜品数量不足`);
    }
    dishes.forEach((dish) => {
      const name = String(dish.name || "").trim();
      if (!name) reasons.push(`${slot} 存在空菜名`);
      const nameKey = name.toLowerCase();
      if (nameSet.has(nameKey)) reasons.push(`菜名重复：${name}`);
      nameSet.add(nameKey);
      if (dish.ingredients.length === 0) reasons.push(`${name || slot} 缺少食材`);
      dish.ingredients.forEach((ingredient) => {
        if (!ingredientInAvailable(ingredient, allowedSet)) {
          reasons.push(`${name || slot} 使用了列表外食材：${ingredient}`);
        }
        if (ingredientConflictsForbidden(ingredient, input.forbidden)) {
          reasons.push(`${name || slot} 触发忌口：${ingredient}`);
        }
      });
    });
  });

  return {
    valid: reasons.length === 0,
    reason: reasons[0] || "",
    reasons
  };
}

function buildTemplateGuidance(template: string, preference: string) {
  if (template === "省心版") return "每餐菜品数量少，做法尽量一锅/一蒸/一炖，步骤短。";
  if (template === "家常版") return "家常做法，口味温和，符合日常餐桌习惯。";
  if (template === "自定义") return `按照偏好“${preference || "更营养均衡"}”调整复杂度和风格。`;
  return "均衡版：主食+蛋白+蔬菜搭配合理，营养全面。";
}

function buildPrompt(input: {
  dietStage: string;
  currentSymptom: string;
  appetite: string;
  template: string;
  availableIngredients: string[];
  forbidden: string[];
  preference: string;
}) {
  const expected = TEMPLATE_COUNTS[input.template] || TEMPLATE_COUNTS["均衡版"];
  return [
    "【患者基础信息】",
    `- 饮食阶段：${input.dietStage || "清淡"}`,
    `- 当前症状：${input.currentSymptom || "无"}`,
    `- 胃口：${input.appetite || "一般"}`,
    `- 套餐模板：${input.template}`,
    `- 可用食材（唯一来源）：${input.availableIngredients.join("、")}`,
    `- 忌口：${input.forbidden.length > 0 ? input.forbidden.join("、") : "无"}`,
    `- 偏好：${input.preference || "更营养均衡"}`,
    "",
    "【任务】你是一位专业的术后康复营养师，请为胆囊切除术后第7天患者设计全天菜单。",
    "【强约束】",
    "1) 所有食材必须只来自可用食材列表，严禁使用列表外食材。",
    "2) 严格遵守忌口。",
    "3) 菜名必须是现实中存在的家常菜，禁止黑暗料理和网络梗。",
    "4) 早餐、午餐、晚餐之间菜名不能重复。",
    "5) 省心版/均衡版/家常版/自定义要体现差异。",
    `6) 本次建议数量：早餐${expected.breakfast}道，午餐${expected.lunch}道，晚餐${expected.dinner}道。`,
    `7) ${buildTemplateGuidance(input.template, input.preference)}`,
    "",
    "【输出格式】只输出严格 JSON 对象，不要任何解释：",
    "{",
    '  "breakfast": [{"name":"菜名","time":15,"calories":200,"protein":10,"carbs":25,"fat":5,"ingredients":["食材1","食材2"],"steps":["步骤1","步骤2"],"tips":"健康提醒"}],',
    '  "lunch": [{"name":"菜名","time":20,"calories":280,"protein":20,"carbs":30,"fat":9,"ingredients":["食材1","食材2"],"steps":["步骤1","步骤2"],"tips":"健康提醒"}],',
    '  "dinner": [{"name":"菜名","time":20,"calories":260,"protein":18,"carbs":28,"fat":8,"ingredients":["食材1","食材2"],"steps":["步骤1","步骤2"],"tips":"健康提醒"}]',
    "}"
  ].join("\n");
}

function buildDynamicFallbackDish(slot: MealSlot, available: string[], preference: string, index: number): MenuDish {
  const a = available[index % available.length] || "南瓜";
  const b = available[(index + 1) % available.length] || "豆腐";
  const pair = a === b ? a : `${a}${b}`;
  const method = preference.includes("简单") ? "清煮" : preference.includes("清淡") ? "温炖" : "清炖";
  const name = slot === "breakfast" ? `${pair}软粥` : slot === "lunch" ? `${method}${pair}` : `${pair}温和汤`;
  return {
    name,
    time: slot === "breakfast" ? 18 : 25,
    calories: slot === "breakfast" ? 210 : 260,
    protein: slot === "breakfast" ? 10 : 18,
    carbs: slot === "breakfast" ? 28 : 24,
    fat: slot === "breakfast" ? 5 : 8,
    ingredients: Array.from(new Set([a, b])),
    steps: ["食材切小块", "采用蒸/煮/炖的温和方式烹饪", "少盐少油后温热食用"],
    tips: "若出现腹胀或恶心，请减少单次进食量并放慢进食速度。"
  };
}

function buildFallbackMenu(input: { availableIngredients: string[]; forbidden: string[]; template: string; preference: string }) {
  const expected = TEMPLATE_COUNTS[input.template] || TEMPLATE_COUNTS["均衡版"];
  const allowedSet = new Set(input.availableIngredients.map((item) => normalizeToken(item)).filter(Boolean));
  const usedNames = new Set<string>();

  const pickForSlot = (slot: MealSlot) => {
    const targetCount = Math.max(1, expected[slot] || 1);
    const picked: MenuDish[] = [];
    for (const candidate of FALLBACK_LIBRARY[slot]) {
      if (picked.length >= targetCount) break;
      const allowed = candidate.ingredients.every((ingredient) => ingredientInAvailable(ingredient, allowedSet));
      const noForbidden = candidate.ingredients.every((ingredient) => !ingredientConflictsForbidden(ingredient, input.forbidden));
      const notDup = !usedNames.has(candidate.name.toLowerCase());
      if (!allowed || !noForbidden || !notDup) continue;
      picked.push(candidate);
      usedNames.add(candidate.name.toLowerCase());
    }
    let index = 0;
    while (picked.length < targetCount) {
      const dynamic = buildDynamicFallbackDish(slot, input.availableIngredients, input.preference, index);
      index += 1;
      if (usedNames.has(dynamic.name.toLowerCase())) continue;
      const noForbidden = dynamic.ingredients.every((ingredient) => !ingredientConflictsForbidden(ingredient, input.forbidden));
      if (!noForbidden) continue;
      picked.push(dynamic);
      usedNames.add(dynamic.name.toLowerCase());
    }
    return picked;
  };

  return {
    breakfast: pickForSlot("breakfast"),
    lunch: pickForSlot("lunch"),
    dinner: pickForSlot("dinner")
  } satisfies MenuResult;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as MealPlanRequestBody;
    const availableIngredients = toStringArray(body.availableIngredients);
    if (availableIngredients.length === 0) {
      return NextResponse.json({ error: "availableIngredients is required" }, { status: 400 });
    }

    const input = {
      dietStage: String(body.dietStage || "清淡").trim(),
      currentSymptom: String(body.currentSymptom || "无").trim(),
      appetite: String(body.appetite || "一般").trim(),
      template: String(body.template || "均衡版").trim(),
      availableIngredients,
      forbidden: toStringArray(body.forbidden),
      preference: String(body.preference || "更营养均衡").trim()
    };

    const fallbackMenu = buildFallbackMenu(input);
    const timeoutMs = parsePositiveInt(process.env.MEAL_AI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 10000, 180000);
    const maxAttempts = parsePositiveInt(process.env.MEAL_AI_MAX_ATTEMPTS, DEFAULT_MAX_ATTEMPTS, 1, 5);
    const model = (process.env.AI_MODEL_MEAL_TEXT || DEFAULT_MODEL).trim() || DEFAULT_MODEL;

    if (!isAIConfigured()) {
      return NextResponse.json(fallbackMenu);
    }

    const systemPrompt =
      "你是专业的术后康复营养师，服务对象是胆囊切除术后第7天患者。" +
      "你必须严格执行用户提供的可用食材和忌口限制。" +
      "输出只允许是 JSON 对象，不能包含任何解释文字。";

    let lastReason = "";
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const raw = await askAIJson<unknown>(systemPrompt, buildPrompt(input), {
          model,
          timeoutMs,
          maxAttempts: 1,
          temperature: 0.2
        });

        const normalized = normalizeMenu(raw);
        const validation = validateMenu(normalized, input);
        if (validation.valid) {
          return NextResponse.json(normalized);
        }
        lastReason = validation.reason || "validation failed";
      } catch (error) {
        lastReason = error instanceof Error ? error.message : "ai request failed";
      }
    }

    console.warn("[meal-plan] fallback activated:", lastReason);
    return NextResponse.json(fallbackMenu);
  } catch (error) {
    console.error("[meal-plan] fatal error:", error);
    // Even for unexpected errors, return safe fallback to avoid front-end hard failure.
    const fallbackMenu = buildFallbackMenu({
      availableIngredients: ["南瓜", "豆腐", "乌鸡", "香菇"],
      forbidden: [],
      template: "均衡版",
      preference: "更营养均衡"
    });
    return NextResponse.json(fallbackMenu);
  }
}
