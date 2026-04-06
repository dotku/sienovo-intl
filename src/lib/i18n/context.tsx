"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
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

function getSavedLocale(): Locale | null {
  const saved = localStorage.getItem("locale") as Locale | null;
  if (saved === "en" || saved === "zh") return saved;
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith("zh")) return "zh";
  return null;
}

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale || defaultLocale);

  // Sync from localStorage after hydration to avoid SSR mismatch
  useEffect(() => {
    if (!initialLocale) {
      const saved = getSavedLocale();
      if (saved && saved !== locale) {
        setLocaleState(saved);
        document.documentElement.lang = saved;
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dict = getDictionary(locale);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("locale", newLocale);
    document.documentElement.lang = newLocale;
  }, []);

  return (
    <I18nContext.Provider value={{ locale, dict, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
