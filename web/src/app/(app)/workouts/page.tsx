import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FilterBar } from "@/components/FilterBar";
import { WorkoutCard } from "@/components/WorkoutCard";
import type { Workout } from "@/lib/types";
import { getT } from "@/lib/i18n/server";

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
  const pr = one(sp.pr) === "1";
  const from = one(sp.from);
  const to = one(sp.to);

  const supabase = await createClient();

  // Use an inner join on exercises only when filtering by exercise name or PR.
  const needsExerciseJoin = Boolean(exercise) || pr;
  const exerciseSelect = needsExerciseJoin
    ? "exercises!inner(*, exercise_sets(*))"
    : "exercises(*, exercise_sets(*))";

  let query = supabase
    .from("workouts")
    .select(`*, ${exerciseSelect}, progress_photos(id)`)
    .order("workout_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (search) query = query.ilike("name", `%${search}%`);
  if (type) query = query.eq("workout_type", type);
  if (difficulty) query = query.eq("difficulty", difficulty);
  if (location) query = query.ilike("location", `%${location}%`);
  if (muscle) query = query.contains("muscle_groups", [muscle]);
  if (status === "completed") query = query.eq("completed", true);
  if (status === "incomplete") query = query.eq("completed", false);
  if (from) query = query.gte("workout_date", from);
  if (to) query = query.lte("workout_date", to);
  if (exercise) query = query.ilike("exercises.name", `%${exercise}%`);
  if (pr) query = query.eq("exercises.is_pr", true);

  const { data, error } = await query.limit(200);
  const workouts = (data ?? []) as Workout[];
  const { t } = await getT();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">{t("workouts.title")}</h1>
          <p className="text-sm text-ink-500">
            {workouts.length} {workouts.length === 1 ? t("workouts.session") : t("workouts.sessions")}
          </p>
        </div>
        <Link href="/workouts/new" className="btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          {t("nav.newWorkout")}
        </Link>
      </div>

      <FilterBar />

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
          {t("workouts.loadError")} {error.message}
        </p>
      )}

      {workouts.length === 0 ? (
        <div className="card p-10 text-center text-ink-500">
          {t("workouts.noMatch")}{" "}
          <Link href="/workouts" className="font-semibold text-brand-600">{t("workouts.clearThem")}</Link>.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {workouts.map((w) => (
            <WorkoutCard key={w.id} workout={w} />
          ))}
        </div>
      )}
    </div>
  );
}
