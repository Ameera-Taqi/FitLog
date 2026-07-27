import Link from "next/link";
import type { Workout } from "@/lib/types";
import { workoutTypeMeta } from "@/lib/constants";
import { formatDate, formatDuration } from "@/lib/format";
import { getT } from "@/lib/i18n/server";

export async function WorkoutCard({ workout }: { workout: Workout }) {
  const { t } = await getT();
  const type = workoutTypeMeta(workout.workout_type);
  const exCount = workout.exercises?.length ?? 0;
  const setCount =
    workout.exercises?.reduce((s, e) => s + (e.exercise_sets?.length ?? 0), 0) ?? 0;
  const hasPR = workout.exercises?.some((e) => e.is_pr);
  const muscles = workout.muscle_groups ?? [];

  return (
    <Link
      href={`/workouts/${workout.id}`}
      className="card group block overflow-hidden transition hover:-translate-y-0.5 hover:shadow-cardhover"
    >
      <div className="relative h-28 bg-gradient-to-br from-brand-500/30 via-surface2 to-accent-500/20 sm:h-32">
        <div className="absolute inset-0 flex items-end justify-between p-3">
          <span className="rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
            {t(`enum.wtype.${workout.workout_type}`)}
          </span>
          {workout.duration_minutes != null && (
            <span className="rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
              {formatDuration(workout.duration_minutes)}
            </span>
          )}
        </div>
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl opacity-80 transition group-hover:scale-110">
          {type.icon}
        </span>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-bold text-ink-900">{workout.name}</h3>
            <p className="text-xs text-ink-500">{formatDate(workout.workout_date)}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {workout.completed ? (
              <span className="chip bg-brand-500/15 text-brand-400">{t("card.completed")}</span>
            ) : (
              <span className="chip bg-ink-100 text-ink-500">{t("card.inProgress")}</span>
            )}
            {hasPR && <span className="chip bg-amber-500/15 text-amber-400">★ PR</span>}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
          {exCount > 0 && (
            <span>
              {exCount} {exCount === 1 ? t("card.exercise") : t("card.exercises")} · {setCount} {t("card.sets")}
            </span>
          )}
          {workout.difficulty && <span>{t(`enum.difficulty.${workout.difficulty}`)}</span>}
        </div>

        {muscles.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {muscles.slice(0, 4).map((m) => (
              <span key={m} className="chip bg-ink-100 text-ink-600">{t(`enum.muscle.${m}`)}</span>
            ))}
            {muscles.length > 4 && (
              <span className="chip bg-ink-100 text-ink-500">+{muscles.length - 4}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
