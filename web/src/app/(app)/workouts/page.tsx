import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FilterBar } from "@/components/FilterBar";
import { WorkoutCard } from "@/components/WorkoutCard";
import type { Workout } from "@/lib/types";
import { getT } from "@/lib/i18n/server";
import { fetchWorkoutPhotoHeroMap } from "@/lib/workout-hero";

export const dynamic = "force-dynamic";

type SP = { [key: string]: string | string[] | undefined };

function one(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] ?? "" : v ?? "";
}

export default async function WorkoutsPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const sp = searchParams;
  const search = one(sp.search);
  const exercise = one(sp.exercise);
  const type = one(sp.type);
  const muscle = one(sp.muscle);
  const difficulty = one(sp.difficulty);
  const location = one(sp.location);
  const status = one(sp.status);
  const tab = one(sp.tab) || "explore";
  const pr = one(sp.pr) === "1";
  const from = one(sp.from);
  const to = one(sp.to);

  const supabase = await createClient();

  const needsExerciseJoin = Boolean(exercise) || pr;
  const exerciseSelect = needsExerciseJoin
    ? "exercises!inner(*, exercise_sets(*))"
    : "exercises(*, exercise_sets(*))";

  let query = supabase
    .from("workouts")
    .select(`*, ${exerciseSelect}, progress_photos(id, storage_path, created_at)`)
    .order("workout_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (search) query = query.ilike("name", `%${search}%`);
  if (type) query = query.eq("workout_type", type);
  if (difficulty) query = query.eq("difficulty", difficulty);
  if (location) query = query.ilike("location", `%${location}%`);
  if (muscle) query = query.contains("muscle_groups", [muscle]);
  if (status === "completed" || tab === "yours") query = query.eq("completed", true);
  if (status === "incomplete") query = query.eq("completed", false);
  if (from) query = query.gte("workout_date", from);
  if (to) query = query.lte("workout_date", to);
  if (exercise) query = query.ilike("exercises.name", `%${exercise}%`);
  if (pr) query = query.eq("exercises.is_pr", true);

  const { data, error } = await query.limit(200);
  // Guard against accidental duplicate rows in the response.
  const seen = new Set<string>();
  const workouts = ((data ?? []) as Workout[])
    .filter((w) => {
      if (!w?.id || seen.has(w.id)) return false;
      seen.add(w.id);
      return true;
    })
    .sort((a, b) => {
      const byDate = (b.workout_date ?? "").localeCompare(a.workout_date ?? "");
      if (byDate !== 0) return byDate;
      return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    });
  const photoHeroMap = await fetchWorkoutPhotoHeroMap(supabase, workouts);
  const { t } = await getT();

  const weekStart = (() => {
    const x = new Date();
    const day = (x.getDay() + 6) % 7;
    x.setDate(x.getDate() - day);
    x.setHours(0, 0, 0, 0);
    return x;
  })();
  const weekCount = workouts.filter((w) => new Date(w.workout_date + "T00:00:00") >= weekStart).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-500/15 text-brand-400">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6.5 6.5v11M4 9v6M17.5 6.5v11M20 9v6M6.5 12h11" /></svg>
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">Workout Plans</h1>
            <p className="text-sm text-ink-500">
              {workouts.length} {workouts.length === 1 ? t("workouts.session") : t("workouts.sessions")} · {weekCount} this week
            </p>
          </div>
        </div>
        <Link href="/workouts/new" className="btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          {t("nav.newWorkout")}
        </Link>
      </div>

      <div className="flex gap-6 border-b border-ink-200">
        <Link
          href="/workouts?tab=explore"
          className={`pb-3 text-sm font-semibold ${tab !== "yours" ? "border-b-2 border-ink-900 text-ink-900" : "text-ink-400"}`}
        >
          Explore
        </Link>
        <Link
          href="/workouts?tab=yours"
          className={`pb-3 text-sm font-semibold ${tab === "yours" ? "border-b-2 border-ink-900 text-ink-900" : "text-ink-400"}`}
        >
          Your Plans
        </Link>
      </div>

      <FilterBar />

      {error && (
        <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-400 ring-1 ring-red-500/20">
          {t("workouts.loadError")} {error.message}
        </p>
      )}

      {workouts.length === 0 ? (
        <div className="card p-10 text-center text-ink-500">
          {t("workouts.noMatch")}{" "}
          <Link href="/workouts" className="font-semibold text-brand-500">{t("workouts.clearThem")}</Link>.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {workouts.map((w) => (
            <WorkoutCard
              key={w.id}
              workout={w}
              heroImageUrl={photoHeroMap.get(w.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
