"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { messages, type Locale } from "./messages";

export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";
export const LOCALE_STORAGE_KEY = "NEXT_LOCALE";

type TranslateParams = Record<string, string | number>;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: TranslateParams) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function normalizeLocale(raw?: string | null): Locale {
  return raw === "en" ? "en" : "zh";
}

function readCookieLocale() {
  if (typeof document === "undefined") return null;
  const hit = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${LOCALE_COOKIE_NAME}=`));
  if (!hit) return null;
  const value = hit.split("=")[1];
  return normalizeLocale(value);
}

function readPreferredLocale(): Locale {
  if (typeof window === "undefined") return "zh";
  const local = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (local) return normalizeLocale(local);
  const fromCookie = readCookieLocale();
  if (fromCookie) return fromCookie;
  const lang = window.navigator.language.toLowerCase();
  return lang.startsWith("en") ? "en" : "zh";
}

function persistLocale(nextLocale: Locale) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
  }
  if (typeof document !== "undefined") {
    document.cookie = `${LOCALE_COOKIE_NAME}=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }
}

function resolvePath(path: string, locale: Locale) {
  const segments = path.split(".");
  let target: unknown = messages[locale];
  for (const segment of segments) {
    if (!target || typeof target !== "object" || !(segment in (target as Record<string, unknown>))) {
      target = null;
      break;
    }
    target = (target as Record<string, unknown>)[segment];
  }
  if (typeof target === "string") return target;
  return null;
}

function interpolate(input: string, params?: TranslateParams) {
  if (!params) return input;
  return Object.entries(params).reduce((acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)), input);
}

export function translate(locale: Locale, key: string, params?: TranslateParams) {
  const fallback = resolvePath(key, "zh") || key;
  const message = resolvePath(key, locale) || fallback;
  return interpolate(message, params);
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("zh");

  useEffect(() => {
    setLocaleState(readPreferredLocale());
  }, []);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    persistLocale(nextLocale);
  }, []);

  const t = useCallback(
    (key: string, params?: TranslateParams) => {
      return translate(locale, key, params);
    },
    [locale]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t
    }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  return {
    locale: "zh" as Locale,
    setLocale: () => {
      // noop
    },
    t: (key: string, params?: TranslateParams) => translate("zh", key, params)
  };
}
