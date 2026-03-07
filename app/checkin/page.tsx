"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import AppContainer from "@/components/AppContainer";
import Card from "@/components/Card";
import PageTitle from "@/components/PageTitle";
import { useSpeechToText } from "@/src/hooks/useSpeechToText";
import { MOOD_OPTIONS } from "@/src/lib/constants";
import { getTodayDate } from "@/src/lib/date";
import { useI18n } from "@/src/lib/i18n";
import {
  getCheckinPreferences,
  getDailyCheckin,
  getDailyMealPlan,
  getProfile,
  setCheckinPreferences,
  setDailyCheckin,
  setPendingPublishDraft
} from "@/src/lib/storage";
import type { DailyCheckin, MealPlan, Profile } from "@/src/lib/types";

type PlatformKey = "douyin" | "xiaohongshu" | "bilibili";

const MEAL_ORDER: Array<"早餐" | "午餐" | "晚餐" | "加餐"> = ["早餐", "午餐", "晚餐", "加餐"];
const MEAL_WEIGHTS: Record<(typeof MEAL_ORDER)[number], number> = { 早餐: 25, 午餐: 30, 晚餐: 30, 加餐: 15 };
const EXERCISE_TYPES = ["散步", "拉伸", "瑜伽", "八段锦", "康复操", "帕梅拉"];
const FOLLOW_TRAININGS = ["八段锦 跟练", "拉伸 跟练", "瑜伽 跟练", "帕梅拉 跟练"];
const EXERCISE_QUOTES = [
  "慢一点也很好，坚持就有力量。",
  "你每动一分钟，身体都在感谢你。",
  "今天动一动，明天会更轻松。",
  "不用拼强度，稳稳做完就是进步。"
];

function extractDoneMeals(plan: MealPlan | null) {
  if (!plan) return [] as Array<(typeof MEAL_ORDER)[number]>;
  return MEAL_ORDER.filter((mealType) => plan.meals.some((dish) => dish.mealType === mealType && dish.completed));
}

function computeMealCompletion(doneMeals: Array<(typeof MEAL_ORDER)[number]>) {
  return doneMeals.reduce((score, mealType) => score + (MEAL_WEIGHTS[mealType] || 0), 0);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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

function buildFamilyText(params: { nickname?: string; mealDone: number; exerciseMinutes: number; exerciseGoal: number; waterMl: number; waterGoal: number; mood: string; notes: string }) {
  const { nickname, mealDone, exerciseMinutes, exerciseGoal, waterMl, waterGoal, mood, notes } = params;
  const lead = nickname ? `${nickname}今天已完成打卡。` : "我今天已完成打卡。";
  const noteText = notes.trim() || "今天状态平稳，正在按节奏恢复。";
  return `${lead}\n饮食进度：${mealDone}/4\n运动：${exerciseMinutes}/${exerciseGoal} 分钟\n饮水：${waterMl}/${waterGoal} ml\n心情：${mood}\n\n${noteText}\n\n请放心，我在稳稳变好中。`;
}

export default function CheckinPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mealDoneMeals, setMealDoneMeals] = useState<Array<(typeof MEAL_ORDER)[number]>>([]);

  const [exerciseType, setExerciseType] = useState(EXERCISE_TYPES[0]);
  const [exerciseMinutes, setExerciseMinutes] = useState(20);
  const [exerciseGoalMinutes, setExerciseGoalMinutes] = useState(30);
  const [exerciseQuote, setExerciseQuote] = useState("");

  const [waterMl, setWaterMl] = useState(600);
  const [waterGoalMl, setWaterGoalMl] = useState(1500);

  const [mood, setMood] = useState("🙂");
  const [notes, setNotes] = useState("");
  const [notePrivacy, setNotePrivacy] = useState<"public" | "private" | "family">("private");
  const [familyShareDraft, setFamilyShareDraft] = useState("");

  const [followModalOpen, setFollowModalOpen] = useState(false);
  const [followKeyword, setFollowKeyword] = useState("");
  const [statusText, setStatusText] = useState("");
  const [recordToast, setRecordToast] = useState("");
  const speechBaseRef = useRef("");
  const toastTimerRef = useRef<number | null>(null);
  const speech = useSpeechToText("zh-CN");

  useEffect(() => {
    const p = getProfile();
    const cachedPlan = getDailyMealPlan();
    const today = getDailyCheckin();
    const prefs = getCheckinPreferences();
    const doneFromPlan = extractDoneMeals(cachedPlan);

    setProfile(p);
    setMealDoneMeals(doneFromPlan.length > 0 || cachedPlan ? doneFromPlan : (today?.mealDoneMeals as Array<(typeof MEAL_ORDER)[number]>) || []);

    setExerciseType(today?.exerciseType || EXERCISE_TYPES[0]);
    setExerciseMinutes(today?.exerciseMinutes || 20);
    setExerciseGoalMinutes(today?.exerciseGoalMinutes || prefs.exerciseGoalMinutes);
    setWaterMl(today?.waterMl || 600);
    setWaterGoalMl(today?.waterGoalMl || prefs.waterGoalMl);
    setMood(today?.mood || "🙂");
    setNotes(today?.notes || "");
    setNotePrivacy(today?.notePrivacy || "private");
    setFamilyShareDraft(today?.familyShareDraft || "");
    setExerciseQuote(EXERCISE_QUOTES[Math.floor(Math.random() * EXERCISE_QUOTES.length)]);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const refreshPlan = () => {
      const latestPlan = getDailyMealPlan();
      if (latestPlan) {
        setMealDoneMeals(extractDoneMeals(latestPlan));
      }
    };

    const timer = window.setInterval(refreshPlan, 3000);
    window.addEventListener("focus", refreshPlan);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshPlan);
    };
  }, []);

  useEffect(() => {
    if (!speech.isListening || !speech.transcript) return;
    const merged = `${speechBaseRef.current}${speechBaseRef.current ? "\n" : ""}${speech.transcript}`.trim();
    setNotes(merged);
  }, [speech.isListening, speech.transcript]);

  const mealCompletion = useMemo(() => computeMealCompletion(mealDoneMeals), [mealDoneMeals]);
  const mealDoneCount = mealDoneMeals.length;
  const mealProgress = clamp(mealDoneCount / MEAL_ORDER.length, 0, 1);
  const exerciseProgress = clamp(exerciseMinutes / Math.max(1, exerciseGoalMinutes), 0, 1);
  const waterProgress = clamp(waterMl / Math.max(1, waterGoalMl), 0, 1);

  const ringSize = 128;
  const ringStroke = 10;
  const ringRadius = (ringSize - ringStroke) / 2;
  const ringLength = 2 * Math.PI * ringRadius;
  const ringOffset = ringLength * (1 - exerciseProgress);

  const cupCapacity = Math.max(1800, Math.ceil(waterGoalMl * 1.2));
  const cupFillHeight = clamp((waterMl / cupCapacity) * 100, 0, 100);
  const cupGoalLine = clamp((waterGoalMl / cupCapacity) * 100, 0, 100);

  const buildEntry = (extraDraft = ""): DailyCheckin => {
    const now = new Date().toISOString();
    const summary = notes.trim() || t("checkin.pendingNote");
    return {
      date: getTodayDate(),
      mealCompletion,
      mealCompletionAuto: mealCompletion,
      mealDoneMeals,
      exerciseType,
      exerciseMinutes,
      exerciseGoalMinutes,
      exerciseCompleted: exerciseProgress >= 1,
      waterMl,
      waterGoalMl,
      waterCompleted: waterProgress >= 1,
      mood,
      notes,
      noteSummary: summary,
      notePrivacy,
      aiSummary: summary,
      familyShareDraft: extraDraft,
      createdAt: now,
      updatedAt: now
    };
  };

  const saveToday = () => {
    const familyText =
      notePrivacy === "family"
        ? buildFamilyText({
            nickname: profile?.nickname,
            mealDone: mealDoneCount,
            exerciseMinutes,
            exerciseGoal: exerciseGoalMinutes,
            waterMl,
            waterGoal: waterGoalMl,
            mood,
            notes
          })
        : "";

    setDailyCheckin(buildEntry(familyText));

    if (notePrivacy === "public") {
      const content = `今日打卡\n饮食：${mealDoneCount}/4\n运动：${exerciseMinutes}/${exerciseGoalMinutes} 分钟（${exerciseType}）\n饮水：${waterMl}/${waterGoalMl} ml\n心情：${mood}\n感想：${notes.trim() || "今天稳稳变好中。"}\n`;
      setPendingPublishDraft({
        title: "今日状态记录",
        content,
        tags: ["打卡", "今日状态"],
        source: "checkin",
        createdAt: new Date().toISOString()
      });
      setStatusText(t("checkin.savedPublicDraft"));
      router.push("/logs/publish?from=checkin");
      return;
    }

    if (notePrivacy === "family") {
      setFamilyShareDraft(familyText);
      setStatusText(t("checkin.savedFamily"));
      return;
    }

    setFamilyShareDraft("");
    setStatusText(t("checkin.savedPrivate"));
  };

  const saveExercise = () => {
    setDailyCheckin(buildEntry(familyShareDraft));
    setCheckinPreferences({ exerciseGoalMinutes, waterGoalMl });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setRecordToast(t("checkin.recordedToast"));
    toastTimerRef.current = window.setTimeout(() => setRecordToast(""), 3000);
  };

  const saveWater = () => {
    setDailyCheckin(buildEntry(familyShareDraft));
    setCheckinPreferences({ exerciseGoalMinutes, waterGoalMl });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setRecordToast(t("checkin.recordedToast"));
    toastTimerRef.current = window.setTimeout(() => setRecordToast(""), 3000);
  };

  const openFollowPlatform = async (platform: PlatformKey) => {
    const keyword = followKeyword.trim();
    if (!keyword) return;

    const copied = await safeCopy(keyword);
    const encoded = encodeURIComponent(keyword);
    const links: Record<PlatformKey, string> = {
      douyin: `https://www.douyin.com/search/${encoded}`,
      xiaohongshu: `https://www.xiaohongshu.com/search_result?keyword=${encoded}`,
      bilibili: `https://search.bilibili.com/all?keyword=${encoded}`
    };
    const opened = window.open(links[platform], "_blank", "noopener,noreferrer");
    setFollowModalOpen(false);
    if (!opened) {
      setStatusText(copied ? t("checkin.searchCopiedFallback") : t("checkin.searchFallback"));
      return;
    }
    setStatusText(copied ? t("checkin.searchCopied") : t("checkin.searchOpened"));
  };

  const copyFamilyDraft = async () => {
    if (!familyShareDraft) return;
    const ok = await safeCopy(familyShareDraft);
    setStatusText(ok ? t("checkin.copied") : t("checkin.copyFailed"));
  };

  const shareFamilyDraft = async () => {
    if (!familyShareDraft) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: t("checkin.familyShareTitle"), text: familyShareDraft });
        setStatusText(t("checkin.shared"));
        return;
      } catch {
        // fallback to copy
      }
    }
    const copied = await safeCopy(familyShareDraft);
    setStatusText(copied ? t("checkin.copied") : t("checkin.copyFailed"));
  };

  const moodLabels = useMemo(
    () => ({
      "😄": t("checkin.moodGreat"),
      "🙂": t("checkin.moodGood"),
      "😐": t("checkin.moodOkay"),
      "😣": t("checkin.moodTired"),
      "😔": t("checkin.moodLow")
    }),
    [t]
  );

  return (
    <AppContainer>
      <PageTitle title={t("checkin.title")} center />

      <Card>
        <div className="flex items-center justify-between">
          <p className="text-[18px] font-semibold text-[#2C3E50]">{t("checkin.mealRailTitle")}</p>
          <p className="text-[15px] font-semibold text-[#8AB4F8]">{mealCompletion}%</p>
        </div>
        <div className="relative mt-4">
          <div className="absolute left-[24px] right-[24px] top-3 h-1 rounded-full bg-[#EAF2FF]" />
          <div className="absolute left-[24px] top-3 h-1 rounded-full bg-gradient-to-r from-[#8AB4F8] to-[#B5EAD7]" style={{ width: `${mealProgress * 100}%` }} />
          <div className="grid grid-cols-4 gap-2">
            {MEAL_ORDER.map((mealType, index) => {
              const done = mealDoneMeals.includes(mealType);
              return (
                <div key={mealType} className="text-center">
                  <div className="relative mx-auto mb-2 flex h-6 w-6 items-center justify-center rounded-full">
                    <span className={`h-4 w-4 rounded-full ${done ? "bg-[#8AB4F8]" : "bg-[#D8E3F1]"}`} />
                    {index === mealDoneCount && mealDoneCount < MEAL_ORDER.length ? (
                      <span className="absolute -top-5 text-[12px] animate-soft-pop">🚩</span>
                    ) : null}
                  </div>
                  <p className="text-[13px] text-[#636E72]">{t(`checkin.${mealType}`)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <Card className="mt-4">
        <p className="text-[18px] font-semibold text-[#2C3E50]">{t("checkin.exerciseRingTitle")}</p>
        <div className="mt-3 flex snap-x gap-2 overflow-x-auto pb-1">
          {EXERCISE_TYPES.map((item) => {
            const selected = exerciseType === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setExerciseType(item)}
                className={`snap-center rounded-full px-3 py-2 text-[13px] transition-transform ${
                  selected ? "scale-105 bg-[#8AB4F8] text-white" : "scale-95 bg-[#EEF4FF] text-[#636E72]"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>

        <div className="mt-3 grid grid-cols-[136px_1fr] items-center gap-3">
          <div className="relative">
            <svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
              <circle cx={ringSize / 2} cy={ringSize / 2} r={ringRadius} stroke="#EAF2FF" strokeWidth={ringStroke} fill="none" />
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={ringRadius}
                stroke="#8AB4F8"
                strokeWidth={ringStroke}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${ringLength} ${ringLength}`}
                strokeDashoffset={ringOffset}
                transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-[22px] font-semibold text-[#2C3E50]">{exerciseMinutes}</p>
              <p className="text-[11px] text-[#7A8792]">/{exerciseGoalMinutes} min</p>
            </div>
          </div>
          <div>
            <p className="text-[16px] leading-7 text-[#5E768B]">{exerciseQuote}</p>
            <p className="mt-2 text-[11px] text-[#7A8792]">{t("checkin.exerciseGoalHint")}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-2xl bg-[#F4F8FF] px-3 py-2">
          <button type="button" className="h-8 w-8 rounded-full bg-white text-[18px] text-[#6D7F93]" onClick={() => setExerciseMinutes((prev) => clamp(prev - 5, 0, 180))}>
            -
          </button>
          <p className="text-[14px] font-semibold text-[#2C3E50]">{t("checkin.exerciseToday", { value: exerciseMinutes })}</p>
          <button type="button" className="h-8 w-8 rounded-full bg-white text-[18px] text-[#6D7F93]" onClick={() => setExerciseMinutes((prev) => clamp(prev + 5, 0, 180))}>
            +
          </button>
        </div>

        <button type="button" onClick={saveExercise} className="mt-2 w-full rounded-full bg-[#EEF4FF] py-2 text-[13px] text-[#636E72]">
          {t("checkin.saveExercise")}
        </button>

        <div className="mt-3 rounded-2xl bg-[#F4F8FF] p-3">
          <p className="text-[13px] text-[#636E72]">{t("checkin.followTrain")}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {FOLLOW_TRAININGS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setFollowKeyword(item);
                  setFollowModalOpen(true);
                }}
                className="rounded-full bg-white px-3 py-2 text-[13px] text-[#5E768B]"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="mt-4">
        <p className="text-[18px] font-semibold text-[#2C3E50]">{t("checkin.waterCupTitle")}</p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="relative mx-2 h-44 w-28 overflow-hidden rounded-b-[28px] rounded-t-[14px] border-[3px] border-[#CFE0F5] bg-white">
            <div
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#8AB4F8] via-[#9AC8EB] to-[#B5EAD7] transition-all"
              style={{ height: `${cupFillHeight}%` }}
            />
            <div className="absolute left-0 right-0 border-t border-dashed border-[#7AA5DF]" style={{ bottom: `${cupGoalLine}%` }} />
          </div>
          <div className="flex-1">
            <p className="text-[25px] font-semibold text-[#2C3E50]">
              {waterMl} / {waterGoalMl} ml
            </p>
            <div className="mt-1 flex items-center gap-2 text-[12px] text-[#7A8792]">
              <span>{t("checkin.waterGoalLineLabel")}</span>
              <input
                type="number"
                min={500}
                step={100}
                value={waterGoalMl}
                onChange={(event) => setWaterGoalMl(Math.max(500, Number(event.target.value || 500)))}
                onBlur={() => setCheckinPreferences({ waterGoalMl, exerciseGoalMinutes })}
                className="h-8 w-20 rounded-lg bg-white px-2 text-right text-[12px] text-[#2C3E50]"
              />
              <span>ml</span>
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => setWaterMl((prev) => prev + 200)} className="rounded-full bg-[#EEF4FF] px-3 py-1.5 text-[12px] text-[#636E72]">
                +200ml
              </button>
              <button type="button" onClick={() => setWaterMl((prev) => prev + 300)} className="rounded-full bg-[#EEF4FF] px-3 py-1.5 text-[12px] text-[#636E72]">
                +300ml
              </button>
            </div>
          </div>
        </div>
        <button type="button" onClick={saveWater} className="mt-3 w-full rounded-full bg-[#8AB4F8] py-2 text-[14px] font-medium text-white">
          {t("checkin.saveWater")}
        </button>
      </Card>

      <Card className="mt-4">
        <div className="flex items-center justify-between">
          <p className="text-[18px] font-semibold text-[#2C3E50]">{t("checkin.stateTitle")}</p>
          <Link href="/checkin/history" className="text-[12px] text-[#8AB4F8]">
            {t("checkin.historyEntry")}
          </Link>
        </div>

        <div className="mt-3 grid grid-cols-5 gap-2">
          {MOOD_OPTIONS.map((item) => {
            const active = mood === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setMood(item)}
                className={`rounded-2xl px-1 py-2 text-center ${active ? "bg-[#F6EEFB]" : "bg-[#F4F8FF]"}`}
              >
                <p className="text-[20px]">{item}</p>
                <p className={`mt-1 text-[11px] ${active ? "text-[#8B7BAA]" : "text-[#7A8792]"}`}>{moodLabels[item as keyof typeof moodLabels]}</p>
              </button>
            );
          })}
        </div>

        <div className="relative mt-3">
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            className="w-full rounded-2xl bg-white px-3 py-2 pr-11 text-[14px]"
            placeholder={t("checkin.statePlaceholder")}
          />
          <button
            type="button"
            onClick={() => {
              if (speech.isListening) {
                speech.stop();
              } else {
                speechBaseRef.current = notes;
                speech.start();
              }
            }}
            className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full ${
              speech.isListening ? "bg-[#EAF2FF] text-[#8AB4F8]" : "bg-[#EEF4FF] text-[#7A8792]"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="4" width="6" height="10" rx="3" />
              <path d="M6 10C6 13.3 8.7 16 12 16C15.3 16 18 13.3 18 10" strokeLinecap="round" />
              <path d="M12 16V20" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {speech.error ? <p className="mt-1 text-[12px] text-[#9A6554]">{speech.error}</p> : null}

        <select
          value={notePrivacy}
          onChange={(event) => setNotePrivacy(event.target.value as "public" | "private" | "family")}
          className="mt-3 w-full rounded-2xl bg-white px-3 py-2 text-[13px] text-[#636E72]"
        >
          <option value="private">{t("checkin.privateOnly")}</option>
          <option value="public">{t("checkin.publicToEco")}</option>
          <option value="family">{t("checkin.familyOnly")}</option>
        </select>

        {familyShareDraft ? (
          <div className="mt-3 rounded-2xl bg-[#F4F8FF] p-3">
            <p className="whitespace-pre-line text-[13px] leading-6 text-[#5E768B]">{familyShareDraft}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => void copyFamilyDraft()} className="rounded-full bg-white py-2 text-[13px] text-[#636E72]">
                {t("checkin.copyText")}
              </button>
              <button type="button" onClick={() => void shareFamilyDraft()} className="rounded-full bg-white py-2 text-[13px] text-[#636E72]">
                {t("checkin.systemShare")}
              </button>
            </div>
          </div>
        ) : null}

        <button type="button" onClick={saveToday} className="mt-3 w-full rounded-full bg-[#8AB4F8] py-2.5 text-[15px] font-medium text-white">
          {t("checkin.saveCheckin")}
        </button>
        {statusText ? <p className="mt-2 text-[12px] text-[#8AB4F8]">{statusText}</p> : null}
      </Card>

      {followModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#6E86A333] px-4">
          <div className="w-full max-w-[360px] rounded-[24px] bg-white p-4 shadow-[0_16px_36px_rgba(0,0,0,0.08)]">
            <div className="flex items-center justify-between">
              <p className="text-[16px] font-semibold text-[#2C3E50]">{t("checkin.followChoosePlatform")}</p>
              <button type="button" onClick={() => setFollowModalOpen(false)} className="text-[13px] text-[#7A8792]">
                {t("common.close")}
              </button>
            </div>
            <p className="mt-1 text-[12px] text-[#7A8792]">{followKeyword}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button type="button" onClick={() => void openFollowPlatform("bilibili")} className="rounded-full bg-[#FB7299] py-2 text-[13px] text-white">
                站
              </button>
              <button type="button" onClick={() => void openFollowPlatform("douyin")} className="rounded-full bg-black py-2 text-[13px] text-white">
                音
              </button>
              <button type="button" onClick={() => void openFollowPlatform("xiaohongshu")} className="rounded-full bg-[#FF4D6D] py-2 text-[13px] text-white">
                书
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {recordToast ? (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-white px-4 py-2 text-[13px] text-[#4F8D74] shadow-[0_10px_24px_rgba(0,0,0,0.12)]">
          <span className="mr-1 text-[#4F8D74]">✓</span>
          {recordToast}
        </div>
      ) : null}
    </AppContainer>
  );
}
