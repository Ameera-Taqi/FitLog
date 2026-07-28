"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Workout, WorkoutSchedule } from "@/lib/types";
import { workoutTypeMeta } from "@/lib/constants";

type ScheduleRow = WorkoutSchedule & { workouts: Workout | null };

export function CalendarPlanner({
  initialMonth,
  initialSchedules,
  library,
  embedded = false,
}: {
  initialMonth: string; // YYYY-MM-01
  initialSchedules: ScheduleRow[];
  library: Workout[];
  embedded?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useI18n();
  const [cursor, setCursor] = useState(() => new Date(initialMonth + "T12:00:00"));
  const [schedules, setSchedules] = useState(initialSchedules);
  const [selected, setSelected] = useState<string | null>(null);
  /** Draft workout ids for the open day — saved only when user taps Save. */
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSchedules(initialSchedules);
  }, [initialSchedules]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0

  const byDate = useMemo(() => {
    const map = new Map<string, ScheduleRow[]>();
    for (const s of schedules) {
      const key = s.scheduled_date;
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return map;
  }, [schedules]);

  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  function openDay(dateStr: string) {
    setError(null);
    setSelected(dateStr);
    setDraftIds((byDate.get(dateStr) ?? []).map((s) => s.workout_id));
  }

  function closeDay() {
    setSelected(null);
    setDraftIds([]);
    setError(null);
  }

  function shiftMonth(delta: number) {
    const next = new Date(year, month + delta, 1);
    setCursor(next);
    const y = next.getFullYear();
    const m = String(next.getMonth() + 1).padStart(2, "0");
    startTransition(() => {
      router.push(`/workouts?tab=yours&month=${y}-${m}`);
    });
  }

  const draftScheduled = draftIds
    .map((id) => library.find((w) => w.id === id))
    .filter((w): w is Workout => Boolean(w));
  const draftSet = new Set(draftIds);
  const existingForDay = selected ? byDate.get(selected) ?? [] : [];

  function toggleDraft(workoutId: string) {
    setDraftIds((cur) =>
      cur.includes(workoutId) ? cur.filter((id) => id !== workoutId) : [...cur, workoutId],
    );
  }

  async function saveDay() {
    if (!selected) return;
    setSaving(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      setError(t("calendar.errSession"));
      setSaving(false);
      return;
    }

    const existingIds = new Set(existingForDay.map((s) => s.workout_id));
    const nextIds = new Set(draftIds);
    const toAdd = draftIds.filter((id) => !existingIds.has(id));
    const toRemove = existingForDay.filter((s) => !nextIds.has(s.workout_id));

    try {
      if (toRemove.length) {
        const { error: delErr } = await supabase
          .from("workout_schedules")
          .delete()
          .in(
            "id",
            toRemove.map((s) => s.id),
          );
        if (delErr) throw delErr;
      }

      if (toAdd.length) {
        const { error: insErr } = await supabase.from("workout_schedules").insert(
          toAdd.map((workout_id) => ({
            user_id: uid,
            workout_id,
            scheduled_date: selected,
          })),
        );
        if (insErr) throw insErr;
      }

      // Refresh local month schedules for this day
      const { data: refreshed } = await supabase
        .from("workout_schedules")
        .select("*, workouts(*)")
        .eq("scheduled_date", selected);

      setSchedules((cur) => [
        ...cur.filter((s) => s.scheduled_date !== selected),
        ...((refreshed as ScheduleRow[]) ?? []),
      ]);

      closeDay();
      startTransition(() => router.refresh());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("form.errGeneric"));
    } finally {
      setSaving(false);
    }
  }

  const cells: (number | null)[] = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      {!embedded && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">{t("calendar.title")}</h1>
            <p className="text-sm text-ink-500">{t("calendar.subtitle")}</p>
          </div>
          <Link href="/workouts/new" className="btn-primary">
            {t("calendar.createWorkout")}
          </Link>
        </div>
      )}

      <div className="mx-auto w-full max-w-5xl card overflow-hidden p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button type="button" onClick={() => shiftMonth(-1)} className="btn-ghost px-3 py-2 text-sm" disabled={pending}>
            ‹
          </button>
          <h2 className="text-xl font-extrabold text-ink-900">{monthLabel}</h2>
          <button type="button" onClick={() => shiftMonth(1)} className="btn-ghost px-3 py-2 text-sm" disabled={pending}>
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-bold uppercase tracking-wide text-ink-400 sm:gap-2">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1.5 sm:gap-2">
          {cells.map((day, i) => {
            if (day == null) return <div key={`e-${i}`} className="aspect-square" />;
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const items = byDate.get(dateStr) ?? [];
            const isToday = dateStr === todayStr;
            const isSelected = selected === dateStr;
            const reviewId = items[0]?.workout_id;
            return (
              <div
                key={dateStr}
                className={`relative flex aspect-square flex-col overflow-hidden rounded-2xl sm:rounded-3xl ${
                  isSelected
                    ? "bg-brand-500 text-white shadow-md"
                    : isToday
                      ? "bg-brand-500/15 text-brand-400 ring-1 ring-brand-500/40"
                      : "bg-surface2 text-ink-800"
                }`}
              >
                {items.length > 0 && reviewId && (
                  <Link
                    href={`/workouts/${reviewId}`}
                    className={`absolute inset-x-0 top-2.5 z-10 truncate px-1 text-center text-[8px] font-bold leading-none tracking-wide sm:top-3 sm:text-[9px] ${
                      isSelected ? "text-white/90 hover:text-white" : "text-brand-400 hover:text-brand-300"
                    }`}
                    title={t("calendar.workoutReview")}
                  >
                    {t("calendar.review")}
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => openDay(dateStr)}
                  className={`relative flex h-full w-full flex-col items-center justify-center text-base font-semibold transition sm:text-lg ${
                    isSelected ? "text-white" : isToday ? "text-brand-400" : "text-ink-800 hover:bg-ink-100/60"
                  }`}
                >
                  <span>{day}</span>
                  {items.length > 0 && (
                    <span className="absolute bottom-2 flex justify-center gap-1">
                      {items.slice(0, 3).map((s) => (
                        <span
                          key={s.id}
                          className={`h-1.5 w-1.5 rounded-full sm:h-2 sm:w-2 ${isSelected ? "bg-white" : "bg-brand-500"}`}
                        />
                      ))}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6"
          onClick={closeDay}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-surface shadow-cardhover sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-ink-400">{t("calendar.selectedDay")}</p>
                <h3 className="text-lg font-extrabold text-ink-900">
                  {new Date(selected + "T12:00:00").toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}
                </h3>
              </div>
              <button type="button" onClick={closeDay} className="btn-ghost px-3 py-2 text-sm">
                {t("common.cancel")}
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
              {error && (
                <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-400 ring-1 ring-red-500/20">{error}</p>
              )}

              <section>
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">
                  {t("calendar.scheduled")}
                </h4>
                {draftScheduled.length === 0 ? (
                  <p className="text-sm text-ink-500">{t("calendar.noneScheduled")}</p>
                ) : (
                  <ul className="space-y-2">
                    {draftScheduled.map((w) => {
                      const meta = workoutTypeMeta(w.workout_type);
                      return (
                        <li
                          key={w.id}
                          className="flex items-center gap-3 rounded-2xl bg-surface2 px-3 py-3 ring-1 ring-ink-100"
                        >
                          <span className="text-lg">{meta.icon}</span>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-ink-900">{w.name}</p>
                            <p className="text-xs text-ink-500">{t(`enum.wtype.${w.workout_type}`)}</p>
                          </div>
                          <Link
                            href={`/workouts/${w.id}`}
                            className="rounded-full px-3 py-1.5 text-xs font-bold text-brand-400 hover:bg-brand-500/10"
                          >
                            {t("calendar.review")}
                          </Link>
                          <button
                            type="button"
                            onClick={() => toggleDraft(w.id)}
                            className="rounded-full px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/10"
                          >
                            {t("calendar.remove")}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section>
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">
                  {t("calendar.library")}
                </h4>
                {library.length === 0 ? (
                  <div className="rounded-2xl bg-surface2 p-4 text-sm text-ink-500">
                    <p>{t("calendar.emptyLibrary")}</p>
                    <Link href="/workouts/new" className="mt-2 inline-block font-semibold text-brand-500">
                      {t("calendar.createWorkout")}
                    </Link>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {library
                      .filter((w) => !draftSet.has(w.id))
                      .map((w) => {
                      const meta = workoutTypeMeta(w.workout_type);
                      return (
                        <li key={w.id}>
                          <button
                            type="button"
                            onClick={() => toggleDraft(w.id)}
                            className="flex w-full items-center gap-3 rounded-2xl bg-surface2 px-3 py-3 text-start ring-1 ring-ink-100 transition hover:bg-ink-100"
                          >
                            <span className="text-lg">{meta.icon}</span>
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-ink-900">{w.name}</p>
                              <p className="text-xs text-ink-500">{t(`enum.wtype.${w.workout_type}`)}</p>
                            </div>
                            <span className="text-xs font-bold text-brand-400">
                              {t("calendar.assign")}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                    {library.every((w) => draftSet.has(w.id)) && (
                      <p className="text-sm text-ink-500">{t("calendar.allAssigned")}</p>
                    )}
                  </ul>
                )}
              </section>
            </div>

            <div className="border-t border-ink-100 px-5 py-4">
              <button type="button" onClick={saveDay} className="btn-primary w-full" disabled={saving}>
                {saving ? t("common.saving") : t("common.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
