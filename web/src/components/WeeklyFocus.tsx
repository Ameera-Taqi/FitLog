"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";

interface FocusResult {
  totalWorkouts: number;
  neglected: string[];
  minCount: number;
  balanced: boolean;
}

const GROUP_KEY: Record<string, string> = {
  Chest: "focus.chest", Back: "focus.back", Shoulders: "focus.shoulders",
  Arms: "focus.arms", Legs: "focus.legs", Core: "focus.core",
};

export function WeeklyFocus() {
  const supabase = createClient();
  const { t } = useI18n();
  const [data, setData] = useState<FocusResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: res, error } = await supabase.functions.invoke("neglected-muscle");
      if (!alive) return;
      setLoading(false);
      if (error || !res || res.error) return;
      setData(res as FocusResult);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{t("focus.title")}</p>
        <p className="mt-2 text-sm text-ink-400">{t("focus.loading")}</p>
      </div>
    );
  }
  if (!data) return null;

  const group = data.neglected[0];
  const groupLabel = group ? t(GROUP_KEY[group] ?? group) : "";
  const message =
    data.totalWorkouts === 0
      ? t("focus.none")
      : data.balanced
      ? t("focus.balanced")
      : data.minCount === 0
      ? t("focus.neglected", { group: groupLabel })
      : t("focus.least", { group: groupLabel });

  const showChip = data.totalWorkouts > 0 && !data.balanced && group;

  return (
    <div className="card flex items-center gap-4 p-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600">
        <TargetIcon />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{t("focus.title")}</p>
        <p className="mt-0.5 text-sm font-medium text-ink-800">{message}</p>
      </div>
      {showChip && <span className="chip shrink-0 bg-brand-500/15 text-brand-500">{groupLabel}</span>}
    </div>
  );
}

function TargetIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" />
    </svg>
  );
}
