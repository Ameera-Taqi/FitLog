"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function DeleteWorkoutButton({ workoutId }: { workoutId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function del() {
    setBusy(true);
    const { error } = await supabase.from("workouts").delete().eq("id", workoutId);
    if (error) {
      setBusy(false);
      alert(error.message);
      return;
    }
    router.push("/workouts");
    router.refresh();
  }

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="btn-danger">
        {t("common.delete")}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-ink-500">{t("del.sure")}</span>
      <button onClick={del} disabled={busy} className="btn-danger">{busy ? t("del.deleting") : t("del.yes")}</button>
      <button onClick={() => setConfirming(false)} className="btn-ghost">{t("common.cancel")}</button>
    </div>
  );
}
