"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  exerciseId: string;
  workoutId: string;
  initialCompleted: boolean;
  /** Other exercises' completed flags (excluding this one) — used to derive workout status */
  siblingCompleted: boolean[];
};

export function ExerciseCompleteToggle({
  exerciseId,
  workoutId,
  initialCompleted,
  siblingCompleted,
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useI18n();
  const [completed, setCompleted] = useState(initialCompleted);
  const [pending, startTransition] = useTransition();

  async function toggle() {
    const next = !completed;
    setCompleted(next);

    const { error } = await supabase.from("exercises").update({ completed: next }).eq("id", exerciseId);
    if (error) {
      setCompleted(!next);
      alert(error.message);
      return;
    }

    const allDone = next && siblingCompleted.every(Boolean);
    await supabase.from("workouts").update({ completed: allDone }).eq("id", workoutId);

    startTransition(() => router.refresh());
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold transition ${
        completed
          ? "bg-brand-500 text-white"
          : "bg-[#F0F1F3] text-[#6B7280] hover:bg-[#E8E9ED]"
      } ${pending ? "opacity-60" : ""}`}
      aria-pressed={completed}
    >
      <span
        className={`grid h-4 w-4 place-items-center rounded border-2 text-[10px] leading-none ${
          completed ? "border-white bg-white text-brand-500" : "border-[#9CA3AF]"
        }`}
      >
        {completed ? "✓" : ""}
      </span>
      {t("form.completed")}
    </button>
  );
}
