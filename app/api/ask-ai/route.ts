import { NextResponse } from "next/server";
import { askAIJson, isAIConfigured } from "@/src/lib/aiClient";
import { DISCLAIMER } from "@/src/lib/constants";
import { buildFallbackAskAnswer } from "@/src/lib/mockData";
import { buildRuleSummary } from "@/src/lib/recoveryRules";
import type { MealPlan, Profile, TodayState } from "@/src/lib/types";

interface AskBody {
  question?: string;
  profile?: Profile;
  todayState?: TodayState;
  currentMealPlan?: MealPlan;
  chatHistory?: Array<{ role: string; content: string }>;
  context?: Record<string, unknown>;
  mode?:
    | "meal-qa"
    | "exercise"
    | "journal-summary"
    | "emotion-summary"
    | "checkin-summary"
    | "family-encourage"
    | "general";
}

function normalizeMode(mode?: AskBody["mode"]) {
  if (mode === "emotion-summary" || mode === "checkin-summary") {
    return "journal-summary";
  }
  return mode || "general";
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AskBody;
    const question = (body.question || "").trim();
    const mode = normalizeMode(body.mode);

    if (!question) {
      return NextResponse.json({ ok: false, error: "问题不能为空" }, { status: 400 });
    }

    const profile = body.profile;
    const summary = buildRuleSummary(profile?.surgeryCategory, profile?.surgeryDisplayName || profile?.surgeryFinal, profile?.postOpDay);

    if (!isAIConfigured()) {
      const fallback = buildFallbackAskAnswer(question, mode);
      return NextResponse.json({
        ok: true,
        source: "mock",
        answer: fallback.answer,
        suggestions: fallback.suggestions,
        disclaimer: DISCLAIMER
      });
    }

    const systemPrompt =
      "你是愈后食光 HealMeal 的AI助手。你只能提供术后饮食、康复记录和家属协作建议，不能提供诊断与治疗方案。" +
      "\n你必须在回答中保持谨慎，强调仅供参考、不替代医生建议。" +
      `\n用户画像：昵称=${profile?.nickname || "未设置"}，手术=${profile?.surgeryDisplayName || profile?.surgeryFinal || "未设置"}，术后天数=${profile?.postOpDay || "未知"}，忌口=${(profile?.longTermAvoidFoods || profile?.avoidFoods || []).join("/") || "无"}。` +
      `\n术后边界：${summary.prompt}` +
      `\n当前模式：${mode}` +
      "\n输出JSON：{answer: string, suggestions: string[]}";

    const userPrompt = JSON.stringify(
      {
        question,
        mode,
        todayState: body.todayState,
        context: body.context,
        currentMealPlanSummary: body.currentMealPlan?.basisSummary,
        chatHistory: body.chatHistory?.slice(-8)
      },
      null,
      2
    );

    const ai = await askAIJson<{ answer?: string; suggestions?: string[] }>(systemPrompt, userPrompt);

    const answer = ai.answer || "建议以清淡、易消化饮食为主，并结合医生意见调整。";

    return NextResponse.json({
      ok: true,
      source: "ai",
      answer,
      suggestions: Array.isArray(ai.suggestions) ? ai.suggestions : [],
      disclaimer: DISCLAIMER
    });
  } catch {
    const fallback = buildFallbackAskAnswer("", "general");
    return NextResponse.json({
      ok: true,
      source: "mock",
      answer: fallback.answer,
      suggestions: fallback.suggestions,
      disclaimer: DISCLAIMER
    });
  }
}
