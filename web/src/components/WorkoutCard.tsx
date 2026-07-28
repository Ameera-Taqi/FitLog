import Link from "next/link";
import type { Workout } from "@/lib/types";
import { workoutTypeMeta } from "@/lib/constants";
import { formatDate, formatDuration } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { resolveHeroSrc } from "@/lib/workout-hero";

export async function WorkoutCard({
  workout,
  heroImageUrl,
}: {
  workout: Workout;
  /** Signed URL of the workout's progress photo, if any. */
  heroImageUrl?: string | null;
}) {
  const { t } = await getT();
  const type = workoutTypeMeta(workout.workout_type);
  const exCount = workout.exercises?.length ?? 0;
  const setCount =
    workout.exercises?.reduce((s, e) => s + (e.exercise_sets?.length ?? 0), 0) ?? 0;
  const hasPR = workout.exercises?.some((e) => e.is_pr);
  const muscles = workout.muscle_groups ?? [];
  const heroSrc = resolveHeroSrc(heroImageUrl);
  const hasUserPhoto = Boolean(heroImageUrl?.trim());

  return (
    <Link
      href={`/workouts/${workout.id}`}
      className="card group block overflow-hidden transition hover:-translate-y-0.5 hover:shadow-cardhover"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-[#12141A] sm:aspect-[16/9]">
        {hasUserPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroSrc}
            alt=""
            className="absolute inset-0 h-full w-full max-w-none object-cover object-top transition duration-300 group-hover:scale-[1.03]"
            style={{ objectFit: "cover", objectPosition: "center top" }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${heroSrc}?v=2`}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center scale-[1.14] transition duration-300 group-hover:scale-[1.18]"
          />
        )}
        {/* Soft edges keep overlays readable; subject stays centered in the safe area */}
        <div
          className={`pointer-events-none absolute inset-0 ${
            hasUserPhoto
              ? "bg-gradient-to-t from-black/65 via-black/10 to-black/15"
              : "bg-gradient-to-t from-black/55 via-transparent to-transparent"
          }`}
        />
        {/* Safe area guide for badges — bottom/corner overlays sit outside the visual focus */}
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-3">
          <span className="rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
            {t(`enum.wtype.${workout.workout_type}`)}
          </span>
          {workout.duration_minutes != null && (
            <span className="rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
              {formatDuration(workout.duration_minutes)}
            </span>
          )}
        </div>
        <span className="absolute end-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/35 text-lg backdrop-blur-sm">
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
