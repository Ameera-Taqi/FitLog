"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  WORKOUT_TYPES, EXERCISE_DIFFICULTIES, MUSCLE_GROUPS, COMMON_EXERCISES, WORKOUT_TEMPLATES,
} from "@/lib/constants";
import type { Workout, WorkoutType, ExerciseDifficulty, UnitPreference } from "@/lib/types";
import { kgToUnit, unitToKg, roundForDisplay, todayISO } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { MultiDatePicker } from "@/components/MultiDatePicker";

interface ExerciseForm {
  name: string; is_pr: boolean; difficulty: ExerciseDifficulty | ""; completed: boolean;
  setsCount: string; reps: string; weight: string; rest: string;
  distance_km: string; duration_seconds: string; notes: string;
}

const emptyExercise = (): ExerciseForm => ({
  name: "", is_pr: false, difficulty: "", completed: false,
  setsCount: "", reps: "", weight: "", rest: "",
  distance_km: "", duration_seconds: "", notes: "",
});

function num(s: string): number | null {
  if (s === "" || s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function WorkoutForm({ initial, unit = "kg" }: { initial?: Workout; unit?: UnitPreference }) {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useI18n();
  const isEdit = Boolean(initial);

  // Weights are stored in kg; the form shows/accepts the user's preferred unit.
  const kgToInput = (kg: number | null | undefined): string =>
    kg == null ? "" : String(roundForDisplay(kgToUnit(kg, unit), unit));
  const inputToKg = (s: string): number | null => {
    const v = num(s);
    return v == null ? null : unitToKg(v, unit);
  };

  const [name, setName] = useState(initial?.name ?? "");
  // Which quick-start template is picked; "other" means a custom, user-typed name.
  const [templateKey, setTemplateKey] = useState<string>("other");
  const [dates, setDates] = useState<string[]>(initial?.workout_date ? [initial.workout_date] : [todayISO()]);
  const [duration, setDuration] = useState(initial?.duration_minutes?.toString() ?? "");
  const [type, setType] = useState<WorkoutType>(initial?.workout_type ?? "strength");
  const [muscles, setMuscles] = useState<string[]>(initial?.muscle_groups ?? []);
  const [calories, setCalories] = useState(initial?.calories_burned?.toString() ?? "");

  const [exercises, setExercises] = useState<ExerciseForm[]>(
    initial?.exercises?.length
      ? initial.exercises
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((e) => {
            // Collapse the stored per-set rows into simple sets/reps/weight/rest.
            const eSets = e.exercise_sets ?? [];
            const first = eSets[0];
            return {
              name: e.name,
              is_pr: e.is_pr,
              difficulty: e.difficulty ?? "",
              completed: e.completed ?? false,
              setsCount: eSets.length ? String(eSets.length) : "",
              reps: first?.reps != null ? String(first.reps) : "",
              weight: kgToInput(first?.weight ?? null),
              rest: first?.rest_seconds != null ? String(first.rest_seconds) : "",
              distance_km: e.distance_km?.toString() ?? "",
              duration_seconds: e.duration_seconds?.toString() ?? "",
              notes: e.notes ?? "",
            };
          })
      : [emptyExercise()]
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);

  const isCardio = type === "cardio";
  const effectiveDuration = num(duration);

  function toggleMuscle(m: string) {
    setMuscles((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));
  }

  // Quick-start: prefill name, type and muscle groups from a template.
  function applyTemplate(tpl: (typeof WORKOUT_TEMPLATES)[number]) {
    setName(t(`template.${tpl.key}`));
    setType(tpl.type);
    setMuscles(tpl.muscles);
  }

  // Dropdown handler: a template prefills everything; "other" lets the user type a name.
  function selectTemplate(val: string) {
    setTemplateKey(val);
    if (val === "other") {
      setName("");
    } else {
      const tpl = WORKOUT_TEMPLATES.find((x) => x.key === val);
      if (tpl) applyTemplate(tpl);
    }
  }

  // Exercise mutators
  function updateExercise(i: number, patch: Partial<ExerciseForm>) {
    setExercises((cur) => cur.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }
  function addExercise() { setExercises((cur) => [...cur, emptyExercise()]); }
  function removeExercise(i: number) { setExercises((cur) => cur.filter((_, idx) => idx !== i)); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (savingRef.current) return;
    setError(null);
    if (!name.trim()) { setError(t("form.errName")); return; }
    if (dates.length === 0) { setError(t("form.errNoDate")); return; }
    savingRef.current = true;
    setSaving(true);

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { setError(t("form.errSession")); setSaving(false); return; }

    // A workout counts as completed once it has exercises and all are marked done.
    const namedExercises = exercises.filter((ex) => ex.name.trim());
    const workoutCompleted = namedExercises.length > 0 && namedExercises.every((ex) => ex.completed);

    // Fields shared by every date this workout is scheduled on.
    const baseFields = {
      user_id: uid,
      name: name.trim(),
      duration_minutes: effectiveDuration,
      workout_type: type,
      muscle_groups: muscles,
      calories_burned: num(calories),
      completed: workoutCompleted,
    };

    const payloadFor = (dateStr: string) => ({
      ...baseFields,
      workout_date: dateStr,
    });

    // Re-create the exercises + sets under a given workout id.
    async function insertChildren(workoutId: string) {
      for (let i = 0; i < namedExercises.length; i++) {
        const ex = namedExercises[i];
        const { data: exRow, error: exErr } = await supabase
          .from("exercises")
          .insert({
            workout_id: workoutId,
            name: ex.name.trim(),
            position: i,
            is_pr: ex.is_pr,
            difficulty: ex.difficulty || null,
            completed: ex.completed,
            distance_km: num(ex.distance_km),
            duration_seconds: num(ex.duration_seconds),
            notes: ex.notes.trim() || null,
          })
          .select("id")
          .single();
        if (exErr) throw exErr;

        // Expand the "number of sets" into that many identical set rows.
        const wanted = Math.floor(Number(ex.setsCount) || 0);
        const hasSetData = Boolean(ex.reps || ex.weight || ex.rest);
        const count = wanted > 0 ? wanted : hasSetData ? 1 : 0;
        const reps = num(ex.reps);
        const weight = inputToKg(ex.weight);
        const rest = num(ex.rest);
        const setsPayload = Array.from({ length: count }, (_, si) => ({
          exercise_id: exRow.id,
          set_number: si + 1,
          reps,
          weight,
          distance_km: null,
          duration_seconds: null,
          rest_seconds: rest,
          is_pr: false,
          completed: true,
        }));
        if (setsPayload.length) {
          const { error: setErr } = await supabase.from("exercise_sets").insert(setsPayload);
          if (setErr) throw setErr;
        }
      }
    }

    async function createWorkout(dateStr: string): Promise<string> {
      const { data: ins, error: insErr } = await supabase
        .from("workouts").insert(payloadFor(dateStr)).select("id").single();
      if (insErr) throw insErr;
      await insertChildren(ins.id);
      return ins.id;
    }

    try {
      // Deduplicate dates so one calendar day never creates two sessions.
      const sortedDates = [...new Set(dates)].sort();
      const ids: string[] = [];

      if (isEdit && initial?.id) {
        // Update the existing workout to the first date, then add any extra dates as new sessions.
        const { error: upErr } = await supabase.from("workouts").update(payloadFor(sortedDates[0])).eq("id", initial.id);
        if (upErr) throw upErr;
        await supabase.from("exercises").delete().eq("workout_id", initial.id);
        await insertChildren(initial.id);
        ids.push(initial.id);
        for (const d of sortedDates.slice(1)) ids.push(await createWorkout(d));
      } else {
        for (const d of sortedDates) ids.push(await createWorkout(d));
      }

      router.push(ids.length === 1 ? `/workouts/${ids[0]}` : "/workouts");
      router.refresh();
    } catch (err: unknown) {
      savingRef.current = false;
      setError(err instanceof Error ? err.message : t("form.errGeneric"));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basics */}
      <section className="card p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-ink-500">{t("form.session")}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">{t("form.quickStart")}</label>
            <select value={templateKey} onChange={(e) => selectTemplate(e.target.value)} className="input">
              {WORKOUT_TEMPLATES.map((tpl) => (
                <option key={tpl.key} value={tpl.key}>{t(`template.${tpl.key}`)}</option>
              ))}
              <option value="other">{t("form.otherTemplate")}</option>
            </select>
          </div>
          {templateKey === "other" && (
            <div className="sm:col-span-2">
              <label className="label">{t("form.name")} *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder={t("form.namePlaceholder")} required />
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="label">{t("form.dates")} *</label>
            <MultiDatePicker value={dates} onChange={setDates} />
          </div>
          <div>
            <label className="label">{t("form.duration")}</label>
            <input type="number" min="0" value={duration} onChange={(e) => setDuration(e.target.value)} className="input" placeholder="60" />
          </div>
          <div>
            <label className="label">{t("form.calories")}</label>
            <input type="number" min="0" value={calories} onChange={(e) => setCalories(e.target.value)} className="input" placeholder="450" />
          </div>
        </div>

        {/* Type */}
        <div className="mt-4">
          <label className="label">{t("form.workoutType")}</label>
          <div className="flex flex-wrap gap-2">
            {WORKOUT_TYPES.map((wt) => (
              <button type="button" key={wt.value} onClick={() => setType(wt.value)}
                className={`chip px-3 py-1.5 ring-1 ring-inset transition ${type === wt.value ? "bg-brand-600 text-white ring-brand-600" : "bg-surface2 text-ink-600 ring-ink-200 hover:bg-ink-100"}`}>
                <span>{wt.icon}</span>{t(`enum.wtype.${wt.value}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Muscle groups */}
        <div className="mt-4">
          <label className="label">{t("form.muscles")}</label>
          <div className="flex flex-wrap gap-2">
            {MUSCLE_GROUPS.map((m) => (
              <button type="button" key={m} onClick={() => toggleMuscle(m)}
                className={`chip px-3 py-1.5 ring-1 ring-inset transition ${muscles.includes(m) ? "bg-accent-500 text-white ring-accent-500" : "bg-surface2 text-ink-600 ring-ink-200 hover:bg-ink-100"}`}>
                {t(`enum.muscle.${m}`)}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Exercises */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black uppercase tracking-tight text-ink-900">{t("form.exercises")}</h2>
          <button type="button" onClick={addExercise} className="btn-secondary">{t("form.addExercise")}</button>
        </div>

        {exercises.map((ex, ei) => (
          <div key={ei} className={`card p-4 transition sm:p-5 ${ex.completed ? "ring-2 ring-brand-500/60" : ""}`}>
            <div className="flex items-start gap-3">
              <span className={`mt-1.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold transition ${ex.completed ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700"}`}>
                {ex.completed ? <CheckIcon className="h-4 w-4" /> : ei + 1}
              </span>
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <input list="common-exercises" value={ex.name} onChange={(e) => updateExercise(ei, { name: e.target.value })}
                    className="input flex-1" placeholder={t("form.exerciseNamePlaceholder")} />
                  {exercises.length > 1 && (
                    <button type="button" onClick={() => removeExercise(ei)} className="btn-ghost shrink-0 px-2 text-ink-400 hover:text-red-500" aria-label="Remove exercise">
                      <TrashIcon />
                    </button>
                  )}
                </div>

                {isCardio && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label">{t("form.distanceKm")}</label>
                      <input type="number" step="0.01" min="0" value={ex.distance_km} onChange={(e) => updateExercise(ei, { distance_km: e.target.value })} className="input" placeholder="5" />
                    </div>
                    <div>
                      <label className="label">{t("form.timeMin")}</label>
                      <input type="number" step="0.1" min="0" value={ex.duration_seconds ? String(Number(ex.duration_seconds) / 60) : ""}
                        onChange={(e) => updateExercise(ei, { duration_seconds: e.target.value ? String(Math.round(Number(e.target.value) * 60)) : "" })}
                        className="input" placeholder="e.g. 30" />
                    </div>
                  </div>
                )}

                {/* Sets — the user enters how many sets, plus reps/weight/rest per set */}
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-ink-50 p-3 sm:grid-cols-4">
                  <div>
                    <label className="label">{t("form.sets")}</label>
                    <input type="number" min="0" value={ex.setsCount} onChange={(e) => updateExercise(ei, { setsCount: e.target.value })} className="input" placeholder="3" />
                  </div>
                  <div>
                    <label className="label">{t("form.reps")}</label>
                    <input type="number" min="0" value={ex.reps} onChange={(e) => updateExercise(ei, { reps: e.target.value })} className="input" placeholder="10" />
                  </div>
                  <div>
                    <label className="label">{t("form.weight", { unit })}</label>
                    <input type="number" step="0.5" min="0" value={ex.weight} onChange={(e) => updateExercise(ei, { weight: e.target.value })} className="input" placeholder="60" />
                  </div>
                  <div>
                    <label className="label">{t("form.restS")}</label>
                    <input type="number" min="0" value={ex.rest} onChange={(e) => updateExercise(ei, { rest: e.target.value })} className="input" placeholder="90" />
                  </div>
                </div>

                <input value={ex.notes} onChange={(e) => updateExercise(ei, { notes: e.target.value })} className="input" placeholder={t("form.exerciseNotes")} />

                {/* Meta: difficulty · PR · completed */}
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-ink-100 pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">{t("form.difficulty")}</span>
                    <div className="flex gap-1.5">
                      {EXERCISE_DIFFICULTIES.map((d) => (
                        <button
                          type="button"
                          key={d.value}
                          onClick={() => updateExercise(ei, { difficulty: ex.difficulty === d.value ? "" : d.value })}
                          className={`chip px-3 py-1 ring-1 ring-inset transition ${
                            ex.difficulty === d.value
                              ? "bg-slate-800 text-white ring-slate-800 dark:bg-slate-200 dark:text-slate-900 dark:ring-slate-200"
                              : "bg-surface2 text-ink-600 ring-ink-200 hover:bg-ink-100"
                          }`}
                        >
                          {t(`enum.difficulty.${d.value}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateExercise(ei, { is_pr: !ex.is_pr })}
                      aria-pressed={ex.is_pr}
                      className={`chip gap-1 px-3 py-1.5 text-sm font-bold ring-1 ring-inset transition ${
                        ex.is_pr
                          ? "bg-amber-500 text-white ring-amber-500"
                          : "bg-surface2 text-ink-600 ring-ink-200 hover:bg-ink-100"
                      }`}
                    >
                      ★ {t("form.pr")}
                    </button>
                    {!isEdit && (
                      <label
                        className={`flex cursor-pointer select-none items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold ring-1 ring-inset transition ${
                          ex.completed
                            ? "bg-brand-600 text-white ring-brand-600"
                            : "bg-surface2 text-ink-600 ring-ink-200 hover:bg-ink-100"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={ex.completed}
                          onChange={(e) => updateExercise(ei, { completed: e.target.checked })}
                          className="sr-only"
                        />
                        <CheckIcon className="h-4 w-4" />
                        {t("form.completed")}
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
        <datalist id="common-exercises">
          {COMMON_EXERCISES.map((n) => <option key={n} value={n} />)}
        </datalist>
      </section>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">{error}</p>}

      <div className="sticky bottom-16 z-20 flex gap-3 sm:bottom-0">
        <button type="submit" disabled={saving} className="btn-primary flex-1 shadow-lg sm:flex-none">
          {saving ? t("common.saving") : isEdit ? t("form.saveChanges") : t("form.saveWorkout")}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">{t("common.cancel")}</button>
      </div>
    </form>
  );
}

function TrashIcon({ small = false }: { small?: boolean }) {
  const s = small ? 14 : 18;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  );
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
