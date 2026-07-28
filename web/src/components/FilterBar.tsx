"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { WORKOUT_TYPES, DIFFICULTIES, MUSCLE_GROUPS } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const get = (k: string) => params.get(k) ?? "";

  function apply(next: Record<string, string>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    startTransition(() => router.push(`${pathname}?${sp.toString()}`));
  }

  function reset() {
    startTransition(() => router.push(pathname));
  }

  const activeCount = [
    "type", "muscle", "difficulty", "location", "exercise", "status", "pr", "from", "to",
  ].filter((k) => params.get(k)).length;

  return (
    <div className="space-y-3">
      {/* Search row — pill style matching mobile */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-ink-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          </span>
          <input
            defaultValue={get("search")}
            onKeyDown={(e) => { if (e.key === "Enter") apply({ search: (e.target as HTMLInputElement).value }); }}
            onBlur={(e) => { if (e.target.value !== get("search")) apply({ search: e.target.value }); }}
            placeholder="Search"
            className="input rounded-full ps-10"
          />
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className={`btn-secondary shrink-0 ${activeCount ? "ring-brand-500/40 text-brand-400" : ""}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
          {t("filter.filters")}{activeCount ? ` (${activeCount})` : ""}
        </button>
      </div>

      {open && (
        <div className="card mt-1 grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t("filter.exerciseName")}>
            <input
              defaultValue={get("exercise")}
              onBlur={(e) => { if (e.target.value !== get("exercise")) apply({ exercise: e.target.value }); }}
              onKeyDown={(e) => { if (e.key === "Enter") apply({ exercise: (e.target as HTMLInputElement).value }); }}
              placeholder={t("filter.exampleBench")}
              className="input"
            />
          </Field>

          <Field label={t("filter.workoutType")}>
            <select value={get("type")} onChange={(e) => apply({ type: e.target.value })} className="input">
              <option value="">{t("filter.allTypes")}</option>
              {WORKOUT_TYPES.map((wt) => <option key={wt.value} value={wt.value}>{t(`enum.wtype.${wt.value}`)}</option>)}
            </select>
          </Field>

          <Field label={t("filter.muscleGroup")}>
            <select value={get("muscle")} onChange={(e) => apply({ muscle: e.target.value })} className="input">
              <option value="">{t("filter.anyMuscle")}</option>
              {MUSCLE_GROUPS.map((m) => <option key={m} value={m}>{t(`enum.muscle.${m}`)}</option>)}
            </select>
          </Field>

          <Field label={t("filter.difficulty")}>
            <select value={get("difficulty")} onChange={(e) => apply({ difficulty: e.target.value })} className="input">
              <option value="">{t("filter.anyDifficulty")}</option>
              {DIFFICULTIES.map((d) => <option key={d.value} value={d.value}>{t(`enum.difficulty.${d.value}`)}</option>)}
            </select>
          </Field>

          <Field label={t("filter.location")}>
            <input
              defaultValue={get("location")}
              onBlur={(e) => { if (e.target.value !== get("location")) apply({ location: e.target.value }); }}
              onKeyDown={(e) => { if (e.key === "Enter") apply({ location: (e.target as HTMLInputElement).value }); }}
              placeholder={t("filter.exampleGym")}
              className="input"
            />
          </Field>

          <Field label={t("filter.status")}>
            <select value={get("status")} onChange={(e) => apply({ status: e.target.value })} className="input">
              <option value="">{t("filter.all")}</option>
              <option value="completed">{t("filter.completed")}</option>
              <option value="incomplete">{t("filter.incomplete")}</option>
            </select>
          </Field>

          <Field label={t("filter.fromDate")}>
            <input type="date" value={get("from")} onChange={(e) => apply({ from: e.target.value })} className="input" />
          </Field>

          <Field label={t("filter.toDate")}>
            <input type="date" value={get("to")} onChange={(e) => apply({ to: e.target.value })} className="input" />
          </Field>

          <Field label={t("filter.personalRecords")}>
            <label className="flex h-[42px] cursor-pointer items-center gap-2 rounded-xl px-3.5 ring-1 ring-inset ring-ink-200">
              <input
                type="checkbox"
                checked={get("pr") === "1"}
                onChange={(e) => apply({ pr: e.target.checked ? "1" : "" })}
                className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-ink-700">{t("filter.onlyPR")}</span>
            </label>
          </Field>

          <div className="flex items-end sm:col-span-2 lg:col-span-3">
            <button onClick={reset} disabled={!activeCount && !get("search")} className="btn-ghost">
              {t("filter.clearAll")}
            </button>
            {isPending && <span className="ms-3 self-center text-xs text-ink-400">{t("common.updating")}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
