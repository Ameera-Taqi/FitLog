"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";

export interface WeekBar {
  label: string;
  value: number;
  fullLabel: string;
}

export function WeeklyBars({ data }: { data: WeekBar[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const { t } = useI18n();
  const max = Math.max(1, ...data.map((d) => d.value));

  const points = useMemo(() => {
    const w = 100;
    const h = 100;
    const padX = 4;
    const padY = 12;
    return data.map((d, i) => {
      const x = padX + (i / Math.max(1, data.length - 1)) * (w - padX * 2);
      const y = h - padY - (d.value / max) * (h - padY * 2);
      return { x, y, ...d, i };
    });
  }, [data, max]);

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? 0} 100 L ${points[0]?.x ?? 0} 100 Z`;
  const active = hover ?? Math.min(points.length - 1, Math.floor(points.length / 2));

  return (
    <div className="card flex h-full flex-col p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-bold text-ink-900">{t("chart.trainingVolume")}</h3>
        <span className="rounded-full bg-surface2 px-3 py-1 text-xs font-semibold text-ink-500 ring-1 ring-ink-200">
          {t("chart.lastWeeks", { n: data.length })}
        </span>
      </div>
      <div className="relative h-44 w-full">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          <defs>
            <linearGradient id="volFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF6B4E" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#FF6B4E" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="volStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#FF8A6B" />
              <stop offset="100%" stopColor="#FF6B4E" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#volFill)" />
          <path d={linePath} fill="none" stroke="url(#volStroke)" strokeWidth="2.2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="absolute inset-0 flex">
          {points.map((p) => (
            <button
              key={p.i}
              type="button"
              className="relative flex-1"
              onMouseEnter={() => setHover(p.i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(p.i)}
              onBlur={() => setHover(null)}
              aria-label={`${p.fullLabel}: ${p.value}`}
            >
              {active === p.i && (
                <>
                  <span
                    className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 rounded-lg bg-ink-900 px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg dark:bg-surface2"
                    style={{ top: `${Math.max(4, (p.y / 100) * 100 - 18)}%` }}
                  >
                    {p.value} {t("chart.workoutsUnit")}
                  </span>
                  <span
                    className="pointer-events-none absolute left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-brand-500 ring-4 ring-brand-500/25"
                    style={{ top: `${(p.y / 100) * 100}%` }}
                  />
                </>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 flex justify-between px-1">
        {data.map((d, i) => (
          <span key={i} className="flex-1 text-center text-[10px] font-medium text-ink-400">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
