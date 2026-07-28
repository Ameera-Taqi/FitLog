import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FilterBar } from "@/components/FilterBar";
import { WorkoutCard } from "@/components/WorkoutCard";
import { CalendarPlanner } from "@/components/CalendarPlanner";
import type { Workout, WorkoutSchedule } from "@/lib/types";
import { getT } from "@/lib/i18n/server";
import { fetchWorkoutPhotoHeroMap } from "@/lib/workout-hero";

export const dynamic = "force-dynamic";

type SP = { [key: string]: string | string[] | undefined };

function one(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] ?? "" : v ?? "";
}

function monthBounds(ym: string): { start: string; end: string; monthStart: string } {
  const [y, m] = ym.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { start, end, monthStart: start };
}

export default async function WorkoutsPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const sp = searchParams;
  const tab = one(sp.tab) || "explore";
  const isPlans = tab === "yours";
  const { t } = await getT();
  const supabase = await createClient();

  if (isPlans) {
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const month = one(sp.month) || defaultMonth;
    const { start, end, monthStart } = monthBounds(month.length === 7 ? month : defaultMonth);

    const [{ data: scheduleData, error: scheduleError }, { data: libraryData }] = await Promise.all([
      supabase
        .from("workout_schedules")
        .select("*, workouts(*)")
        .gte("scheduled_date", start)
        .lte("scheduled_date", end)
        .order("scheduled_date", { ascending: true }),
      supabase
        .from("workouts")
        .select("*, exercises(id)")
        .order("updated_at", { ascending: false })
        .limit(200),
    ]);

    const schedules = (scheduleData ?? []) as (WorkoutSchedule & { workouts: Workout | null })[];
    const library = (libraryData ?? []) as Workout[];
    const missingTable =
      Boolean(scheduleError?.message?.includes("workout_schedules")) ||
      Boolean(scheduleError?.message?.includes("schema cache"));

    return (
      <div className="space-y-5">
        <WorkoutsHeader
          title={t("workouts.title")}
          subtitle={t("calendar.subtitle")}
          newLabel={t("nav.newWorkout")}
        />
        <WorkoutsTabs tab="yours" />
        {missingTable && (
          <div className="rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-200 ring-1 ring-amber-500/30">
            Calendar needs a one-time database setup. In Supabase → SQL Editor, run the file{" "}
            <code className="font-semibold">database/workout_schedules.sql</code>, then refresh this page.
          </div>
        )}
        <CalendarPlanner
          embedded
          initialMonth={monthStart}
          initialSchedules={schedules}
          library={library}
        />
      </div>
    );
  }

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
  if (status === "completed") query = query.eq("completed", true);
  if (status === "incomplete") query = query.eq("completed", false);
  if (from) query = query.gte("workout_date", from);
  if (to) query = query.lte("workout_date", to);
  if (exercise) query = query.ilike("exercises.name", `%${exercise}%`);
  if (pr) query = query.eq("exercises.is_pr", true);

  const { data, error } = await query.limit(200);
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

  return (
    <div className="space-y-5">
      <WorkoutsHeader
        title={t("workouts.title")}
        subtitle={`${workouts.length} ${workouts.length === 1 ? t("workouts.session") : t("workouts.sessions")} · ${t("workouts.libraryHint")}`}
        newLabel={t("nav.newWorkout")}
      />
      <WorkoutsTabs tab="explore" />
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

function WorkoutsHeader({
  title,
  subtitle,
  newLabel,
}: {
  title: string;
  subtitle: string;
  newLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-500/15 text-brand-400">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6.5 6.5v11M4 9v6M17.5 6.5v11M20 9v6M6.5 12h11" /></svg>
        </span>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">{title}</h1>
          <p className="text-sm text-ink-500">{subtitle}</p>
        </div>
      </div>
      <Link href="/workouts/new" className="btn-primary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        {newLabel}
      </Link>
    </div>
  );
}

function WorkoutsTabs({ tab }: { tab: "explore" | "yours" }) {
  return (
    <div className="flex gap-6 border-b border-ink-200">
      <Link
        href="/workouts?tab=explore"
        className={`pb-3 text-sm font-semibold ${tab === "explore" ? "border-b-2 border-ink-900 text-ink-900" : "text-ink-400"}`}
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
  );
}
