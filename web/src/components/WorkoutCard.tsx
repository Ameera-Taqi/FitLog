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
      className="card block p-4 transition hover:-translate-y-0.5 hover:shadow-cardhover"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-xl">
            {type.icon}
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-bold text-ink-900">{workout.name}</h3>
            <p className="text-xs text-ink-500">{formatDate(workout.workout_date)}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {workout.completed ? (
            <span className="chip bg-brand-50 text-brand-700">{t("card.completed")}</span>
          ) : (
            <span className="chip bg-ink-100 text-ink-500">{t("card.inProgress")}</span>
          )}
          {hasPR && <span className="chip bg-amber-50 text-amber-600">★ PR</span>}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
        <span className="font-semibold text-ink-700">{t(`enum.wtype.${workout.workout_type}`)}</span>
        {exCount > 0 && <span>{exCount} {exCount === 1 ? t("card.exercise") : t("card.exercises")} · {setCount} {t("card.sets")}</span>}
        {workout.duration_minutes != null && <span>{formatDuration(workout.duration_minutes)}</span>}
        {workout.difficulty && <span>{t(`enum.difficulty.${workout.difficulty}`)}</span>}
      </div>

      {muscles.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {muscles.slice(0, 5).map((m) => (
            <span key={m} className="chip bg-ink-100 text-ink-600">{t(`enum.muscle.${m}`)}</span>
          ))}
          {muscles.length > 5 && (
            <span className="chip bg-ink-100 text-ink-500">+{muscles.length - 5}</span>
          )}
        </div>
      )}
    </Link>
  );
}
