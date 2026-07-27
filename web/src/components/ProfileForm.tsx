"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { UNIT_OPTIONS, SEX_OPTIONS, FITNESS_GOALS } from "@/lib/constants";
import type { Profile, UnitPreference, Sex, FitnessGoal } from "@/lib/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

function num(s: string): number | null {
  if (s === "" || s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function ProfileForm({ initial, email }: { initial: Profile | null; email: string }) {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useI18n();

  const [displayName, setDisplayName] = useState(initial?.display_name ?? "");
  const [unit, setUnit] = useState<UnitPreference>(initial?.unit_preference ?? "kg");
  const [heightCm, setHeightCm] = useState(initial?.height_cm?.toString() ?? "");
  const [dob, setDob] = useState(initial?.date_of_birth ?? "");
  const [sex, setSex] = useState<Sex | "">(initial?.sex ?? "");
  const [bodyWeight, setBodyWeight] = useState(initial?.body_weight_kg?.toString() ?? "");
  const [goal, setGoal] = useState<FitnessGoal | "">(initial?.fitness_goal ?? "");
  const [bio, setBio] = useState(initial?.bio ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      setError("Your session expired. Please sign in again.");
      setSaving(false);
      return;
    }

    const payload = {
      id: uid,
      display_name: displayName.trim() || null,
      unit_preference: unit,
      height_cm: num(heightCm),
      date_of_birth: dob || null,
      sex: sex || null,
      body_weight_kg: num(bodyWeight),
      fitness_goal: goal || null,
      bio: bio.trim() || null,
    };

    const { error: upErr } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
    if (upErr) {
      setError(upErr.message);
      setSaving(false);
      return;
    }

    setSaved(true);
    setSaving(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Account */}
      <section className="card p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-ink-500">{t("profile.account")}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">{t("profile.email")}</label>
            <input value={email} disabled className="input cursor-not-allowed bg-ink-100 text-ink-400" />
          </div>
          <div>
            <label className="label">{t("profile.displayName")}</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="input" />
          </div>
        </div>
      </section>

      {/* Preferences */}
      <section className="card p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-ink-500">{t("profile.preferences")}</h2>
        <div>
          <label className="label">{t("profile.weightUnits")}</label>
          <div className="flex gap-2">
            {UNIT_OPTIONS.map((u) => (
              <button
                type="button"
                key={u.value}
                onClick={() => setUnit(u.value)}
                className={`chip px-4 py-2 ring-1 ring-inset transition ${
                  unit === u.value ? "bg-brand-600 text-white ring-brand-600" : "bg-surface2 text-ink-600 ring-ink-200 hover:bg-ink-100"
                }`}
              >
                {t(`enum.unit.${u.value}`)}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-400">
            {t("profile.unitsHint")}
          </p>
        </div>
      </section>

      {/* About you */}
      <section className="card p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-ink-500">{t("profile.aboutYou")}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">{t("profile.height")}</label>
            <input type="number" step="0.1" min="0" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} className="input" placeholder="178" />
          </div>
          <div>
            <label className="label">{t("profile.currentBodyWeight")}</label>
            <input type="number" step="0.1" min="0" value={bodyWeight} onChange={(e) => setBodyWeight(e.target.value)} className="input" placeholder="81.5" />
          </div>
          <div>
            <label className="label">{t("profile.dob")}</label>
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">{t("profile.sex")}</label>
            <select value={sex} onChange={(e) => setSex(e.target.value as Sex | "")} className="input">
              <option value="">{t("profile.preferNotToSay")}</option>
              {SEX_OPTIONS.filter((s) => s.value !== "prefer_not_to_say").map((s) => (
                <option key={s.value} value={s.value}>{t(`enum.sex.${s.value}`)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className="label">{t("profile.primaryGoal")}</label>
          <div className="flex flex-wrap gap-2">
            {FITNESS_GOALS.map((g) => (
              <button
                type="button"
                key={g.value}
                onClick={() => setGoal(goal === g.value ? "" : g.value)}
                className={`chip px-3 py-1.5 ring-1 ring-inset transition ${
                  goal === g.value ? "bg-accent-500 text-white ring-accent-500" : "bg-surface2 text-ink-600 ring-ink-200 hover:bg-ink-100"
                }`}
              >
                <span>{g.icon}</span>{t(`enum.goal.${g.value}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <label className="label">{t("profile.bio")}</label>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="input" placeholder={t("profile.bioPlaceholder")} />
        </div>
      </section>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">{error}</p>}

      <div className="sticky bottom-16 z-20 flex items-center gap-3 sm:bottom-0">
        <button type="submit" disabled={saving} className="btn-primary shadow-lg">
          {saving ? t("common.saving") : t("profile.saveProfile")}
        </button>
        {saved && <span className="text-sm font-semibold text-brand-600">{t("profile.saved")}</span>}
      </div>
    </form>
  );
}
