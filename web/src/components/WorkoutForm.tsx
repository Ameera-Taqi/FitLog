"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  WORKOUT_TYPES, DIFFICULTIES, MOODS, ENERGY_LEVELS, MUSCLE_GROUPS, COMMON_EXERCISES, WORKOUT_TEMPLATES,
} from "@/lib/constants";
import type { Workout, WorkoutType, Difficulty, Mood, UnitPreference } from "@/lib/types";
import { timeFromTimestamp, kgToUnit, unitToKg, roundForDisplay } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";

interface SetForm {
  reps: string; weight: string; distance_km: string; duration_seconds: string; rest_seconds: string; is_pr: boolean; completed: boolean;
}
interface ExerciseForm {
  name: string; is_pr: boolean; distance_km: string; duration_seconds: string; notes: string; sets: SetForm[];
}

const emptySet = (): SetForm => ({ reps: "", weight: "", distance_km: "", duration_seconds: "", rest_seconds: "", is_pr: false, completed: true });
const emptyExercise = (): ExerciseForm => ({ name: "", is_pr: false, distance_km: "", duration_seconds: "", notes: "", sets: [emptySet()] });

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
  const [date, setDate] = useState(initial?.workout_date ?? new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState(timeFromTimestamp(initial?.start_time ?? null) ? toInputTime(initial!.start_time!) : "");
  const [endTime, setEndTime] = useState(initial?.end_time ? toInputTime(initial.end_time) : "");
  const [duration, setDuration] = useState(initial?.duration_minutes?.toString() ?? "");
  const [type, setType] = useState<WorkoutType>(initial?.workout_type ?? "strength");
  const [muscles, setMuscles] = useState<string[]>(initial?.muscle_groups ?? []);
  const [calories, setCalories] = useState(initial?.calories_burned?.toString() ?? "");
  const [difficulty, setDifficulty] = useState<Difficulty | "">(initial?.difficulty ?? "");
  const [energy, setEnergy] = useState<number | null>(initial?.energy_before ?? null);
  const [mood, setMood] = useState<Mood | "">(initial?.mood_after ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [completed, setCompleted] = useState(initial?.completed ?? false);
  const [bodyWeight, setBodyWeight] = useState(kgToInput(initial?.body_weight));

  const [exercises, setExercises] = useState<ExerciseForm[]>(
    initial?.exercises?.length
      ? initial.exercises
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((e) => ({
            name: e.name,
            is_pr: e.is_pr,
            distance_km: e.distance_km?.toString() ?? "",
            duration_seconds: e.duration_seconds?.toString() ?? "",
            notes: e.notes ?? "",
            sets: (e.exercise_sets ?? []).length
              ? e.exercise_sets!.map((s) => ({
                  reps: s.reps?.toString() ?? "",
                  weight: kgToInput(s.weight),
                  distance_km: s.distance_km?.toString() ?? "",
                  duration_seconds: s.duration_seconds?.toString() ?? "",
                  rest_seconds: s.rest_seconds?.toString() ?? "",
                  is_pr: s.is_pr,
                  completed: s.completed,
                }))
              : [emptySet()],
          }))
      : [emptyExercise()]
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCardio = type === "cardio";

  // Auto duration from start/end
  const computedDuration = useMemo(() => {
    if (startTime && endTime) {
      const [sh, sm] = startTime.split(":").map(Number);
      const [eh, em] = endTime.split(":").map(Number);
      let mins = eh * 60 + em - (sh * 60 + sm);
      if (mins < 0) mins += 24 * 60;
      return mins;
    }
    return null;
  }, [startTime, endTime]);

  const effectiveDuration = duration !== "" ? num(duration) : computedDuration;

  function toggleMuscle(m: string) {
    setMuscles((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));
  }

  // Quick-start: prefill name, type and muscle groups from a template.
  function applyTemplate(tpl: (typeof WORKOUT_TEMPLATES)[number]) {
    setName(t(`template.${tpl.key}`));
    setType(tpl.type);
    setMuscles(tpl.muscles);
  }

  // Exercise mutators
  function updateExercise(i: number, patch: Partial<ExerciseForm>) {
    setExercises((cur) => cur.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }
  function addExercise() { setExercises((cur) => [...cur, emptyExercise()]); }
  function removeExercise(i: number) { setExercises((cur) => cur.filter((_, idx) => idx !== i)); }
  function updateSet(ei: number, si: number, patch: Partial<SetForm>) {
    setExercises((cur) =>
      cur.map((e, idx) =>
        idx === ei ? { ...e, sets: e.sets.map((s, sidx) => (sidx === si ? { ...s, ...patch } : s)) } : e
      )
    );
  }
  function addSet(ei: number) {
    setExercises((cur) =>
      cur.map((e, idx) => (idx === ei ? { ...e, sets: [...e.sets, { ...(e.sets[e.sets.length - 1] ?? emptySet()), is_pr: false }] } : e))
    );
  }
  function removeSet(ei: number, si: number) {
    setExercises((cur) => cur.map((e, idx) => (idx === ei ? { ...e, sets: e.sets.filter((_, sidx) => sidx !== si) } : e)));
  }

  function tsFromTime(t: string): string | null {
    if (!t) return null;
    return new Date(`${date}T${t}:00`).toISOString();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError(t("form.errName")); return; }
    setSaving(true);

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { setError(t("form.errSession")); setSaving(false); return; }

    const workoutPayload = {
      user_id: uid,
      name: name.trim(),
      workout_date: date,
      start_time: tsFromTime(startTime),
      end_time: tsFromTime(endTime),
      duration_minutes: effectiveDuration,
      workout_type: type,
      muscle_groups: muscles,
      calories_burned: num(calories),
      difficulty: difficulty || null,
      energy_before: energy,
      mood_after: mood || null,
      notes: notes.trim() || null,
      location: location.trim() || null,
      completed,
      body_weight: inputToKg(bodyWeight),
    };

    try {
      let workoutId = initial?.id;
      if (isEdit && workoutId) {
        const { error: upErr } = await supabase.from("workouts").update(workoutPayload).eq("id", workoutId);
        if (upErr) throw upErr;
        // Replace child exercises for simplicity/consistency
        await supabase.from("exercises").delete().eq("workout_id", workoutId);
      } else {
        const { data: ins, error: insErr } = await supabase.from("workouts").insert(workoutPayload).select("id").single();
        if (insErr) throw insErr;
        workoutId = ins.id;
      }

      // Insert exercises + sets
      const cleanExercises = exercises.filter((ex) => ex.name.trim());
      for (let i = 0; i < cleanExercises.length; i++) {
        const ex = cleanExercises[i];
        const { data: exRow, error: exErr } = await supabase
          .from("exercises")
          .insert({
            workout_id: workoutId,
            name: ex.name.trim(),
            position: i,
            is_pr: ex.is_pr,
            distance_km: num(ex.distance_km),
            duration_seconds: num(ex.duration_seconds),
            notes: ex.notes.trim() || null,
          })
          .select("id")
          .single();
        if (exErr) throw exErr;

        const setsPayload = ex.sets
          .filter((s) => s.reps || s.weight || s.distance_km || s.duration_seconds)
          .map((s, si) => ({
            exercise_id: exRow.id,
            set_number: si + 1,
            reps: num(s.reps),
            weight: inputToKg(s.weight),
            distance_km: num(s.distance_km),
            duration_seconds: num(s.duration_seconds),
            rest_seconds: num(s.rest_seconds),
            is_pr: s.is_pr,
            completed: s.completed,
          }));
        if (setsPayload.length) {
          const { error: setErr } = await supabase.from("exercise_sets").insert(setsPayload);
          if (setErr) throw setErr;
        }
      }

      router.push(`/workouts/${workoutId}`);
      router.refresh();
    } catch (err: unknown) {
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
            <div className="flex flex-wrap gap-2">
              {WORKOUT_TEMPLATES.map((tpl) => {
                const active = name === t(`template.${tpl.key}`);
                return (
                  <button
                    type="button"
                    key={tpl.key}
                    onClick={() => applyTemplate(tpl)}
                    className={`chip px-3 py-1.5 ring-1 ring-inset transition ${
                      active ? "bg-brand-600 text-white ring-brand-600" : "bg-surface2 text-ink-600 ring-ink-200 hover:bg-ink-100"
                    }`}
                  >
                    <span>{tpl.icon}</span>{t(`template.${tpl.key}`)}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="label">{t("form.name")} *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder={t("form.namePlaceholder")} required />
          </div>
          <div>
            <label className="label">{t("form.date")} *</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="label">{t("form.location")}</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} className="input" placeholder={t("form.locationPlaceholder")} />
          </div>
          <div>
            <label className="label">{t("form.startTime")}</label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">{t("form.endTime")}</label>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">{t("form.duration")}{computedDuration != null && duration === "" ? ` · ${t("form.auto")}` : ""}</label>
            <input type="number" min="0" value={duration} onChange={(e) => setDuration(e.target.value)} className="input" placeholder={computedDuration != null ? String(computedDuration) : "60"} />
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
          <h2 className="text-lg font-bold text-ink-900">{t("form.exercises")}</h2>
          <button type="button" onClick={addExercise} className="btn-secondary">{t("form.addExercise")}</button>
        </div>

        {exercises.map((ex, ei) => (
          <div key={ei} className="card p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="mt-2 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700">{ei + 1}</span>
              <div className="flex-1 space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input list="common-exercises" value={ex.name} onChange={(e) => updateExercise(ei, { name: e.target.value })}
                    className="input flex-1" placeholder={t("form.exerciseNamePlaceholder")} />
                  <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm ring-1 ring-inset ring-ink-200">
                    <input type="checkbox" checked={ex.is_pr} onChange={(e) => updateExercise(ei, { is_pr: e.target.checked })}
                      className="h-4 w-4 rounded border-ink-300 text-amber-500 focus:ring-amber-400" />
                    <span className="font-semibold text-amber-600">★ {t("form.pr")}</span>
                  </label>
                  {exercises.length > 1 && (
                    <button type="button" onClick={() => removeExercise(ei)} className="btn-ghost px-2 text-ink-400 hover:text-red-500" aria-label="Remove exercise">
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

                {/* Sets table */}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[440px] text-sm">
                    <thead>
                      <tr className="text-start text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                        <th className="w-8 pb-1">#</th>
                        <th className="pb-1 pe-2 text-start">{t("form.reps")}</th>
                        <th className="pb-1 pe-2 text-start">{t("form.weight", { unit })}</th>
                        <th className="pb-1 pe-2 text-start">{t("form.restS")}</th>
                        {isCardio && <th className="pb-1 pe-2 text-start">{t("form.distShort")}</th>}
                        <th className="pb-1 pe-2 text-center">{t("form.pr")}</th>
                        <th className="pb-1"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {ex.sets.map((s, si) => (
                        <tr key={si}>
                          <td className="py-1 pe-2 font-semibold text-ink-400">{si + 1}</td>
                          <td className="py-1 pe-2"><input type="number" min="0" value={s.reps} onChange={(e) => updateSet(ei, si, { reps: e.target.value })} className="input px-2 py-1.5" placeholder="—" /></td>
                          <td className="py-1 pe-2"><input type="number" step="0.5" min="0" value={s.weight} onChange={(e) => updateSet(ei, si, { weight: e.target.value })} className="input px-2 py-1.5" placeholder="—" /></td>
                          <td className="py-1 pe-2"><input type="number" min="0" value={s.rest_seconds} onChange={(e) => updateSet(ei, si, { rest_seconds: e.target.value })} className="input px-2 py-1.5" placeholder="—" /></td>
                          {isCardio && <td className="py-1 pe-2"><input type="number" step="0.01" min="0" value={s.distance_km} onChange={(e) => updateSet(ei, si, { distance_km: e.target.value })} className="input px-2 py-1.5" placeholder="—" /></td>}
                          <td className="py-1 pe-2 text-center"><input type="checkbox" checked={s.is_pr} onChange={(e) => updateSet(ei, si, { is_pr: e.target.checked })} className="h-4 w-4 rounded border-ink-300 text-amber-500 focus:ring-amber-400" /></td>
                          <td className="py-1 text-end">{ex.sets.length > 1 && <button type="button" onClick={() => removeSet(ei, si)} className="text-ink-300 hover:text-red-500" aria-label="Remove set"><TrashIcon small /></button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="button" onClick={() => addSet(ei)} className="text-sm font-semibold text-brand-600 hover:text-brand-700">{t("form.addSet")}</button>

                <input value={ex.notes} onChange={(e) => updateExercise(ei, { notes: e.target.value })} className="input" placeholder={t("form.exerciseNotes")} />
              </div>
            </div>
          </div>
        ))}
        <datalist id="common-exercises">
          {COMMON_EXERCISES.map((n) => <option key={n} value={n} />)}
        </datalist>
      </section>

      {/* How it went */}
      <section className="card p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-ink-500">{t("form.howItWent")}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">{t("form.difficulty")}</label>
            <div className="flex flex-wrap gap-2">
              {DIFFICULTIES.map((d) => (
                <button type="button" key={d.value} onClick={() => setDifficulty(difficulty === d.value ? "" : d.value)}
                  className={`chip px-3 py-1.5 ring-1 ring-inset transition ${difficulty === d.value ? "bg-slate-800 text-white ring-slate-800 dark:bg-slate-200 dark:text-slate-900 dark:ring-slate-200" : "bg-surface2 text-ink-600 ring-ink-200 hover:bg-ink-100"}`}>
                  {t(`enum.difficulty.${d.value}`)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">{t("form.bodyWeight", { unit })}</label>
            <input type="number" step="0.1" min="0" value={bodyWeight} onChange={(e) => setBodyWeight(e.target.value)} className="input" placeholder="78.5" />
          </div>
          <div>
            <label className="label">{t("form.energyBefore")}</label>
            <div className="flex gap-2">
              {ENERGY_LEVELS.map((lvl) => (
                <button type="button" key={lvl} onClick={() => setEnergy(energy === lvl ? null : lvl)}
                  className={`h-10 flex-1 rounded-xl text-sm font-bold ring-1 ring-inset transition ${energy === lvl ? "bg-accent-500 text-white ring-accent-500" : "bg-surface2 text-ink-500 ring-ink-200 hover:bg-ink-100"}`}>
                  {lvl}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">{t("form.moodAfter")}</label>
            <div className="flex gap-2">
              {MOODS.map((m) => (
                <button type="button" key={m.value} onClick={() => setMood(mood === m.value ? "" : m.value)} title={t(`enum.mood.${m.value}`)}
                  className={`h-10 flex-1 rounded-xl text-lg ring-1 ring-inset transition ${mood === m.value ? "bg-brand-50 ring-brand-400" : "bg-surface2 ring-ink-200 hover:bg-ink-100 grayscale"}`}>
                  {m.emoji}
                </button>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="label">{t("form.notes")}</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="input" placeholder={t("form.notesPlaceholder")} />
          </div>
          <div className="sm:col-span-2">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-ink-100 px-4 py-3 ring-1 ring-inset ring-ink-200">
              <input type="checkbox" checked={completed} onChange={(e) => setCompleted(e.target.checked)} className="h-5 w-5 rounded border-ink-300 text-brand-600 focus:ring-brand-500" />
              <span className="text-sm font-semibold text-ink-800">{t("form.markCompleted")}</span>
            </label>
          </div>
        </div>
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

function toInputTime(ts: string): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function TrashIcon({ small = false }: { small?: boolean }) {
  const s = small ? 14 : 18;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  );
}
