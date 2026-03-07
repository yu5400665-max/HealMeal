"use client";

import { useRouter } from "next/navigation";

interface PageTitleProps {
  title: string;
  subtitle?: string;
  center?: boolean;
  showBack?: boolean;
}

export default function PageTitle({ title, subtitle, center = false, showBack = false }: PageTitleProps) {
  const router = useRouter();

  return (
    <header className={`mb-4 ${center ? "text-center" : ""}`}>
      <div className="relative flex items-center justify-center">
        {showBack ? (
          <button
            type="button"
            onClick={() => router.back()}
            className="absolute left-0 rounded-full p-1 text-slate-500"
            aria-label="返回"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M15 5L8 12L15 19" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : null}
        <h1 className="text-[22px] font-semibold leading-none text-[#2C3E50]">{title}</h1>
      </div>
      {subtitle ? <p className="mt-2 text-sm text-[#636E72]">{subtitle}</p> : null}
    </header>
  );
}
