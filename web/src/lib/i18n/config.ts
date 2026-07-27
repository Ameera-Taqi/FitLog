// Shared i18n + theme config (safe to import from server or client).

export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export type Theme = "light" | "dark";
export const DEFAULT_THEME: Theme = "light";

export const LANG_COOKIE = "pref-lang";
export const THEME_COOKIE = "pref-theme";
// 1 year
export const PREF_COOKIE_MAXAGE = 60 * 60 * 24 * 365;

export function dirFor(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function isLocale(v: string | undefined | null): v is Locale {
  return !!v && (LOCALES as readonly string[]).includes(v);
}

export function isTheme(v: string | undefined | null): v is Theme {
  return v === "light" || v === "dark";
}
