"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";

export interface SummaryPayload {
  workoutName: string;
  workoutType?: string;
  durationMinutes?: number;
  unit: "kg" | "lb";
  exercises: { name: string; sets: { reps: number | null; weight: number | null }[] }[];
}

export function WorkoutSummary({ payload, autoGenerate = false }: { payload: SummaryPayload; autoGenerate?: boolean }) {
  const supabase = createClient();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const didAuto = useRef(false);

  // Auto-run once when arriving right after logging a workout.
  useEffect(() => {
    if (autoGenerate && !didAuto.current) {
      didAuto.current = true;
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerate]);

  async function generate() {
    setLoading(true);
    setError(null);
    setSummary(null);
    const { data, error: fnErr } = await supabase.functions.invoke("workout-summary", { body: payload });
    setLoading(false);

    if (fnErr) {
      let msg = t("summary.error");
      try {
        const ctx = (fnErr as { context?: Response }).context;
        const j = ctx ? await ctx.json() : null;
        if (j?.error === "not_configured") msg = t("summary.notConfigured");
      } catch {
        /* keep generic */
      }
      setError(msg);
      return;
    }
    if (data?.summary) setSummary(data.summary as string);
    else setError(t("summary.error"));
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-extrabold">{t("summary.title")}</h3>
        <button type="button" onClick={generate} disabled={loading} className="btn-primary text-xs">
          {loading ? t("summary.generating") : summary ? t("summary.again") : t("summary.generate")}
        </button>
      </div>

      {error && <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-inset ring-red-100">{error}</p>}

      {summary && (
        <p className="mt-3 whitespace-pre-wrap rounded-xl bg-brand-50 px-4 py-3 text-sm leading-relaxed text-brand-800 ring-1 ring-inset ring-brand-100">
          {summary}
        </p>
      )}

      {!summary && !error && !loading && (
        <p className="mt-2 text-sm text-[#6B7280]">{t("summary.hint")}</p>
      )}
    </section>
  );
}
