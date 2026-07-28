import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Workout } from "@/lib/types";
import { workoutTypeMeta } from "@/lib/constants";
import { formatDate, formatDuration, formatSeconds, totalVolume, formatWeight, kgToUnit } from "@/lib/format";
import { getMyUnit } from "@/lib/profile";
import { getT } from "@/lib/i18n/server";
import { DeleteWorkoutButton } from "@/components/DeleteWorkoutButton";
import { ExerciseCompleteToggle } from "@/components/ExerciseCompleteToggle";
import { PhotoManager, type PhotoItem } from "@/components/PhotoManager";

export const dynamic = "force-dynamic";

function ProgressRing({ pct }: { pct: number }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = c - (clamped / 100) * c;
  return (
    <div className="relative mx-auto h-44 w-44 sm:h-52 sm:w-52">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="12" />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FF8A6B" />
            <stop offset="100%" stopColor="#FF6B4E" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className="text-4xl font-extrabold text-white sm:text-5xl">{clamped}%</p>
        <p className="mt-1 max-w-[8rem] text-xs text-white/70">Of workout completed!</p>
      </div>
    </div>
  );
}

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
  const doneExercises = exercises.filter((e) => e.completed).length;
  const pct =
    exercises.length > 0
      ? Math.round((doneExercises / exercises.length) * 100)
      : w.completed
        ? 100
        : 0;

  const avgRest =
    (() => {
      const rests = exercises.flatMap((e) => (e.exercise_sets ?? []).map((s) => s.rest_seconds).filter((n): n is number => n != null));
      if (!rests.length) return null;
      return Math.round(rests.reduce((a, b) => a + b, 0) / rests.length);
    })();

  const photos: PhotoItem[] = [];
  for (const p of w.progress_photos ?? []) {
    const { data: signed } = await supabase.storage.from("progress-photos").createSignedUrl(p.storage_path, 60 * 60);
    if (signed?.signedUrl) photos.push({ id: p.id, storage_path: p.storage_path, url: signed.signedUrl });
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Dark insights hero */}
      <div className="overflow-hidden rounded-3xl bg-[#1E2128] text-white shadow-card">
        <div className="flex items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/workouts" className="text-sm font-semibold text-white/70 hover:text-white">
            ← {t("detail.back")}
          </Link>
          <h1 className="text-sm font-bold uppercase tracking-wide text-white/90 sm:text-base">Workout Insights</h1>
          <div className="flex items-center gap-2">
            <Link href={`/workouts/${w.id}/edit`} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/15">
              {t("common.edit")}
            </Link>
            <DeleteWorkoutButton workoutId={w.id} />
          </div>
        </div>

        <div className="px-4 pb-8 pt-2 sm:px-6">
          <p className="mb-4 text-center text-lg font-bold sm:text-xl">{w.name}</p>
          <ProgressRing pct={pct} />
          <p className="mt-3 text-center text-sm text-white/50">
            {formatDate(w.workout_date)}
            {w.location ? ` · ${w.location}` : ""} · {type.icon} {t(`enum.wtype.${w.workout_type}`)}
          </p>
        </div>

        {/* Light sheet */}
        <div className="rounded-t-[2rem] bg-[#F5F6F8] px-4 py-6 text-[#12141A] sm:px-6">
          <div className="mx-auto grid max-w-lg grid-cols-2 gap-3 sm:max-w-none sm:grid-cols-4">
            <InsightStat icon={<FlameIcon />} value={w.calories_burned != null ? `${w.calories_burned} Cal` : "—"} label="Calories Burnt" />
            <InsightStat icon={<ClockIcon />} value={formatDuration(w.duration_minutes) || "—"} label="Time Taken" />
            <InsightStat icon={<HourglassIcon />} value={avgRest != null ? `${avgRest}s` : "—"} label="Average Rest" />
            <InsightStat icon={<SetsIcon />} value={`${totalSets} Set`} label="Exercises Performed" />
          </div>

          <div className="mt-8">
            <h2 className="text-lg font-extrabold">{t("detail.exercises")} Insights</h2>
            <div className="mt-3 space-y-3">
              {exercises.length === 0 ? (
                <p className="rounded-2xl bg-white p-5 text-sm text-[#6B7280] shadow-soft">{t("detail.noExercises")}</p>
              ) : (
                exercises.map((ex, i) => {
                  const sets = (ex.exercise_sets ?? []).slice().sort((a, b) => a.set_number - b.set_number);
                  const maxWeight = Math.max(0, ...sets.map((s) => s.weight ?? 0));
                  const siblings = exercises
                    .filter((other) => other.id !== ex.id)
                    .map((other) => Boolean(other.completed));
                  return (
                    <div
                      key={ex.id ?? i}
                      className={`rounded-2xl bg-white p-4 shadow-soft transition ${ex.completed ? "ring-2 ring-brand-500/50" : ""}`}
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h3 className="font-bold">
                          Exercise {i + 1} — {ex.name}
                          {ex.is_pr ? " ★" : ""}
                        </h3>
                        {ex.id ? (
                          <ExerciseCompleteToggle
                            key={`${ex.id}-${ex.completed ? "1" : "0"}`}
                            exerciseId={ex.id}
                            workoutId={w.id}
                            initialCompleted={Boolean(ex.completed)}
                            siblingCompleted={siblings}
                          />
                        ) : null}
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="flex items-center gap-3 rounded-2xl bg-[#2A2D36] px-3 py-3 text-white">
                          <span className="text-sky-400"><DumbbellMini /></span>
                          <div>
                            <p className="text-sm font-bold">{maxWeight ? `${formatWeight(maxWeight, unit)}` : "—"}</p>
                            <p className="text-[11px] text-white/50">Weight Lifted</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 rounded-2xl bg-[#2A2D36] px-3 py-3 text-white">
                          <span className="text-amber-400">★</span>
                          <div>
                            <p className="text-sm font-bold">{volumeDisplay}</p>
                            <p className="text-[11px] text-white/50">Session Volume</p>
                          </div>
                        </div>
                      </div>
                      {sets.length > 0 && (
                        <div className="mt-3 overflow-x-auto">
                          <table className="w-full min-w-[320px] text-sm">
                            <thead>
                              <tr className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
                                <th className="pb-1 pe-3 text-start">{t("detail.set")}</th>
                                <th className="pb-1 pe-3 text-start">{t("detail.reps")}</th>
                                <th className="pb-1 pe-3 text-start">{t("detail.weight")}</th>
                                <th className="pb-1 text-start">{t("detail.rest")}</th>
                              </tr>
                            </thead>
                            <tbody className="tabular-nums">
                              {sets.map((s) => (
                                <tr key={s.id} className="border-t border-[#EEE]">
                                  <td className="py-1.5 pe-3 font-semibold text-[#9CA3AF]">{s.set_number}</td>
                                  <td className="py-1.5 pe-3">{s.reps ?? "—"}</td>
                                  <td className="py-1.5 pe-3">{formatWeight(s.weight, unit)}</td>
                                  <td className="py-1.5">{s.rest_seconds != null ? `${s.rest_seconds}s` : "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {(ex.distance_km != null || ex.duration_seconds != null) && (
                        <p className="mt-2 text-xs text-[#6B7280]">
                          {ex.distance_km != null ? `${ex.distance_km} km` : ""}
                          {ex.distance_km != null && ex.duration_seconds != null ? " · " : ""}
                          {ex.duration_seconds != null ? formatSeconds(ex.duration_seconds) : ""}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-6">
            <PhotoManager workoutId={w.id} initial={photos} />
          </div>
        </div>
      </div>
    </div>
  );
}

function InsightStat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-white p-4 text-center shadow-soft">
      <span className="mb-2 text-brand-500">{icon}</span>
      <p className="text-lg font-extrabold text-brand-500 sm:text-xl">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium text-[#6B7280]">{label}</p>
    </div>
  );
}

function FlameIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2c1 3 2.5 4.5 2.5 7.5A4.5 4.5 0 1 1 7.4 15.1C6 13 6 10.5 8 8c0 2 1 3 2 3 .5-2 1.5-4.5 2-9z" /></svg>
  );
}
function ClockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
  );
}
function HourglassIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2h12M6 22h12M8 2v4l4 4 4-4V2M8 22v-4l4-4 4 4v4" /></svg>
  );
}
function SetsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6.5 6.5v11M4 9v6M17.5 6.5v11M20 9v6M6.5 12h11" /></svg>
  );
}
function DumbbellMini() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6.5 6.5v11M4 9v6M17.5 6.5v11M20 9v6M6.5 12h11" /></svg>
  );
}
