import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatTile } from "@/components/StatTile";
import { WeeklyBars, type WeekBar } from "@/components/WeeklyBars";
import { WorkoutCard } from "@/components/WorkoutCard";
import type { Workout } from "@/lib/types";
import { totalVolume, formatVolume } from "@/lib/format";
import { getMyUnit } from "@/lib/profile";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workouts")
    .select("*, exercises(*, exercise_sets(*)), progress_photos(id)")
    .order("workout_date", { ascending: false })
    .limit(300);

  const workouts = (data ?? []) as Workout[];
  const unit = await getMyUnit();
  const { t } = await getT();

  const now = new Date();
  const weekStart = startOfWeek(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const totalWorkouts = workouts.length;
  const completed = workouts.filter((w) => w.completed).length;
  const thisWeek = workouts.filter((w) => new Date(w.workout_date + "T00:00:00") >= weekStart).length;
  const volume = workouts.reduce((sum, w) => sum + totalVolume(w.exercises), 0);
  const volumeStat = formatVolume(volume, unit);
  const prsThisMonth = workouts
    .filter((w) => new Date(w.workout_date + "T00:00:00") >= monthStart)
    .reduce((sum, w) => sum + (w.exercises?.filter((e) => e.is_pr).length ?? 0), 0);

  // Weekly bars — last 8 weeks
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

  const recent = workouts.slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-ink-900">{t("dashboard.title")}</h1>
          <p className="text-sm text-ink-500">{t("dashboard.subtitle")}</p>
        </div>
        <Link href="/workouts/new" className="btn-primary sm:hidden">{t("dashboard.logWorkout")}</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label={t("dashboard.totalWorkouts")} value={totalWorkouts} sub={t("dashboard.completed", { n: completed })} icon={<IconDumbbell />} />
        <StatTile label={t("dashboard.thisWeek")} value={thisWeek} sub={t("dashboard.workoutsLogged")} accent="accent" icon={<IconCalendar />} />
        <StatTile label={t("dashboard.totalVolume")} value={volumeStat.value} sub={t("dashboard.volumeSub", { unit })} icon={<IconWeight />} />
        <StatTile label={t("dashboard.prsThisMonth")} value={prsThisMonth} sub={t("dashboard.personalRecords")} accent="accent" icon={<IconTrophy />} />
      </div>

      {totalWorkouts > 0 ? (
        <>
          <WeeklyBars data={weeks} />

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-black uppercase tracking-tight text-ink-900">{t("dashboard.recentWorkouts")}</h2>
              <Link href="/workouts" className="text-sm font-semibold text-brand-600 hover:text-brand-700">{t("dashboard.viewAll")}</Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {recent.map((w) => (
                <WorkoutCard key={w.id} workout={w} />
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="card flex flex-col items-center gap-4 p-10 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-500">
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 6.5v11M4 9v6M17.5 6.5v11M20 9v6M6.5 12h11" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
function IconWeight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="3" /><path d="M6.5 22 8 10h8l1.5 12" />
    </svg>
  );
}
function IconTrophy() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M6 4h12v5a6 6 0 0 1-12 0zM9 20h6M12 15v5" />
    </svg>
  );
}
