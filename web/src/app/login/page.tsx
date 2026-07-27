"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { PreferenceControls } from "@/components/PreferenceControls";
import { useI18n } from "@/lib/i18n/I18nProvider";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useI18n();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      // If email confirmation is on, there is no session yet.
      if (!data.session) {
        setNotice(t("login.accountCreated"));
        setMode("signin");
        setLoading(false);
        return;
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-accent-500/10 blur-3xl" />
      </div>
      <div className="absolute end-4 top-4 z-10">
        <PreferenceControls />
      </div>
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo className="text-2xl" />
          <p className="mt-3 text-sm text-ink-500">
            {t("tagline")}
          </p>
        </div>

        <div className="card p-6 sm:p-8">
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-2xl bg-ink-100 p-1 text-sm font-semibold">
            <button
              type="button"
              onClick={() => { setMode("signin"); setError(null); }}
              className={`rounded-xl py-2.5 transition ${mode === "signin" ? "bg-brand-500 text-white shadow-sm" : "text-ink-500"}`}
            >
              {t("login.signin")}
            </button>
            <button
              type="button"
              onClick={() => { setMode("signup"); setError(null); }}
              className={`rounded-xl py-2.5 transition ${mode === "signup" ? "bg-brand-500 text-white shadow-sm" : "text-ink-500"}`}
            >
              {t("login.createAccount")}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">{t("login.email")}</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="label" htmlFor="password">{t("login.password")}</label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-red-100">{error}</p>
            )}
            {notice && (
              <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 ring-1 ring-brand-100">{notice}</p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? t("common.pleaseWait") : mode === "signin" ? t("login.signin") : t("login.createAccount")}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-ink-400">
          {t("login.secured")}
        </p>
      </div>
    </div>
  );
}
