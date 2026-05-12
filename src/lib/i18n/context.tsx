"use client";

import { createContext, useContext, useCallback, useEffect, useMemo, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { type Locale, type Dictionary, getDictionary, defaultLocale } from "./index";

interface I18nContextType {
  locale: Locale;
  dict: Dictionary;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextType>({
  locale: defaultLocale,
  dict: getDictionary(defaultLocale),
  setLocale: () => {},
});

// URL is the single source of truth: paths starting with `/zh` (or just `/zh`)
// render in Chinese, everything else is English. This prevents UI/navigation
// strings from drifting out of sync with article content when localStorage
// holds an opposite preference (the original bug: visiting /blog/X with a
// saved zh preference showed English article + Chinese chrome).
function localeFromPath(pathname: string | null): Locale {
  if (!pathname) return defaultLocale;
  return pathname === "/zh" || pathname.startsWith("/zh/") ? "zh" : "en";
}

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const locale: Locale = initialLocale ?? localeFromPath(pathname);

  // Keep <html lang> in sync (mainly for a11y / SEO).
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const dict = useMemo(() => getDictionary(locale), [locale]);

  // setLocale now navigates between the two URL spaces — the URL is canonical,
  // so flipping locale = flipping the prefix in the current path.
  const setLocale = useCallback(
    (newLocale: Locale) => {
      if (newLocale === locale) return;
      const path = pathname ?? "/";
      const stripped = path === "/zh"
        ? "/"
        : path.startsWith("/zh/")
          ? path.slice(3)
          : path;
      const target = newLocale === "zh"
        ? stripped === "/"
          ? "/zh"
          : `/zh${stripped}`
        : stripped;
      router.push(target);
    },
    [locale, pathname, router],
  );

  return (
    <I18nContext.Provider value={{ locale, dict, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
