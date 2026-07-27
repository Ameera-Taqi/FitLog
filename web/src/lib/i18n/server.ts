import { cookies } from "next/headers";
import { LANG_COOKIE, THEME_COOKIE, DEFAULT_LOCALE, DEFAULT_THEME, isLocale, isTheme } from "./config";
import type { Locale, Theme } from "./config";
import { translate, type Translator } from "./dictionaries";

export async function getLocale(): Promise<Locale> {
  const c = await cookies();
  const v = c.get(LANG_COOKIE)?.value;
  return isLocale(v) ? v : DEFAULT_LOCALE;
}

export async function getTheme(): Promise<Theme> {
  const c = await cookies();
  const v = c.get(THEME_COOKIE)?.value;
  return isTheme(v) ? v : DEFAULT_THEME;
}

// Translator for server components.
export async function getT(): Promise<{ locale: Locale; t: Translator }> {
  const locale = await getLocale();
  return { locale, t: (key, vars) => translate(locale, key, vars) };
}
