"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppContainer from "@/components/AppContainer";
import Card from "@/components/Card";
import PageTitle from "@/components/PageTitle";
import { useI18n } from "@/src/lib/i18n";
import { getAllCheckins } from "@/src/lib/storage";
import type { DailyCheckin } from "@/src/lib/types";

function sortByDateDesc(list: DailyCheckin[]) {
  return [...list].sort((a, b) => (a.date > b.date ? -1 : 1));
}

export default function CheckinHistoryPage() {
  const { t } = useI18n();
  const [entries, setEntries] = useState<DailyCheckin[]>([]);
  const [privateOnly, setPrivateOnly] = useState(true);

  useEffect(() => {
    const all = Object.values(getAllCheckins() || {});
    setEntries(sortByDateDesc(all));
  }, []);

  const filtered = useMemo(
    () => (privateOnly ? entries.filter((item) => (item.notePrivacy || "private") === "private") : entries),
    [entries, privateOnly]
  );

  return (
    <AppContainer>
      <PageTitle title={t("checkin.historyTitle")} showBack center />

      <Card>
        <div className="flex items-center justify-between">
          <p className="text-[16px] font-semibold text-[#2C3E50]">{t("checkin.historyFilterTitle")}</p>
          <button
            type="button"
            onClick={() => setPrivateOnly((prev) => !prev)}
            className={`rounded-full px-3 py-1 text-[12px] ${privateOnly ? "bg-[#8AB4F8] text-white" : "bg-[#EEF4FF] text-[#636E72]"}`}
          >
            {privateOnly ? t("checkin.filterPrivateOnly") : t("checkin.filterAll")}
          </button>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="mt-3">
          <p className="text-[14px] text-[#7A8792]">{t("checkin.historyEmpty")}</p>
        </Card>
      ) : (
        <div className="mt-3 space-y-3 pb-6">
          {filtered.map((item) => {
            const summary = item.notes?.trim() || item.noteSummary || t("checkin.pendingNote");
            return (
              <Link key={item.date} href={`/checkin/history/${item.date}`}>
                <Card>
                  <div className="flex items-center justify-between">
                    <p className="text-[15px] font-semibold text-[#2C3E50]">{item.date}</p>
                    <p className="text-[12px] text-[#7A8792]">{item.mood || "🙂"}</p>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-[#5E768B]">{summary}</p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[12px] text-[#7A8792]">
                    <span>{t("checkin.historyMeal", { value: item.mealDoneMeals?.length || 0 })}</span>
                    <span>{t("checkin.historyExercise", { value: item.exerciseMinutes || 0, goal: item.exerciseGoalMinutes || 30 })}</span>
                    <span>{t("checkin.historyWater", { value: item.waterMl || 0, goal: item.waterGoalMl || 1500 })}</span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </AppContainer>
  );
}
