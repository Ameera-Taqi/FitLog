import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WorkoutForm } from "@/components/WorkoutForm";
import { getMyUnit } from "@/lib/profile";
import { getT } from "@/lib/i18n/server";
import type { Workout } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditWorkoutPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("workouts")
    .select("*, exercises(*, exercise_sets(*))")
    .eq("id", id)
    .single();

  if (!data) notFound();
  const unit = await getMyUnit();
  const { t } = await getT();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href={`/workouts/${id}`} className="text-sm font-semibold text-ink-400 hover:text-ink-600">← {t("form.backToWorkout")}</Link>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink-900">{t("form.editTitle")}</h1>
      </div>
      <WorkoutForm initial={data as Workout} unit={unit} />
    </div>
  );
}
