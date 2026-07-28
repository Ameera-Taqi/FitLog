import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/ProfileForm";
import type { Profile, Workout } from "@/lib/types";
import { getT } from "@/lib/i18n/server";
import { totalVolume } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data }, { data: workoutsData }, { t }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("workouts").select("*, exercises(*, exercise_sets(*))").limit(500),
    getT(),
  ]);

  const workouts = (workoutsData ?? []) as Workout[];
  const stats = {
    total: workouts.length,
    completed: workouts.filter((w) => w.completed).length,
    volume: workouts.reduce((s, w) => s + totalVolume(w.exercises), 0),
    prs: workouts.reduce((s, w) => s + (w.exercises?.filter((e) => e.is_pr).length ?? 0), 0),
    calories: workouts.reduce((s, w) => s + (w.calories_burned ?? 0), 0),
  };
  const name = (user.email ?? "Athlete").split("@")[0];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">{t("profile.title")}</h1>
        <p className="text-sm text-ink-500">Account & lifetime stats</p>
      </div>

      <div className="card flex flex-col items-center gap-3 p-6 text-center sm:p-8">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-2xl font-extrabold text-white">
          {name.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-lg font-extrabold capitalize text-ink-900">{name}</p>
          <p className="text-sm text-ink-500">{user.email}</p>
        </div>
      </div>

      <div className="sheet-panel rounded-3xl p-5 sm:p-6" style={{ color: "#12141A" }}>
        <h2 className="mb-4 text-lg font-extrabold">Lifetime Stats</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Workouts" value={stats.total} />
          <Stat label="Completed" value={stats.completed} />
          <Stat label="Volume (kg)" value={stats.volume.toLocaleString()} />
          <Stat label="PRs" value={stats.prs} />
          <Stat label="Calories" value={stats.calories.toLocaleString()} />
        </div>
      </div>

      <ProfileForm initial={(data as Profile) ?? null} email={user.email ?? ""} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-soft">
      <p className="text-2xl font-extrabold text-brand-500">{value}</p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-[#6B7280]">{label}</p>
    </div>
  );
}
