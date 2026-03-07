"use client";

import type { PropsWithChildren } from "react";
import BottomNav from "./BottomNav";
import DisclaimerBanner from "./DisclaimerBanner";
import LanguageSwitcher from "./LanguageSwitcher";
import { I18nProvider } from "@/src/lib/i18n";

interface AppContainerProps extends PropsWithChildren {
  withNav?: boolean;
  showDisclaimer?: boolean;
}

export default function AppContainer({ children, withNav = true, showDisclaimer = true }: AppContainerProps) {
  return (
    <I18nProvider>
      <div className="pastel-app relative mx-auto min-h-screen w-full max-w-[430px] overflow-hidden bg-[#E5F3FE] pb-28">
        <span className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-[#EAF2FF]/65 blur-3xl" />
        <span className="pointer-events-none absolute -left-16 top-1/3 h-40 w-40 rounded-full bg-[#FFF4EC]/70 blur-3xl" />
        <div className="relative z-10 flex justify-end px-4 pt-4">
          <LanguageSwitcher />
        </div>
        <main className="relative z-10 px-4 pt-3">{children}</main>
        {showDisclaimer ? (
          <div className="relative z-10 mt-4 px-4 pb-4">
            <DisclaimerBanner />
          </div>
        ) : null}
        {withNav ? <BottomNav /> : null}
      </div>
    </I18nProvider>
  );
}
