import { DISCLAIMER } from "./constants";
import type { MealDish, MealPlan, Profile, TodayState } from "./types";

interface GenerateMealPlanInput {
  profile?: Profile;
  todayState?: TodayState;
  availableIngredients?: string[];
}

function dish(base: Omit<MealDish, "id" | "adopted" | "completed">, idx: number): MealDish {
  return {
    ...base,
    id: `${base.mealType}-${idx}-${Date.now()}`,
    adopted: false,
    completed: false
  };
}

export function buildFallbackMealPlan(input: GenerateMealPlanInput): MealPlan {
  const surgery = input.profile?.surgeryDisplayName || input.profile?.surgeryFinal || "术后恢复";
  const day = input.profile?.postOpDay || 7;
  const appetite = input.todayState?.appetite || "一般";
  const pantry = (input.availableIngredients || []).slice(0, 8);
  const strictPantryMode = pantry.length > 0;
  const pick = (index: number, fallback: string) => {
    if (!strictPantryMode) return fallback;
    return pantry[index % pantry.length];
  };
  const ingredients = input.availableIngredients?.length
    ? `优先使用家中食材：${input.availableIngredients.join("、")}`
    : "优先选择温热、软烂、易消化食材";

  return {
    date: new Date().toISOString().slice(0, 10),
    disclaimer: DISCLAIMER,
    basisSummary: `基于${surgery}，术后第${day}天，食欲${appetite}。${ingredients}`,
    contextSummary: "仅供饮食与康复陪伴参考，任何不适请及时联系医生。",
    meals: [
      dish(
        {
          mealType: "早餐",
          dishName: strictPantryMode ? `${pick(0, "南瓜")}暖胃粥` : `${pick(0, "南瓜")}小米粥 + 蒸蛋羹`,
          ingredients: strictPantryMode
            ? [pick(0, "南瓜"), pick(1, "鸡蛋")]
            : ["小米 40g", `${pick(0, "南瓜")} 80g`, `${pick(1, "鸡蛋")} 1份`, "温水 120ml"],
          steps: ["食材小火煮至软烂", "少油少盐，温热食用"],
          tags: ["易消化", "温热", "低刺激"],
          estimatedMinutes: 18,
          safetyLabel: "术后友好",
          cautionNote: "如吞咽不适，粥可再稀释。",
          alternatives: ["山药粥", "燕麦牛奶羹"],
          whyThisMeal: "碳水与蛋白搭配温和，利于晨间补能与胃肠负担控制。",
          nutrition: { caloriesKcal: 285, proteinG: 14, carbsG: 38, fatG: 7 },
          imageUrl: "/meal-placeholder.svg"
        },
        1
      ),
      dish(
        {
          mealType: "午餐",
          dishName: strictPantryMode ? `${pick(2, "鸡胸肉")}温和菜` : `清炖${pick(2, "鸡胸肉")}豆腐盅 + 软米饭`,
          ingredients: strictPantryMode
            ? [pick(2, "鸡胸肉"), pick(3, "嫩豆腐"), pick(4, "胡萝卜")]
            : [`${pick(2, "鸡胸肉")} 80g`, `${pick(3, "嫩豆腐")} 120g`, `${pick(4, "胡萝卜")} 40g`, "大米 60g"],
          steps: ["食材切小块后蒸/煮/炖至软烂", "少油少盐，温热食用"],
          tags: ["高蛋白", "少油", "软烂"],
          estimatedMinutes: 25,
          safetyLabel: "恢复期推荐",
          cautionNote: "盐量控制在低水平，避免辛辣调味。",
          alternatives: ["鱼片豆腐汤", "瘦肉蒸豆腐"],
          whyThisMeal: "提供优质蛋白，帮助组织修复，同时保持低油低刺激。",
          nutrition: { caloriesKcal: 435, proteinG: 33, carbsG: 46, fatG: 12 },
          imageUrl: "/meal-placeholder.svg"
        },
        2
      ),
      dish(
        {
          mealType: "晚餐",
          dishName: strictPantryMode ? `${pick(5, "番茄")}温和菜` : `${pick(5, "番茄")}${pick(6, "土豆")}软炖`,
          ingredients: strictPantryMode
            ? [pick(5, "番茄"), pick(6, "土豆"), pick(2, "牛肉")]
            : [`${pick(2, "牛肉")} 70g`, `${pick(5, "番茄")} 100g`, `${pick(6, "土豆")} 80g`],
          steps: ["食材切小块后蒸/煮/炖至软烂", "少油少盐，温热食用"],
          tags: ["补铁", "温热", "低刺激"],
          estimatedMinutes: 28,
          safetyLabel: "晚餐均衡",
          cautionNote: "如胃胀，可减少牛肉量并延长炖煮。",
          alternatives: ["胡萝卜鸡丝面", "虾仁南瓜粥"],
          whyThisMeal: "晚餐控制总量同时补充蛋白和微量营养素。",
          nutrition: { caloriesKcal: 420, proteinG: 29, carbsG: 35, fatG: 14 },
          imageUrl: "/meal-placeholder.svg"
        },
        3
      ),
      dish(
        {
          mealType: "加餐",
          dishName: strictPantryMode ? `${pick(7, "酸奶")}轻加餐` : `温${pick(7, "酸奶")} + 软果泥`,
          ingredients: strictPantryMode ? [pick(7, "低糖酸奶"), pick(0, "香蕉")] : [`${pick(7, "低糖酸奶")} 120ml`, `${pick(0, "香蕉")} 半份`],
          steps: ["食材做成软烂状态", "少量多次食用"],
          tags: ["加餐", "易吸收"],
          estimatedMinutes: 8,
          safetyLabel: "可选",
          cautionNote: "乳糖不耐受者可改豆浆。",
          alternatives: ["蒸苹果泥", "温豆浆"],
          whyThisMeal: "少量多次补能，减轻正餐压力。",
          nutrition: { caloriesKcal: 150, proteinG: 6, carbsG: 22, fatG: 4 },
          imageUrl: "/meal-placeholder.svg"
        },
        4
      )
    ]
  };
}

export function buildFallbackAskAnswer(question: string, mode?: string) {
  const q = question || "";

  if (mode === "exercise") {
    return {
      answer: "可以先从低强度活动开始，例如散步10-20分钟，过程中若出现明显不适应立即停止并联系医生。",
      suggestions: ["先低强度", "循序渐进", "不适及时停"]
    };
  }

  if (mode === "journal-summary" || mode === "emotion-summary" || mode === "checkin-summary") {
    return {
      answer: "今天整体状态稳定，建议继续保持规律进食、适量活动与充足饮水。你已经在稳步恢复中。",
      suggestions: ["规律作息", "少量多餐", "遵医嘱优先"]
    };
  }

  if (mode === "family-encourage") {
    return {
      answer: "你已经很棒了，我们会陪你一起把恢复节奏稳住。今天先把吃饭、喝水和休息做好就很好。",
      suggestions: ["温柔提醒", "减少焦虑", "关注执行"]
    };
  }

  if (q.includes("7天") || q.includes("不重样")) {
    return {
      answer:
        "可以，建议按‘软烂主食 + 温和蛋白 + 熟蔬菜’结构轮换7天，每天三餐尽量不重复烹饪方式。",
      suggestions: ["按清淡低刺激为主", "每天至少1餐优质蛋白", "根据食欲做少量多餐"]
    };
  }

  if (q.includes("能不能吃") || q.includes("行不行") || q.includes("可以吃")) {
    return {
      answer:
        "可先按‘软、温、淡、熟’四条标准判断：太硬、太辣、太油、太烫通常不建议。若有不适请及时就医。",
      suggestions: ["优先蒸煮炖", "观察进食后反应", "症状加重及时就医"]
    };
  }

  return {
    answer:
      "若有喉咙不适或疲劳，建议改为温热软烂、少量多餐。具体方案仍以医生建议为准。",
    suggestions: ["清淡少油", "补充水分", "遵医嘱优先"]
  };
}
