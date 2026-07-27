"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { LANG_COOKIE, PREF_COOKIE_MAXAGE, dirFor } from "./config";
import type { Locale } from "./config";
import { translate, type Translator } from "./dictionaries";

interface I18nCtx {
  locale: Locale;
  t: Translator;
  setLocale: (l: Locale) => void;
}

const Ctx = createContext<I18nCtx>({
  locale: "en",
  t: (k) => k,
  setLocale: () => {},
});

export function I18nProvider({ locale: initial, children }: { locale: Locale; children: React.ReactNode }) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initial);

  const setLocale = useCallback(
    (l: Locale) => {
      document.cookie = `${LANG_COOKIE}=${l};path=/;max-age=${PREF_COOKIE_MAXAGE};samesite=lax`;
      const html = document.documentElement;
      html.lang = l;
      html.dir = dirFor(l);
      setLocaleState(l);
      // Re-render server components (which read the cookie) with the new locale.
      router.refresh();
    },
    [router]
  );

  const t = useCallback<Translator>((key, vars) => translate(locale, key, vars), [locale]);

  return <Ctx.Provider value={{ locale, t, setLocale }}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  return useContext(Ctx);
}
