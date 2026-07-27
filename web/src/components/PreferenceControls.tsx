"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";
import { useTheme } from "@/lib/i18n/ThemeProvider";

export function PreferenceControls({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  const { theme, toggle } = useTheme();

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {/* Language toggle */}
      <button
        type="button"
        onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
        title={locale === "ar" ? t("pref.switchToEnglish") : t("pref.switchToArabic")}
        aria-label={t("pref.language")}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold text-ink-600 ring-1 ring-inset ring-ink-200 transition hover:bg-ink-100"
      >
        <GlobeIcon className="h-4 w-4" />
        <span>{locale === "ar" ? "EN" : "ع"}</span>
      </button>

      {/* Theme toggle */}
      <button
        type="button"
        onClick={toggle}
        title={theme === "dark" ? t("pref.switchToLight") : t("pref.switchToDark")}
        aria-label={t("pref.theme")}
        className="grid h-9 w-9 place-items-center rounded-xl text-ink-600 ring-1 ring-inset ring-ink-200 transition hover:bg-ink-100"
      >
        {theme === "dark" ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
      </button>
    </div>
  );
}

function GlobeIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}
function SunIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}
function MoonIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}
