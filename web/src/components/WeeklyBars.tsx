"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";

export interface WeekBar {
  label: string;   // e.g. "Jul 14"
  value: number;   // count of workouts
  fullLabel: string;
}

// Single-series bar chart (workout count per week). Single hue by design —
// no categorical palette needed. Rounded data-ends anchored to baseline.
export function WeeklyBars({ data }: { data: WeekBar[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const { t } = useI18n();
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink-800">{t("chart.trainingVolume")}</h3>
        <span className="text-xs text-ink-400">{t("chart.lastWeeks", { n: data.length })}</span>
      </div>
      <div className="flex h-40 items-end gap-2 sm:gap-3">
        {data.map((d, i) => {
          const h = (d.value / max) * 100;
          const active = hover === i;
          return (
            <div
              key={i}
              className="group relative flex flex-1 flex-col items-center justify-end"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {active && (
                <div className="absolute -top-9 z-10 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg dark:bg-slate-700">
                  {d.value} {t("chart.workoutsUnit")}
                  <span className="mt-0.5 block text-[10px] font-normal text-slate-300">{d.fullLabel}</span>
                </div>
              )}
              <div
                className={`w-full rounded-t-md transition-all ${active ? "bg-brand-600" : "bg-brand-500/85"}`}
                style={{ height: `${Math.max(h, d.value > 0 ? 6 : 2)}%`, minHeight: d.value > 0 ? 6 : 2 }}
              />
              <span className="mt-2 text-[10px] font-medium text-ink-400">{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
