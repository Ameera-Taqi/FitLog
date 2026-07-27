import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Workout } from "@/lib/types";
import { workoutTypeMeta, moodMeta } from "@/lib/constants";
import { formatDate, formatDuration, formatSeconds, timeFromTimestamp, totalVolume, formatWeight, kgToUnit } from "@/lib/format";
import { getMyUnit } from "@/lib/profile";
import { getT } from "@/lib/i18n/server";
import { DeleteWorkoutButton } from "@/components/DeleteWorkoutButton";
import { PhotoManager, type PhotoItem } from "@/components/PhotoManager";

export const dynamic = "force-dynamic";

export default async function WorkoutDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("workouts")
    .select("*, exercises(*, exercise_sets(*)), progress_photos(*)")
    .eq("id", id)
    .single();

  if (!data) notFound();
  const w = data as Workout;
  const unit = await getMyUnit();
  const { t } = await getT();
  const type = workoutTypeMeta(w.workout_type);
  const exercises = (w.exercises ?? []).slice().sort((a, b) => a.position - b.position);
  const volume = totalVolume(exercises);
  const volumeDisplay = volume ? `${Math.round(kgToUnit(volume, unit)).toLocaleString()} ${unit}` : "—";
  const totalSets = exercises.reduce((s, e) => s + (e.exercise_sets?.length ?? 0), 0);
  const mood = moodMeta(w.mood_after);

  // Signed URLs for private progress photos
  const photos: PhotoItem[] = [];
  for (const p of w.progress_photos ?? []) {
    const { data: signed } = await supabase.storage.from("progress-photos").createSignedUrl(p.storage_path, 60 * 60);
    if (signed?.signedUrl) photos.push({ id: p.id, storage_path: p.storage_path, url: signed.signedUrl });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/workouts" className="text-sm font-semibold text-ink-400 hover:text-ink-600">← {t("detail.back")}</Link>
      </div>

      {/* Header */}
      <div className="card overflow-hidden">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-50 text-3xl">{type.icon}</span>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-ink-900 sm:text-2xl">{w.name}</h1>
              <p className="text-sm text-ink-500">
                {formatDate(w.workout_date)}
                {w.location ? ` · ${w.location}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="chip bg-brand-50 text-brand-700">{t(`enum.wtype.${w.workout_type}`)}</span>
                {w.completed ? (
                  <span className="chip bg-brand-50 text-brand-700">{t("detail.completed")}</span>
                ) : (
                  <span className="chip bg-ink-100 text-ink-500">{t("detail.inProgress")}</span>
                )}
                {exercises.some((e) => e.is_pr) && <span className="chip bg-amber-50 text-amber-600">{t("detail.prSession")}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/workouts/${w.id}/edit`} className="btn-secondary">{t("common.edit")}</Link>
            <DeleteWorkoutButton workoutId={w.id} />
          </div>
        </div>

        {/* Quick stats bar */}
        <div className="grid grid-cols-2 divide-ink-100 border-t border-ink-100 sm:grid-cols-4 sm:divide-x rtl:sm:divide-x-reverse">
          <Stat label={t("detail.duration")} value={formatDuration(w.duration_minutes)} />
          <Stat label={t("detail.exercises")} value={`${exercises.length} · ${totalSets} ${t("detail.sets")}`} />
          <Stat label={t("detail.volume")} value={volumeDisplay} />
          <Stat label={t("detail.calories")} value={w.calories_burned != null ? `${w.calories_burned}` : "—"} />
        </div>
      </div>

      {/* Muscle groups */}
      {(w.muscle_groups ?? []).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(w.muscle_groups ?? []).map((m) => (
            <span key={m} className="chip bg-surface2 text-ink-700 ring-1 ring-inset ring-ink-200">{t(`enum.muscle.${m}`)}</span>
          ))}
        </div>
      )}

      {/* Exercises */}
      <section className="space-y-3">
        <h2 className="text-lg font-black uppercase tracking-tight text-ink-900">{t("detail.exercises")}</h2>
        {exercises.length === 0 ? (
          <p className="card p-5 text-sm text-ink-400">{t("detail.noExercises")}</p>
        ) : (
          exercises.map((ex, i) => {
            const sets = (ex.exercise_sets ?? []).slice().sort((a, b) => a.set_number - b.set_number);
            return (
              <div key={ex.id ?? i} className={`card p-4 sm:p-5 ${ex.completed ? "ring-2 ring-brand-500/60" : ""}`}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold ${ex.completed ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700"}`}>
                      {ex.completed ? "✓" : i + 1}
                    </span>
                    <h3 className="font-bold text-ink-900">{ex.name}</h3>
                    {ex.is_pr && <span className="chip bg-amber-50 text-amber-600">★ PR</span>}
                    {ex.difficulty && <span className="chip bg-surface2 text-ink-600 ring-1 ring-inset ring-ink-200">{t(`enum.difficulty.${ex.difficulty}`)}</span>}
                    {ex.completed && <span className="chip bg-brand-50 text-brand-700">✓ {t("form.completed")}</span>}
                  </div>
                  {(ex.distance_km != null || ex.duration_seconds != null) && (
                    <span className="text-xs text-ink-500">
                      {ex.distance_km != null ? `${ex.distance_km} km` : ""}
                      {ex.distance_km != null && ex.duration_seconds != null ? " · " : ""}
                      {ex.duration_seconds != null ? formatSeconds(ex.duration_seconds) : ""}
                    </span>
                  )}
                </div>
                {sets.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[360px] text-sm">
                      <thead>
                        <tr className="text-start text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                          <th className="pb-1 pe-3 text-start">{t("detail.set")}</th>
                          <th className="pb-1 pe-3 text-start">{t("detail.reps")}</th>
                          <th className="pb-1 pe-3 text-start">{t("detail.weight")}</th>
                          <th className="pb-1 pe-3 text-start">{t("detail.rest")}</th>
                          {ex.distance_km != null && <th className="pb-1 pe-3 text-start">{t("detail.distance")}</th>}
                          <th className="pb-1"></th>
                        </tr>
                      </thead>
                      <tbody className="tabular-nums">
                        {sets.map((s) => (
                          <tr key={s.id} className="border-t border-ink-50">
                            <td className="py-1.5 pe-3 font-semibold text-ink-400">{s.set_number}</td>
                            <td className="py-1.5 pe-3">{s.reps ?? "—"}</td>
                            <td className="py-1.5 pe-3">{formatWeight(s.weight, unit)}</td>
                            <td className="py-1.5 pe-3">{s.rest_seconds != null ? `${s.rest_seconds}s` : "—"}</td>
                            {ex.distance_km != null && <td className="py-1.5 pe-3">{s.distance_km != null ? `${s.distance_km} km` : "—"}</td>}
                            <td className="py-1.5 text-end">{s.is_pr && <span className="chip bg-amber-50 text-amber-600">★</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {ex.notes && <p className="mt-2 text-sm text-ink-500">{ex.notes}</p>}
              </div>
            );
          })
        )}
      </section>

      {/* How it went */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-500">{t("detail.sessionDetails")}</h3>
          <dl className="space-y-2 text-sm">
            <Row label={t("detail.start")} value={timeFromTimestamp(w.start_time) || "—"} />
            <Row label={t("detail.end")} value={timeFromTimestamp(w.end_time) || "—"} />
            <Row label={t("form.difficulty")} value={w.difficulty ? t(`enum.difficulty.${w.difficulty}`) : "—"} />
            <Row label={t("detail.energyBefore")} value={w.energy_before != null ? `${w.energy_before}/5` : "—"} />
            <Row label={t("detail.moodAfter")} value={mood ? `${mood.emoji} ${t(`enum.mood.${mood.value}`)}` : "—"} />
            <Row label={t("detail.bodyWeight")} value={formatWeight(w.body_weight, unit)} />
          </dl>
        </div>
        <div className="card p-5">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-500">{t("detail.notes")}</h3>
          <p className="whitespace-pre-wrap text-sm text-ink-600">{w.notes || t("detail.noNotes")}</p>
        </div>
      </section>

      <PhotoManager workoutId={w.id} initial={photos} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-ink-900">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-500">{label}</dt>
      <dd className="font-semibold text-ink-800">{value}</dd>
    </div>
  );
}
