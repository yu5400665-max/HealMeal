"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AIQuickInputBar from "@/components/AIQuickInputBar";
import AppContainer from "@/components/AppContainer";
import Card from "@/components/Card";
import { useI18n } from "@/src/lib/i18n";
import { APP_NAME, HOME_DAY_STATUS_KEYS, HOME_MOTIVATION_KEYS } from "@/src/lib/constants";
import { streamAIReply } from "@/src/lib/aiStream";
import { computePostOpDay } from "@/src/lib/date";
import { stripMedicalDisclaimer } from "@/src/lib/disclaimer";
import { toFriendlyError } from "@/src/lib/errorText";
import {
  addAiChat,
  getDailyCheckin,
  getDailyMealPlan,
  getMealSettingsDynamic,
  getMotivationHistory,
  getProfile,
  pushMotivationHistory
} from "@/src/lib/storage";
import type { AIAttachment, DailyCheckin, MealPlan, Profile } from "@/src/lib/types";

function pickMotivation() {
  const history = getMotivationHistory();
  const available = HOME_MOTIVATION_KEYS.filter((item) => !history.includes(item));
  const source = available.length > 0 ? available : HOME_MOTIVATION_KEYS;
  const selected = source[Math.floor(Math.random() * source.length)];
  pushMotivationHistory(selected, 7);
  return selected;
}

function detectHomeScenario(question: string): "home" | "meal" | "exercise" | "emotion" | "family" {
  const text = question.trim();
  if (!text) return "home";

  const mealHints = ["能吃", "可以吃", "能不能吃", "吃什么", "餐单", "三餐", "加餐", "饮食", "食材"];
  const exerciseHints = ["运动", "散步", "跑步", "拉伸", "瑜伽", "训练", "锻炼", "时长", "强度"];
  const emotionHints = ["不开心", "焦虑", "难过", "压力", "崩溃", "心情", "情绪", "聊聊", "失眠"];
  const familyHints = ["家属", "家人", "鼓励", "陪护", "照护", "留言", "协助"];

  if (mealHints.some((item) => text.includes(item))) return "meal";
  if (exerciseHints.some((item) => text.includes(item))) return "exercise";
  if (emotionHints.some((item) => text.includes(item))) return "emotion";
  if (familyHints.some((item) => text.includes(item))) return "family";
  return "home";
}

function getGentleTipKey(postOpDay: number, dietStage?: string) {
  if (dietStage === "流食") return "home.smallThingTipLiquid";
  if (dietStage === "软食") return "home.smallThingTipSoft";
  if (postOpDay <= 3) return "home.smallThingTipEarly";
  if (postOpDay <= 14) return "home.smallThingTipWalk";
  return "home.smallThingTipRoutine";
}

function getGreetingKey() {
  const hour = new Date().getHours();
  if (hour < 12) return "home.greetingMorning";
  if (hour < 18) return "home.greetingAfternoon";
  return "home.greetingEvening";
}

export default function HomePage() {
  const { t } = useI18n();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [entryConsentAccepted, setEntryConsentAccepted] = useState(false);
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [checkin, setCheckin] = useState<DailyCheckin | null>(null);
  const [dietStage, setDietStage] = useState("");
  const [motivationKey, setMotivationKey] = useState<(typeof HOME_MOTIVATION_KEYS)[number]>(HOME_MOTIVATION_KEYS[0]);

  const [question, setQuestion] = useState("");
  const [quickAnswer, setQuickAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [quickError, setQuickError] = useState("");
  const [lastQuickPayload, setLastQuickPayload] = useState<{ text: string; attachments: AIAttachment[] } | null>(null);

  useEffect(() => {
    const p = getProfile();
    setProfile(
      p
        ? {
            ...p,
            postOpDay: computePostOpDay(p.surgeryDate) || p.postOpDay
          }
        : null
    );
    setPlan(getDailyMealPlan());
    setCheckin(getDailyCheckin());
    setDietStage(getMealSettingsDynamic().dietStage);
    setMotivationKey(pickMotivation());
  }, []);

  const summary = useMemo(() => {
    const adopted = plan?.meals.filter((dish) => dish.adopted).length || 0;
    const completed = plan?.meals.filter((dish) => dish.completed).length || 0;
    const mealStatus = plan
      ? t("home.mealStatusReady", { adopted, completed })
      : t("home.statusPending");
    const reflectionSource = checkin?.notes?.trim() || checkin?.noteSummary || checkin?.aiSummary || "";
    const reflection = reflectionSource
      ? `${reflectionSource.slice(0, 24)}${reflectionSource.length > 24 ? "..." : ""}`
      : t("home.statusToRecord");
    return {
      mealStatus,
      checkinStatus: checkin ? t("home.statusDone") : t("home.statusPending"),
      mood: checkin?.mood || t("home.statusPending"),
      reflection
    };
  }, [checkin, plan, t]);

  const postOpDay = profile?.postOpDay || 1;
  const gentleTipKey = useMemo(() => getGentleTipKey(postOpDay, dietStage), [dietStage, postOpDay]);
  const motivationText = t(motivationKey).trim() || t("common.loading");
  const smallThingText = t(gentleTipKey).trim() || t("home.statusPending");
  const dayStatusText = t(HOME_DAY_STATUS_KEYS[0]);
  const sectionTitleClassName = "text-[20px] font-semibold text-[#2C3E50]";

  const handleQuickAsk = async (payload?: { text: string; attachments: AIAttachment[] }) => {
    const q = (payload?.text || question).trim();
    if ((!q && (payload?.attachments?.length || 0) === 0) || !profile) return;

    const attachments = payload?.attachments || [];
    setQuickError("");
    setQuickAnswer("");
    setLastQuickPayload({ text: q, attachments });
    setLoading(true);
    try {
      const detectedScenario = detectHomeScenario(q);
      const answer = await streamAIReply(
        {
          scenario: detectedScenario,
          message: q,
          profile,
          speed: "fast",
          context: {
            scene: "home_quick_ask",
            mealStatus: summary.mealStatus,
            checkinStatus: summary.checkinStatus
          },
          attachments
        },
        (text) => setQuickAnswer(stripMedicalDisclaimer(text))
      );

      addAiChat({
        id: `${Date.now()}`,
        mode: "home",
        question: q || t("home.imageQuestionFallback"),
        answer,
        date: new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString()
      });
      setQuestion("");
    } catch (error) {
      console.log("[home_quick_ask] failed", error);
      setQuickError(toFriendlyError(error));
    } finally {
      setLoading(false);
    }
  };

  if (!profile) {
    return (
      <AppContainer>
        <header className="mb-5 pt-1 text-center">
          <h1 className="text-[29px] font-semibold text-[#2C3E50]">
            <span className="mr-1">🧡</span>
            {APP_NAME.replace(" HealMeal", "")}
            <span className="ml-1 text-[#8AB4F8]">HealMeal</span>
          </h1>
          <p className="mt-1 text-[15px] text-[#636E72]">{t("home.slogan")}</p>
        </header>

        <Card className="bg-gradient-to-br from-white via-[#F4F8FF] to-[#FFF4EC]">
          <p className="text-[15px] text-[#636E72]">{t("home.noProfileHint")}</p>
          <p className="mt-2 text-[13px] leading-6 text-[#7A8792]">
            {t("home.noProfilePrivacy")}
          </p>
          <Link href="/privacy" className="mt-2 inline-block text-[13px] text-[#8AB4F8]">
            {t("home.viewPrivacy")}
          </Link>
          <label className="mt-3 flex items-start gap-2 rounded-2xl bg-[#F4F8FF] p-3 text-[13px] text-[#636E72]">
            <input
              type="checkbox"
              checked={entryConsentAccepted}
              onChange={(event) => setEntryConsentAccepted(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#8AB4F8]"
            />
            <span>{t("home.privacyConsentEntry")}</span>
          </label>
          <Link
            href={entryConsentAccepted ? "/onboarding" : "#"}
            onClick={(event) => {
              if (!entryConsentAccepted) event.preventDefault();
            }}
            className={`mt-4 inline-block rounded-full px-5 py-2.5 text-[15px] font-semibold text-white ${
              entryConsentAccepted ? "bg-[#8AB4F8]" : "bg-[#C8DAF4]"
            }`}
          >
            {t("common.goOnboarding")}
          </Link>
        </Card>
      </AppContainer>
    );
  }

  return (
    <AppContainer>
      <header className="mb-4 pt-1 text-center">
        <h1 className="text-[29px] font-semibold text-[#2C3E50]">
          <span className="mr-1">🧡</span>
          {APP_NAME.replace(" HealMeal", "")}
          <span className="ml-1 text-[#8AB4F8]">HealMeal</span>
        </h1>
        <p className="mt-1 text-[15px] text-[#636E72]">{t("home.slogan")}</p>
      </header>

      <Card className="relative overflow-hidden bg-gradient-to-br from-white via-[#F4F8FF] to-[#FFF4EC]">
        <span className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-[#EAF2FF]/75 blur-2xl" />
        <span className="pointer-events-none absolute -left-4 bottom-8 h-14 w-14 rounded-full bg-[#FDEEE6]/70 blur-xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={sectionTitleClassName}>
              {t(getGreetingKey())}，<span className="text-[20px] font-bold text-[#8AB4F8]">{profile.nickname?.toUpperCase()}</span>
            </p>
            <p className="mt-2 text-[14px] leading-6 text-[#5E768B]">{motivationText}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[44px] font-bold leading-none text-[#8AB4F8]">Day {postOpDay}</p>
            <span className="text-[12px] text-[#7A8792]">{dayStatusText}</span>
          </div>
        </div>
      </Card>

      <Card className="mt-4">
        <p className={sectionTitleClassName}>{t("home.aiTitle")}</p>
        <p className="mt-1 text-[13px] text-[#636E72]">{t("home.aiSubline")}</p>
        <AIQuickInputBar
          className="mt-3"
          value={question}
          loading={loading}
          onChange={setQuestion}
          onSend={handleQuickAsk}
          onOpenChat={() => (window.location.href = "/chat")}
          placeholder={t("home.quickPlaceholder")}
        />
        {loading && !quickAnswer ? (
          <div className="mt-3 animate-pulse space-y-2 rounded-2xl bg-[#E6E6FA] p-3">
            <div className="h-3 w-2/3 rounded bg-[#D8C3E6]" />
            <div className="h-3 w-full rounded bg-[#D8C3E6]" />
            <div className="h-3 w-4/5 rounded bg-[#D8C3E6]" />
          </div>
        ) : null}
        {quickAnswer ? (
          <p className="mt-3 rounded-2xl bg-[#E6E6FA] p-3 text-[14px] leading-6 text-[#636E72]">
            {quickAnswer}
          </p>
        ) : null}
        {quickError ? (
          <div className="mt-3 rounded-2xl bg-[#FFF1ED] p-3 text-[13px] text-[#9A6554]">
            <p>{quickError}</p>
            <button
              type="button"
              onClick={() => void handleQuickAsk(lastQuickPayload || undefined)}
              className="mt-2 rounded-full bg-[#FDEEE6] px-3 py-1 text-[12px] text-[#8F6256]"
            >
              {t("common.retry")}
            </button>
          </div>
        ) : null}
      </Card>

      <Card className="mt-4">
        <p className={sectionTitleClassName}>{t("home.todayRecord")}</p>
        <div className="mt-3 rounded-2xl bg-[#F4F8FF] p-3">
          <p className="text-[14px] leading-6 text-[#5E768B]">{smallThingText}</p>
        </div>
        <div className="mt-3 rounded-2xl bg-[#F4F8FF] p-3">
          <p className="text-[13px] text-[#7A8792]">{t("home.statusSummaryTitle")}</p>
          <div className="mt-2 space-y-2 text-[14px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#636E72]">{t("home.mealStatus")}</span>
              <span className="font-semibold text-[#8AB4F8]">{summary.mealStatus}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#636E72]">{t("home.checkinStatus")}</span>
              <span className="font-semibold text-[#8AB4F8]">{summary.checkinStatus}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#636E72]">{t("home.mood")}</span>
              <span className="font-semibold text-[#2C3E50]">{summary.mood}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#636E72]">{t("home.reflection")}</span>
              <span className="max-w-[65%] truncate text-right font-semibold text-[#2C3E50]">{summary.reflection}</span>
            </div>
          </div>
        </div>
        <Link href="/checkin" className="mt-4 block rounded-full bg-[#8AB4F8] py-2.5 text-center text-[14px] font-semibold text-white">
          {checkin ? t("home.startRecord") : t("home.goCheckin")}
        </Link>
      </Card>
    </AppContainer>
  );
}
