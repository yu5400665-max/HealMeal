"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import AppContainer from "@/components/AppContainer";
import Card from "@/components/Card";
import PageTitle from "@/components/PageTitle";
import { useI18n } from "@/src/lib/i18n";
import { getDailyCheckin } from "@/src/lib/storage";
import type { DailyCheckin } from "@/src/lib/types";

export default function CheckinHistoryDetailPage() {
  const { t } = useI18n();
  const params = useParams<{ date: string }>();
  const date = decodeURIComponent(params?.date || "");
  const [entry, setEntry] = useState<DailyCheckin | null>(null);

  useEffect(() => {
    if (!date) return;
    setEntry(getDailyCheckin(date));
  }, [date]);

  return (
    <AppContainer>
      <PageTitle title={t("checkin.historyDetailTitle")} showBack center />

      {!entry ? (
        <Card>
          <p className="text-[14px] text-[#7A8792]">{t("checkin.historyDetailEmpty")}</p>
        </Card>
      ) : (
        <div className="space-y-3 pb-6">
          <Card>
            <div className="flex items-center justify-between">
              <p className="text-[16px] font-semibold text-[#2C3E50]">{entry.date}</p>
              <p className="text-[12px] text-[#7A8792]">{entry.mood || "🙂"}</p>
            </div>
            <p className="mt-2 text-[13px] text-[#7A8792]">
              {entry.notePrivacy === "public"
                ? t("checkin.publicToEco")
                : entry.notePrivacy === "family"
                  ? t("checkin.familyOnly")
                  : t("checkin.privateOnly")}
            </p>
          </Card>

          <Card>
            <p className="text-[15px] font-semibold text-[#2C3E50]">{t("checkin.historyDataTitle")}</p>
            <div className="mt-2 space-y-2 text-[14px] text-[#5E768B]">
              <p>{t("checkin.historyMeal", { value: entry.mealDoneMeals?.length || 0 })}</p>
              <p>{t("checkin.historyExercise", { value: entry.exerciseMinutes || 0, goal: entry.exerciseGoalMinutes || 30 })}</p>
              <p>{t("checkin.historyWater", { value: entry.waterMl || 0, goal: entry.waterGoalMl || 1500 })}</p>
            </div>
          </Card>

          <Card>
            <p className="text-[15px] font-semibold text-[#2C3E50]">{t("checkin.historyNoteTitle")}</p>
            <p className="mt-2 whitespace-pre-line text-[14px] leading-7 text-[#5E768B]">{entry.notes?.trim() || t("checkin.pendingNote")}</p>
          </Card>
        </div>
      )}
    </AppContainer>
  );
}
