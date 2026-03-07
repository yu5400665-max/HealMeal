export interface RecoveryRule {
  key: string;
  title: string;
  earlyStage: string;
  midStage: string;
  lateStage: string;
  cookingMethods: string[];
  avoid: string[];
  generalTips: string[];
}

const RULES: RecoveryRule[] = [
  {
    key: "thyroid",
    title: "甲状腺与内分泌术后",
    earlyStage: "前1-3天优先温凉软食，避免刺激性食物。",
    midStage: "第4-14天逐步增加优质蛋白与熟蔬菜。",
    lateStage: "恢复期保持均衡饮食，控制重口味。",
    cookingMethods: ["蒸", "煮", "炖", "软烂", "温热"],
    avoid: ["辛辣", "酒精", "过烫", "油炸", "硬壳食物"],
    generalTips: ["关注吞咽舒适度", "分餐少量多次", "遵医嘱补充营养"]
  },
  {
    key: "ortho",
    title: "骨科术后",
    earlyStage: "早期控制油腻，保证充足水分。",
    midStage: "中期增加蛋白质与钙来源，促进组织修复。",
    lateStage: "恢复期保持体重管理与规律饮食。",
    cookingMethods: ["炖", "煮", "蒸"],
    avoid: ["酒精", "高盐", "高糖饮料"],
    generalTips: ["配合康复训练节奏调整进食", "优先自然食材"]
  },
  {
    key: "digestive",
    title: "消化道术后",
    earlyStage: "从流质/半流质过渡，避免粗纤维和过量。",
    midStage: "少量多餐，逐步增加软饭和熟菜。",
    lateStage: "恢复期仍建议低刺激，避免暴饮暴食。",
    cookingMethods: ["煮", "炖", "焖"],
    avoid: ["辛辣", "生冷", "油炸", "豆类胀气食物"],
    generalTips: ["观察腹胀反应", "餐后适度活动", "遵医嘱调整进食进度"]
  },
  {
    key: "ent",
    title: "耳鼻喉/咽喉相关术后",
    earlyStage: "以温凉软食为主，避免粗硬和热烫。",
    midStage: "逐步加入细软蛋白来源，减少吞咽刺激。",
    lateStage: "恢复后仍避免短期重辣重烫。",
    cookingMethods: ["蒸", "煮", "打泥"],
    avoid: ["坚硬", "辛辣", "过烫", "酒精"],
    generalTips: ["关注吞咽感受", "适当增加温水摄入"]
  },
  {
    key: "general",
    title: "普外术后",
    earlyStage: "术后初期清淡易消化。",
    midStage: "逐步补充蛋白与维生素。",
    lateStage: "建立规律饮食与作息。",
    cookingMethods: ["蒸", "煮", "炖"],
    avoid: ["辛辣", "酒精", "过油"],
    generalTips: ["每次少量", "避免刺激", "遵医嘱优先"]
  },
  {
    key: "other",
    title: "其他术后",
    earlyStage: "优先温和、软烂、低刺激饮食。",
    midStage: "根据食欲逐步过渡到均衡饮食。",
    lateStage: "保持规律饮食并持续观察个体反应。",
    cookingMethods: ["蒸", "煮", "炖", "温热"],
    avoid: ["辛辣", "酒精", "过烫", "过硬"],
    generalTips: ["以医嘱为准", "出现不适及时就医"]
  }
];

function matchRule(category?: string, surgeryFinal?: string) {
  const text = `${category || ""} ${surgeryFinal || ""}`;
  if (text.includes("甲状腺") || text.includes("内分泌")) return RULES.find((r) => r.key === "thyroid");
  if (text.includes("骨")) return RULES.find((r) => r.key === "ortho");
  if (text.includes("消化") || text.includes("胃") || text.includes("肠")) return RULES.find((r) => r.key === "digestive");
  if (text.includes("耳鼻喉") || text.includes("喉") || text.includes("咽")) return RULES.find((r) => r.key === "ent");
  if (text.includes("普外") || text.includes("阑尾") || text.includes("疝")) return RULES.find((r) => r.key === "general");
  return RULES.find((r) => r.key === "other");
}

export function getRecoveryRule(category?: string, surgeryFinal?: string): RecoveryRule {
  return matchRule(category, surgeryFinal) || RULES[RULES.length - 1];
}

export function getRecoveryStage(postOpDay?: number) {
  const day = postOpDay || 7;
  if (day <= 3) return "术后早期";
  if (day <= 14) return "术后中期";
  return "恢复期";
}

export function buildRuleSummary(category?: string, surgeryFinal?: string, postOpDay?: number) {
  const rule = getRecoveryRule(category, surgeryFinal);
  const stage = getRecoveryStage(postOpDay);
  const stageSuggestion =
    stage === "术后早期" ? rule.earlyStage : stage === "术后中期" ? rule.midStage : rule.lateStage;

  return {
    rule,
    stage,
    stageSuggestion,
    prompt: `【术后饮食边界】类型：${rule.title}；阶段：${stage}；建议：${stageSuggestion}；推荐烹饪：${rule.cookingMethods.join("/")}；避免：${rule.avoid.join("/")}；通用提示：${rule.generalTips.join("/")}`
  };
}
