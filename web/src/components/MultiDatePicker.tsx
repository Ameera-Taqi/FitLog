"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";

// yyyy-mm-dd <-> Date helpers that stay in local time (no UTC drift).
function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fromISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function MultiDatePicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (dates: string[]) => void;
}) {
  const { locale, t } = useI18n();
  const localeTag = locale === "ar" ? "ar" : "en";
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Date>(() =>
    value.length ? fromISO([...value].sort()[0]) : new Date()
  );
  const ref = useRef<HTMLDivElement>(null);

  // Close the calendar when clicking outside.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const selected = useMemo(() => new Set(value), [value]);
  const sortedDates = useMemo(() => [...value].sort(), [value]);
  const todayStr = toISO(new Date());

  const year = view.getFullYear();
  const month = view.getMonth();
  const startWeekday = new Date(year, month, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const weekdays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(localeTag, { weekday: "short" });
    // 2023-01-01 is a Sunday — build a Sunday-first header.
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2023, 0, 1 + i)));
  }, [localeTag]);

  const monthLabel = new Intl.DateTimeFormat(localeTag, { month: "long", year: "numeric" }).format(
    new Date(year, month, 1)
  );
  const chipFmt = useMemo(
    () => new Intl.DateTimeFormat(localeTag, { month: "short", day: "numeric" }),
    [localeTag]
  );

  function toggleDay(iso: string) {
    if (selected.has(iso)) onChange(value.filter((d) => d !== iso));
    else onChange([...value, iso]);
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div ref={ref} className="relative">
      {/* Field */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        className="input flex min-h-[42px] cursor-pointer flex-wrap items-center gap-1.5"
      >
        {sortedDates.length === 0 ? (
          <span className="text-ink-400">{t("form.selectDates")}</span>
        ) : (
          sortedDates.map((iso) => (
            <span key={iso} className="chip gap-1 bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
              {chipFmt.format(fromISO(iso))}
              <span
                role="button"
                tabIndex={0}
                aria-label={t("common.delete")}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(value.filter((d) => d !== iso));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    onChange(value.filter((d) => d !== iso));
                  }
                }}
                className="grid h-3.5 w-3.5 place-items-center rounded-full text-brand-500 hover:text-brand-800"
              >
                <CloseIcon />
              </span>
            </span>
          ))
        )}
        <CalendarIcon className="ms-auto h-4 w-4 shrink-0 text-ink-400" />
      </div>

      {/* Calendar popover */}
      {open && (
        <div className="absolute z-30 mt-2 w-[19rem] max-w-[calc(100vw-3rem)] rounded-2xl bg-surface p-3 shadow-cardhover ring-1 ring-ink-100">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setView(new Date(year, month - 1, 1))}
              className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 transition hover:bg-ink-100"
              aria-label="Previous month"
            >
              <ChevronIcon className="h-4 w-4 rtl:rotate-180" />
            </button>
            <span className="text-sm font-bold text-ink-800">{monthLabel}</span>
            <button
              type="button"
              onClick={() => setView(new Date(year, month + 1, 1))}
              className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 transition hover:bg-ink-100"
              aria-label="Next month"
            >
              <ChevronIcon className="h-4 w-4 rotate-180 rtl:rotate-0" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-ink-400">
            {weekdays.map((w, i) => (
              <div key={i} className="py-1">{w}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (d === null) return <div key={i} />;
              const iso = toISO(new Date(year, month, d));
              const isSel = selected.has(iso);
              const isToday = iso === todayStr;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(iso)}
                  className={`grid h-9 place-items-center rounded-lg text-sm transition ${
                    isSel
                      ? "bg-brand-600 font-bold text-white"
                      : `text-ink-700 hover:bg-ink-100 ${isToday ? "ring-1 ring-inset ring-brand-400" : ""}`
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-ink-100 pt-2">
            <button
              type="button"
              onClick={() => toggleDay(todayStr)}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700"
            >
              {t("form.today")}
            </button>
            <div className="flex gap-3">
              {value.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-xs font-semibold text-ink-400 hover:text-red-500"
                >
                  {t("form.clearDates")}
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700"
              >
                {t("form.done")}
              </button>
            </div>
          </div>
        </div>
      )}

      {value.length > 1 && (
        <p className="mt-1.5 text-xs text-ink-400">{t("form.multiDateHint", { n: value.length })}</p>
      )}
    </div>
  );
}

function CalendarIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
function ChevronIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
