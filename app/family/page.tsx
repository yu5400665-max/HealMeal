"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppContainer from "@/components/AppContainer";
import Card from "@/components/Card";
import PageTitle from "@/components/PageTitle";
import { useI18n } from "@/src/lib/i18n";
import {
  addFamilyTask,
  getCheckinPreferences,
  getDailyCheckin,
  getDailyMealPlan,
  getFamilyTasksWindow,
  getProfile,
  removeFamilyTask,
  updateFamilyTask
} from "@/src/lib/storage";
import type { DailyCheckin, FamilyTask, MealPlan, Profile } from "@/src/lib/types";

const REMINDER_PRESETS = ["吃药提醒", "复诊/随访", "测血压/血糖", "伤口护理/换药", "体重记录", "轻运动/散步", "睡眠提醒"];

const GROCERY_ENTRIES = [
  { key: "eleme", title: "饿了么", badge: "饿", h5: "https://h5.ele.me/", scheme: "eleme://home" },
  { key: "taobao", title: "淘宝闪购", badge: "淘", h5: "https://main.m.taobao.com/", scheme: "taobao://" },
  { key: "hema", title: "盒马", badge: "盒", h5: "https://hema.taobao.com/", scheme: "hema://" },
  { key: "meituan", title: "美团买菜", badge: "美", h5: "https://h5.meituan.com/", scheme: "imeituan://www.meituan.com" },
  { key: "jd", title: "京东到家", badge: "京", h5: "https://daojia.jd.com/", scheme: "openapp.jdmobile://virtual" },
  { key: "dingdong", title: "叮咚买菜", badge: "叮", h5: "https://m.ddxq.mobi/", scheme: "" }
];

export default function MyPage() {
  const { t } = useI18n();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [checkin, setCheckin] = useState<DailyCheckin | null>(null);
  const [tasks, setTasks] = useState<FamilyTask[]>([]);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDate, setTaskDate] = useState(new Date().toISOString().slice(0, 10));
  const [taskTime, setTaskTime] = useState("");
  const [taskNote, setTaskNote] = useState("");
  const [statusText, setStatusText] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    setProfile(getProfile());
    setPlan(getDailyMealPlan());
    setCheckin(getDailyCheckin());
    setTasks(getFamilyTasksWindow(today, 7));
  }, [today]);

  const progress = useMemo(() => {
    const doneMeals = new Set((plan?.meals || []).filter((dish) => dish.completed).map((dish) => dish.mealType)).size;
    const prefs = getCheckinPreferences();
    const exerciseMinutes = checkin?.exerciseMinutes || 0;
    const exerciseGoal = checkin?.exerciseGoalMinutes || prefs.exerciseGoalMinutes;
    const waterMl = checkin?.waterMl || 0;
    const waterGoal = checkin?.waterGoalMl || prefs.waterGoalMl;
    return {
      meal: `${doneMeals}/4`,
      exercise: `${exerciseMinutes}/${exerciseGoal}min`,
      water: `${waterMl}/${waterGoal}ml`
    };
  }, [plan, checkin]);

  const addReminder = () => {
    if (!taskTitle.trim()) {
      setStatusText(t("family.reminderNeedTitle"));
      return;
    }
    addFamilyTask({
      date: taskDate || today,
      title: taskTitle.trim(),
      time: taskTime || undefined,
      note: taskNote.trim() || undefined,
      assignee: profile?.nickname || "我",
      remind: true,
      completed: false
    });
    setTaskTitle("");
    setTaskTime("");
    setTaskNote("");
    setStatusText(t("family.reminderAdded"));
    setTasks(getFamilyTasksWindow(today, 7));
  };

  const toggleTask = (task: FamilyTask) => {
    updateFamilyTask(task.date, task.id, { completed: !task.completed });
    setTasks(getFamilyTasksWindow(today, 7));
  };

  const deleteTask = (task: FamilyTask) => {
    removeFamilyTask(task.date, task.id);
    setTasks(getFamilyTasksWindow(today, 7));
  };

  const openGroceryLink = (entry: (typeof GROCERY_ENTRIES)[number]) => {
    if (typeof window === "undefined") return;
    const proceed = window.confirm(t("family.thirdPartyConfirm"));
    if (!proceed) return;

    const ua = navigator.userAgent.toLowerCase();
    const inWechat = ua.includes("micromessenger");
    if (inWechat || !entry.scheme) {
      window.open(entry.h5, "_blank", "noopener,noreferrer");
      return;
    }

    const start = Date.now();
    window.location.href = entry.scheme;
    window.setTimeout(() => {
      if (Date.now() - start < 1600) {
        window.open(entry.h5, "_blank", "noopener,noreferrer");
      }
    }, 850);
  };

  return (
    <AppContainer>
      <PageTitle title={t("family.title")} center />

      <Card>
        <div className="flex items-center justify-between">
          <p className="text-[16px] font-semibold text-[#2C3E50]">{t("family.progressTitle")}</p>
          <Link href="/checkin" className="rounded-full bg-[#8AB4F8] px-3 py-1 text-[12px] text-white">
            {t("family.goCheckin")}
          </Link>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-[#F4F8FF] p-2 text-center">
            <p className="text-[12px] text-[#7A8792]">{t("family.progressMeal")}</p>
            <p className="mt-1 text-[14px] font-semibold text-[#2C3E50]">{progress.meal}</p>
          </div>
          <div className="rounded-2xl bg-[#F4F8FF] p-2 text-center">
            <p className="text-[12px] text-[#7A8792]">{t("family.progressExercise")}</p>
            <p className="mt-1 text-[14px] font-semibold text-[#2C3E50]">{progress.exercise}</p>
          </div>
          <div className="rounded-2xl bg-[#F4F8FF] p-2 text-center">
            <p className="text-[12px] text-[#7A8792]">{t("family.progressWater")}</p>
            <p className="mt-1 text-[14px] font-semibold text-[#2C3E50]">{progress.water}</p>
          </div>
        </div>
      </Card>

      <Card className="mt-4">
        <p className="text-[18px] font-semibold text-[#2C3E50]">{t("family.reminderTitle")}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {REMINDER_PRESETS.map((item) => (
            <button key={item} type="button" onClick={() => setTaskTitle(item)} className="rounded-full bg-[#EEF4FF] px-3 py-1.5 text-[12px] text-[#636E72]">
              {item}
            </button>
          ))}
        </div>

        <div className="mt-3 rounded-2xl bg-[#F4F8FF] p-3">
          <p className="text-[13px] text-[#636E72]">{t("family.customReminder")}</p>
          <input
            value={taskTitle}
            onChange={(event) => setTaskTitle(event.target.value)}
            className="mt-2 h-10 w-full rounded-xl bg-white px-3 text-[14px]"
            placeholder={t("family.reminderTitlePlaceholder")}
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input type="date" value={taskDate} onChange={(event) => setTaskDate(event.target.value)} className="h-10 rounded-xl bg-white px-3 text-[13px]" />
            <input type="time" value={taskTime} onChange={(event) => setTaskTime(event.target.value)} className="h-10 rounded-xl bg-white px-3 text-[13px]" />
          </div>
          <textarea
            value={taskNote}
            onChange={(event) => setTaskNote(event.target.value)}
            rows={2}
            className="mt-2 w-full rounded-xl bg-white px-3 py-2 text-[13px]"
            placeholder={t("family.reminderNotePlaceholder")}
          />
          <button type="button" onClick={addReminder} className="mt-2 w-full rounded-full bg-[#8AB4F8] py-2 text-[13px] text-white">
            {t("family.addReminder")}
          </button>
        </div>

        {tasks.length === 0 ? (
          <p className="mt-3 text-[13px] text-[#7A8792]">{t("family.reminderEmpty")}</p>
        ) : (
          <div className="mt-3 space-y-2">
            {tasks.map((task) => (
              <div key={task.id} className="rounded-2xl bg-[#F4F8FF] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={`text-[14px] ${task.completed ? "text-[#7A8792] line-through" : "text-[#2C3E50]"}`}>{task.title}</p>
                    <p className="mt-1 text-[12px] text-[#7A8792]">
                      {task.date}
                      {task.time ? ` ${task.time}` : ""}
                    </p>
                    {task.note ? <p className="mt-1 text-[12px] text-[#5E768B]">{task.note}</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => toggleTask(task)} className="rounded-full bg-white px-2 py-1 text-[12px] text-[#636E72]">
                      {task.completed ? t("family.undoDone") : t("family.markDone")}
                    </button>
                    <button type="button" onClick={() => deleteTask(task)} className="rounded-full bg-white px-2 py-1 text-[12px] text-[#9A6554]">
                      {t("family.deleteReminder")}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <p className="text-[18px] font-semibold text-[#2C3E50]">{t("family.grocery")}</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {GROCERY_ENTRIES.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => openGroceryLink(entry)}
              className="flex flex-col items-center justify-center rounded-2xl bg-[#F4F8FF] px-2 py-3 text-center"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[16px] text-[#5E768B]">{entry.badge}</span>
              <span className="mt-2 text-[12px] text-[#636E72]">{entry.title}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card className="mt-4">
        <p className="text-[18px] font-semibold text-[#2C3E50]">{t("family.historyToolsTitle")}</p>
        <div className="mt-3 grid gap-2">
          <Link href="/checkin/history" className="rounded-2xl bg-[#F4F8FF] px-3 py-3">
            <p className="text-[14px] font-semibold text-[#2C3E50]">{t("family.diaryEntryTitle")}</p>
            <p className="mt-1 text-[12px] text-[#7A8792]">{t("family.diaryEntryDesc")}</p>
          </Link>
          <Link href="/settings" className="rounded-2xl bg-[#F4F8FF] px-3 py-3">
            <p className="text-[14px] font-semibold text-[#2C3E50]">{t("family.privacyEntryTitle")}</p>
            <p className="mt-1 text-[12px] text-[#7A8792]">{t("family.privacyEntryDesc")}</p>
          </Link>
        </div>
      </Card>

      {statusText ? <p className="mt-3 pb-6 text-[12px] text-[#8AB4F8]">{statusText}</p> : <div className="pb-6" />}
    </AppContainer>
  );
}
