"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/src/lib/i18n";

interface NavIconProps {
  type: "home" | "meal" | "check" | "logs" | "family";
}

function NavIcon({ type }: NavIconProps) {
  if (type === "home") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 11.5L12 4L21 11.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 10.8V20H18V10.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (type === "meal") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M7 4V11" strokeLinecap="round" />
        <path d="M10 4V11" strokeLinecap="round" />
        <path d="M7 8H10" strokeLinecap="round" />
        <path d="M8.5 11V20" strokeLinecap="round" />
        <path d="M16 4C18.5 6.5 18.5 11.5 16 14" strokeLinecap="round" />
        <path d="M16 14V20" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === "check") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="5" y="4" width="14" height="16" rx="2" />
        <path d="M9 2.8V6" strokeLinecap="round" />
        <path d="M15 2.8V6" strokeLinecap="round" />
        <path d="M9 12L11 14L15 10" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (type === "logs") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M6 6H10V18H6z" strokeLinejoin="round" />
        <path d="M14 6H18V18H14z" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="9" cy="9" r="3" />
      <circle cx="17" cy="8" r="2.5" />
      <path d="M3.5 19.5C4.5 16.7 7 15 9.8 15C12.6 15 15.1 16.7 16.1 19.5" strokeLinecap="round" />
      <path d="M14.6 19.5C15.1 17.8 16.4 16.6 18 16.2" strokeLinecap="round" />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: "/", labelKey: "nav.home", icon: "home" as const },
  { href: "/meal-plan", labelKey: "nav.meal", icon: "meal" as const },
  { href: "/checkin", labelKey: "nav.checkin", icon: "check" as const },
  { href: "/logs", labelKey: "nav.logs", icon: "logs" as const },
  { href: "/family", labelKey: "nav.family", icon: "family" as const }
];

export default function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav className="fixed bottom-3 left-1/2 z-20 w-[calc(100%-18px)] max-w-[412px] -translate-x-1/2 rounded-2xl bg-white/92 px-2 py-1.5 shadow-[0_8px_16px_rgba(138,180,248,0.22)] backdrop-blur-xl">
      <ul className="grid grid-cols-5 gap-0.5">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex flex-col items-center justify-center rounded-xl px-0.5 py-1.5 transition-colors ${
                  active ? "bg-[#EAF2FF] text-[#8AB4F8]" : "text-[#a0aec0]"
                }`}
              >
                <NavIcon type={item.icon} />
                <span className="mt-0.5 text-[11px] font-medium">{t(item.labelKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
