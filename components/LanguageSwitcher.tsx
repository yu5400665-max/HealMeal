"use client";

import { useI18n } from "@/src/lib/i18n";

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="inline-flex items-center rounded-full bg-white/90 p-1 text-[12px] shadow-[0_3px_9px_rgba(0,0,0,0.06)]">
      <button
        type="button"
        onClick={() => setLocale("zh")}
        className={`rounded-full px-2.5 py-1 ${locale === "zh" ? "bg-[#EAF2FF] text-[#8AB4F8]" : "text-[#7A8792]"}`}
      >
        🌐 {t("language.zh")}
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={`rounded-full px-2.5 py-1 ${locale === "en" ? "bg-[#EAF2FF] text-[#8AB4F8]" : "text-[#7A8792]"}`}
      >
        {t("language.en")}
      </button>
    </div>
  );
}
