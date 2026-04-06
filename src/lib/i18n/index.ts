import en from "./en.json";
import zh from "./zh.json";

export type Locale = "en" | "zh";
export const locales: Locale[] = ["en", "zh"];
export const defaultLocale: Locale = "en";

const dictionaries = { en, zh };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Dictionary = Record<string, any>;

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] || dictionaries[defaultLocale];
}

export function isValidLocale(s: string): s is Locale {
  return locales.includes(s as Locale);
}
