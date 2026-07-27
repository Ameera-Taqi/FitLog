import Link from "next/link";
import { WorkoutForm } from "@/components/WorkoutForm";
import { getMyUnit } from "@/lib/profile";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function NewWorkoutPage() {
  const unit = await getMyUnit();
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href="/workouts" className="text-sm font-semibold text-ink-400 hover:text-ink-600">← {t("detail.back")}</Link>
        <h1 className="mt-1 text-2xl font-black uppercase tracking-tight text-ink-900">{t("form.newTitle")}</h1>
        <p className="text-sm text-ink-500">{t("form.newSubtitle")}</p>
      </div>
      <WorkoutForm unit={unit} />
    </div>
  );
}
