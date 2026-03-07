"use client";

import { DISCLAIMER } from "@/src/lib/constants";
import { SINGLE_MEDICAL_NOTICE } from "@/src/lib/disclaimer";
import { useI18n } from "@/src/lib/i18n";

interface DisclaimerBannerProps {
  className?: string;
}

export default function DisclaimerBanner({ className = "" }: DisclaimerBannerProps) {
  const { locale, t } = useI18n();
  return (
    <details className={`rounded-[20px] bg-[#FFF6F0] p-4 text-[#8F6A49] shadow-[0_4px_12px_rgba(0,0,0,0.03)] ${className}`}>
      <summary className="cursor-pointer list-none text-[13px] font-semibold">{t("common.healthTipTitle")}</summary>
      <div className="mt-2 rounded-2xl bg-white/70 p-3 text-[13px] leading-6">
        <p>{locale === "en" ? t("common.medicalNotice") : SINGLE_MEDICAL_NOTICE}</p>
        <p className="mt-1">{locale === "en" ? t("common.disclaimerFull") : DISCLAIMER}</p>
      </div>
    </details>
  );
}
