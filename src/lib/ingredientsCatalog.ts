export interface IngredientCategory {
  id: string;
  label: string;
  items: string[];
}

export interface IngredientPreferenceStats {
  usage: Record<string, number>;
  recent: string[];
  hiddenTop: string[];
  customByCategory: Record<string, string[]>;
}

const STORAGE_KEY = "ingredient_prefs_v1";
const MAX_RECENT = 40;

const EMPTY_PREFS: IngredientPreferenceStats = {
  usage: {},
  recent: [],
  hiddenTop: [],
  customByCategory: {}
};

export const INGREDIENT_CATEGORIES: IngredientCategory[] = [
  {
    id: "fruits",
    label: "水果",
    items: ["苹果", "香蕉", "火龙果", "榴莲", "橙子", "猕猴桃", "桃", "梨", "葡萄", "木瓜", "蓝莓", "草莓"]
  },
  {
    id: "vegetables",
    label: "蔬菜",
    items: ["白菜", "小青菜", "胡萝卜", "香菇", "南瓜", "西兰花", "番茄", "黄瓜", "菠菜", "娃娃菜", "油麦菜", "冬瓜"]
  },
  {
    id: "meat",
    label: "肉类",
    items: ["土鸡", "乌鸡", "鸡腿", "鸡胸", "鸡翅", "猪里脊", "猪前腿", "猪梅花", "猪瘦肉", "牛上脑", "牛里脊", "吊龙", "雪花牛"]
  },
  {
    id: "seafood",
    label: "水产（可选）",
    items: ["鲈鱼", "鳕鱼", "虾仁", "蛤蜊", "扇贝", "海带", "紫菜"]
  },
  {
    id: "staple",
    label: "主食/碳水",
    items: ["米饭", "面条", "粥", "红薯", "土豆", "燕麦", "玉米", "馒头", "小米"]
  },
  {
    id: "seasoning",
    label: "调料/滋补食材",
    items: ["枸杞", "红枣", "当归", "党参", "黄芪", "姜", "葱", "蒜"]
  }
];

function isBrowser() {
  return typeof window !== "undefined";
}

function normalizeIngredient(name: string) {
  return name.trim();
}

export function parseIngredientText(input: string) {
  return input
    .split(/[,，、;；|\n\r\t]+/)
    .map((item) => normalizeIngredient(item))
    .filter(Boolean);
}

export function getIngredientPreferenceStats(): IngredientPreferenceStats {
  if (!isBrowser()) return EMPTY_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_PREFS;
    const parsed = JSON.parse(raw) as IngredientPreferenceStats;
    if (!parsed || typeof parsed !== "object") return EMPTY_PREFS;
    return {
      usage: parsed.usage || {},
      recent: Array.isArray(parsed.recent) ? parsed.recent : [],
      hiddenTop: Array.isArray(parsed.hiddenTop) ? parsed.hiddenTop : [],
      customByCategory: parsed.customByCategory && typeof parsed.customByCategory === "object" ? parsed.customByCategory : {}
    };
  } catch {
    return EMPTY_PREFS;
  }
}

function saveIngredientPreferenceStats(stats: IngredientPreferenceStats) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // ignore
  }
}

export function increaseIngredientPreference(ingredients: string[]) {
  const parsed = ingredients.map((item) => normalizeIngredient(item)).filter(Boolean);
  if (parsed.length === 0) return getIngredientPreferenceStats();

  const unique = Array.from(new Set(parsed));
  const current = getIngredientPreferenceStats();
  const nextUsage = { ...current.usage };
  unique.forEach((item) => {
    nextUsage[item] = (nextUsage[item] || 0) + 1;
  });

  const nextRecent = [...unique.reverse(), ...current.recent.filter((item) => !unique.includes(item))].slice(0, MAX_RECENT);
  const next = {
    usage: nextUsage,
    recent: nextRecent,
    hiddenTop: current.hiddenTop.filter((item) => !unique.includes(item)),
    customByCategory: current.customByCategory
  };
  saveIngredientPreferenceStats(next);
  return next;
}

export function getTopIngredients(stats: IngredientPreferenceStats, limit = 10) {
  const fromUsage = Object.entries(stats.usage)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
    .map(([name]) => name);
  const merged = Array.from(new Set([...stats.recent, ...fromUsage])).filter((item) => !stats.hiddenTop.includes(item));
  return merged.slice(0, limit);
}

export function sortByPreference(items: string[], stats: IngredientPreferenceStats) {
  const usage = stats.usage || {};
  return [...items].sort((a, b) => {
    const diff = (usage[b] || 0) - (usage[a] || 0);
    if (diff !== 0) return diff;
    const recentDiff = stats.recent.indexOf(a) - stats.recent.indexOf(b);
    if (recentDiff !== 0 && stats.recent.includes(a) && stats.recent.includes(b)) return recentDiff;
    return a.localeCompare(b, "zh-CN");
  });
}

export function hideTopIngredient(ingredient: string) {
  const current = getIngredientPreferenceStats();
  const next = {
    ...current,
    hiddenTop: Array.from(new Set([...current.hiddenTop, ingredient]))
  };
  saveIngredientPreferenceStats(next);
  return next;
}

export function restoreTopIngredient(ingredient: string) {
  const current = getIngredientPreferenceStats();
  const next = {
    ...current,
    hiddenTop: current.hiddenTop.filter((item) => item !== ingredient)
  };
  saveIngredientPreferenceStats(next);
  return next;
}

export function restoreAllTopIngredients() {
  const current = getIngredientPreferenceStats();
  const next = {
    ...current,
    hiddenTop: []
  };
  saveIngredientPreferenceStats(next);
  return next;
}

export function addCustomIngredientToCategory(categoryId: string, ingredient: string) {
  const name = normalizeIngredient(ingredient);
  if (!name) return getIngredientPreferenceStats();

  const current = getIngredientPreferenceStats();
  const currentList = current.customByCategory[categoryId] || [];
  const nextCustomList = Array.from(new Set([name, ...currentList]));
  const next = {
    ...current,
    customByCategory: {
      ...current.customByCategory,
      [categoryId]: nextCustomList
    }
  };
  saveIngredientPreferenceStats(next);
  return increaseIngredientPreference([name]);
}
