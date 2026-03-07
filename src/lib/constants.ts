export const APP_NAME = "愈后食光 HealMeal";

export const DISCLAIMER = "本产品仅提供术后饮食与康复陪伴建议，不构成诊断或治疗方案，请始终以医生医嘱为准。";

export const MOTIVATIONS = [
  "每一口温和营养，都是在为恢复加分。",
  "今天也在认真照顾自己，你做得很好。",
  "恢复是一场耐心赛，慢慢来更稳。",
  "规律吃饭和休息，会让身体更快找回状态。",
  "你不是一个人在康复，家人和我们都在。",
  "把今天过好，就已经很了不起。",
  "先照顾好身体，其他事情都可以慢一点。"
];

export const HOME_MOTIVATION_KEYS = [
  "home.motivationOption1",
  "home.motivationOption2",
  "home.motivationOption3",
  "home.motivationOption4",
  "home.motivationOption5",
  "home.motivationOption6",
  "home.motivationOption7"
] as const;

export const HOME_DAY_STATUS_KEYS = [
  "home.dayStatusSteadyBetter",
  "home.dayStatusBalancedPace",
  "home.dayStatusNourishDaily"
] as const;

export const SURGERY_OPTIONS: Record<string, string[]> = {
  骨科: ["骨折内固定术后", "关节置换术后", "韧带修复术后"],
  耳鼻喉: ["扁桃体术后", "鼻中隔手术术后", "喉部手术术后"],
  甲乳: ["甲状腺切除术后", "乳腺手术术后"],
  普外: ["阑尾术后", "疝修补术后"],
  消化道: ["胃部手术术后", "肠道手术术后", "胆囊切除术后"],
  泌尿: ["肾结石手术术后", "前列腺手术术后"],
  妇科: ["剖宫产术后", "子宫手术术后", "卵巢手术术后"],
  神外: ["颅脑手术术后", "脊柱手术术后"],
  心胸外: ["心脏术后", "肺部手术术后"],
  眼科: ["白内障术后", "视网膜手术术后"],
  口腔颌面: ["拔牙术后", "颌面修复术后"],
  其他: []
};

export const ALLERGEN_TAGS = ["牛奶", "蛋类", "花生", "坚果", "海鲜", "大豆", "小麦"];

export const AVOID_TAGS = ["不吃辛辣", "不吃海鲜", "不吃蛋类", "不吃生冷", "不吃油炸", "不吃猪肉"];

export const DIET_MODE_TAGS = ["流食", "软食", "清淡", "少油", "少盐", "温热", "高蛋白"];

export const DIET_STAGE_OPTIONS = ["流食", "软食", "清淡", "少油", "少盐", "温热", "高蛋白"] as const;

export const SYMPTOM_OPTIONS = ["无", "恶心", "吞咽不适", "胀气", "便秘", "食欲差", "咽痛"] as const;

export const MOOD_OPTIONS = ["😄", "🙂", "😐", "😣", "😔"];

export const EXERCISE_TYPES = ["散步", "慢跑", "跑步", "拉伸", "瑜伽", "康复训练", "游泳", "其他"] as const;

export const ECO_CATEGORIES = ["全部", "术后饮食", "康复训练", "情绪陪伴", "家属经验"] as const;
