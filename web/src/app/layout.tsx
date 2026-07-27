import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getLocale, getTheme } from "@/lib/i18n/server";
import { dirFor } from "@/lib/i18n/config";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { ThemeProvider } from "@/lib/i18n/ThemeProvider";

export const metadata: Metadata = {
  title: "FitLog — Gym Tracker",
  description: "Track your workouts, sets, reps, PRs and progress.",
};

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [locale, theme] = await Promise.all([getLocale(), getTheme()]);

  return (
    <html lang={locale} dir={dirFor(locale)} className={theme === "dark" ? "dark" : ""} suppressHydrationWarning>
      <body>
        <ThemeProvider theme={theme}>
          <I18nProvider locale={locale}>{children}</I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
