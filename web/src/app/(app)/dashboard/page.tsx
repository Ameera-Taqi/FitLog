import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatTile } from "@/components/StatTile";
import { WeeklyBars, type WeekBar } from "@/components/WeeklyBars";
import { WorkoutCard } from "@/components/WorkoutCard";
import type { Workout } from "@/lib/types";
import { totalVolume, formatVolume, formatDuration } from "@/lib/format";
import { getMyUnit, getMyProfile } from "@/lib/profile";
import { getT } from "@/lib/i18n/server";
import { workoutTypeMeta } from "@/lib/constants";
import { fetchWorkoutPhotoHeroMap } from "@/lib/workout-hero";

export const dynamic = "force-dynamic";

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const [{ data }, { data: userData }] = await Promise.all([
    supabase
      .from("workouts")
      .select("*, exercises(*, exercise_sets(*)), progress_photos(id, storage_path, created_at)")
      .order("workout_date", { ascending: false })
      .limit(300),
    supabase.auth.getUser(),
  ]);

  const workouts = (data ?? []) as Workout[];
  const unit = await getMyUnit();
  const { t } = await getT();
  const photoHeroMap = await fetchWorkoutPhotoHeroMap(supabase, workouts);
  const email = userData.user?.email ?? "";
  const profile = await getMyProfile();
  const displayName = profile?.display_name?.trim() || email.split("@")[0] || "Athlete";

  const now = new Date();
  const weekStart = startOfWeek(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayStr = now.toISOString().slice(0, 10);

  const totalWorkouts = workouts.length;
  const completed = workouts.filter((w) => {
    if (w.completed) return true;
    const exs = w.exercises ?? [];
    return exs.length > 0 && exs.every((e) => e.completed);
  }).length;
  const thisWeekWorkouts = workouts.filter((w) => new Date(w.workout_date + "T00:00:00") >= weekStart);
  const calories = workouts.reduce((sum, w) => sum + (w.calories_burned ?? 0), 0);
  const caloriesThisWeek = thisWeekWorkouts.reduce((sum, w) => sum + (w.calories_burned ?? 0), 0);
  const volume = workouts.reduce((sum, w) => sum + totalVolume(w.exercises), 0);
  const volumeStat = formatVolume(volume, unit);
  const prsAllTime = workouts.reduce((sum, w) => sum + (w.exercises?.filter((e) => e.is_pr).length ?? 0), 0);
  const prsThisMonth = workouts
    .filter((w) => new Date(w.workout_date + "T00:00:00") >= monthStart)
    .reduce((sum, w) => sum + (w.exercises?.filter((e) => e.is_pr).length ?? 0), 0);

  const weeks: WeekBar[] = [];
  for (let i = 7; i >= 0; i--) {
    const ws = new Date(weekStart);
    ws.setDate(ws.getDate() - i * 7);
    const we = new Date(ws);
    we.setDate(we.getDate() + 7);
    const count = workouts.filter((w) => {
      const d = new Date(w.workout_date + "T00:00:00");
      return d >= ws && d < we;
    }).length;
    weeks.push({
      label: ws.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      fullLabel: ws.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      value: count,
    });
  }

  const todayWorkouts = workouts.filter((w) => w.workout_date === todayStr);
  const recent = workouts.slice(0, 4);
  const listForSheet = todayWorkouts.length > 0 ? todayWorkouts : recent;
  // Avoid showing the same sessions twice under the sheet and the card grid.
  const sheetIds = new Set(listForSheet.map((w) => w.id));
  const recentCards = recent.filter((w) => !sheetIds.has(w.id));
  // If filtering removed everything, fall back to next workouts after the sheet list.
  const gridWorkouts =
    recentCards.length > 0
      ? recentCards.slice(0, 4)
      : workouts.filter((w) => !sheetIds.has(w.id)).slice(0, 4);

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Welcome header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-lg font-bold text-white shadow-sm">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm text-ink-500">Welcome Back</p>
            <h1 className="text-xl font-extrabold tracking-tight text-ink-900 sm:text-2xl capitalize">
              {displayName}
            </h1>
          </div>
        </div>
        <Link href="/workouts/new" className="btn-primary sm:hidden">
          {t("dashboard.logWorkout")}
        </Link>
      </div>

      {/* Highlight stats — uniform cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={t("dashboard.totalWorkouts")}
          value={totalWorkouts}
          sub={t("dashboard.completed", { n: completed })}
          icon={<IconDumbbell />}
        />
        <StatTile
          label="Calories Burnt"
          value={calories.toLocaleString()}
          sub={t("dashboard.thisWeekCalories", { n: caloriesThisWeek.toLocaleString() })}
          accent="accent"
          icon={<IconFlame />}
        />
        <StatTile
          label={t("dashboard.totalVolume")}
          value={volumeStat.value}
          sub={volumeStat.sub}
          icon={<IconWeight />}
        />
        <StatTile
          label={t("dashboard.prsThisMonth")}
          value={prsThisMonth}
          sub={t("dashboard.allTimePrs", { n: prsAllTime })}
          accent="accent"
          icon={<IconTrophy />}
        />
      </div>

      {totalWorkouts > 0 ? (
        <div className="grid gap-4 lg:grid-cols-5 lg:items-stretch">
          <div className="lg:col-span-3">
            <WeeklyBars data={weeks} />
          </div>

          {/* Recent / today list — same dark card chrome as chart */}
          <div className="card flex flex-col p-5 sm:p-6 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-ink-900">
                {todayWorkouts.length > 0 ? "Today's Workouts" : t("dashboard.recentWorkouts")}
              </h2>
              <Link href="/workouts" className="text-sm font-semibold text-brand-500 hover:text-brand-400">
                {t("dashboard.viewAll")}
              </Link>
            </div>
            <div className="flex flex-1 flex-col gap-3">
              {listForSheet.slice(0, 5).map((w) => {
                const type = workoutTypeMeta(w.workout_type);
                const exCount = w.exercises?.length ?? 0;
                return (
                  <Link
                    key={w.id}
                    href={`/workouts/${w.id}`}
                    className="flex items-center gap-3 rounded-2xl bg-surface2 p-3 ring-1 ring-ink-100 transition hover:ring-brand-500/30"
                  >
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ink-100 text-xl">
                      {type.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-ink-900">{w.name}</p>
                      <p className="text-xs text-ink-500">
                        {exCount} {exCount === 1 ? t("card.exercise") : t("card.exercises")}
                        {w.duration_minutes != null ? ` · ${formatDuration(w.duration_minutes)}` : ""}
                      </p>
                    </div>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-500 text-white">
                      <PlayIcon />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          {gridWorkouts.length > 0 && (
          <div className="lg:col-span-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-extrabold tracking-tight text-ink-900">{t("dashboard.recentWorkouts")}</h2>
              <Link href="/workouts" className="text-sm font-semibold text-brand-500 hover:text-brand-400">
                {t("dashboard.viewAll")}
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {gridWorkouts.map((w) => (
                <WorkoutCard
                  key={w.id}
                  workout={w}
                  heroImageUrl={photoHeroMap.get(w.id)}
                />
              ))}
            </div>
          </div>
          )}
        </div>
      ) : (
        <div className="card flex flex-col items-center gap-4 p-10 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-500/15 text-brand-400">
            <IconDumbbell />
          </div>
          <div>
            <h3 className="text-lg font-bold text-ink-900">{t("dashboard.noWorkoutsTitle")}</h3>
            <p className="mt-1 text-sm text-ink-500">{t("dashboard.noWorkoutsBody")}</p>
          </div>
          <Link href="/workouts/new" className="btn-primary">{t("dashboard.logFirst")}</Link>
        </div>
      )}
    </div>
  );
}

function IconDumbbell() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 6.5v11M4 9v6M17.5 6.5v11M20 9v6M6.5 12h11" />
    </svg>
  );
}
function IconFlame() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1.5-3-1 2.5-3 2.5-3 5a2.5 2.5 0 0 0 2 2.5z" />
      <path d="M12 2c1 3 2.5 4.5 2.5 7.5A4.5 4.5 0 1 1 7.4 15.1C6 13 6 10.5 8 8c0 2 1 3 2 3 .5-2 1.5-4.5 2-9z" />
    </svg>
  );
}
function IconWeight() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="3" /><path d="M6.5 22 8 10h8l1.5 12" />
    </svg>
  );
}
function IconTrophy() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M6 4h12v5a6 6 0 0 1-12 0zM9 20h6M12 15v5" />
    </svg>
  );
}
function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
