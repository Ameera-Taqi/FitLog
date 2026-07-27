"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { THEME_COOKIE, PREF_COOKIE_MAXAGE } from "./config";
import type { Theme } from "./config";

interface ThemeCtx {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx>({
  theme: "light",
  setTheme: () => {},
  toggle: () => {},
});

export function ThemeProvider({ theme: initial, children }: { theme: Theme; children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initial);

  const setTheme = useCallback((t: Theme) => {
    document.cookie = `${THEME_COOKIE}=${t};path=/;max-age=${PREF_COOKIE_MAXAGE};samesite=lax`;
    document.documentElement.classList.toggle("dark", t === "dark");
    setThemeState(t);
    // Pure CSS change — no server re-render needed.
  }, []);

  const toggle = useCallback(() => setTheme(theme === "dark" ? "light" : "dark"), [theme, setTheme]);

  return <Ctx.Provider value={{ theme, setTheme, toggle }}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  return useContext(Ctx);
}
