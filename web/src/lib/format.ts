// Small formatting helpers used across the UI.

import type { UnitPreference } from "./types";

// ---- Weight units --------------------------------------------------------
// Canonical storage is ALWAYS kilograms. These helpers convert for display
// and back for input, based on the user's profile preference.

const KG_PER_LB = 0.45359237;

export function unitLabel(unit: UnitPreference): string {
  return unit;
}

// kg (stored) -> value in the user's preferred unit
export function kgToUnit(kg: number, unit: UnitPreference): number {
  return unit === "lb" ? kg / KG_PER_LB : kg;
}

// value in the user's preferred unit -> kg (for storage)
export function unitToKg(value: number, unit: UnitPreference): number {
  const kg = unit === "lb" ? value * KG_PER_LB : value;
  return Math.round(kg * 100) / 100; // 2 dp, avoids float noise
}

// Round a display value: whole-ish for kg (0.5 steps), 1 dp for lb.
export function roundForDisplay(value: number, unit: UnitPreference): number {
  return unit === "lb" ? Math.round(value * 10) / 10 : Math.round(value * 100) / 100;
}

// Format a stored kg weight for display, e.g. "60 kg" / "132.3 lb".
export function formatWeight(kg: number | null, unit: UnitPreference): string {
  if (kg == null) return "—";
  const v = roundForDisplay(kgToUnit(kg, unit), unit);
  return `${trimNumber(v)} ${unit}`;
}

// Format a total volume (stored in kg) for a stat tile.
export function formatVolume(kgVolume: number, unit: UnitPreference): { value: string; sub: string } {
  const v = kgToUnit(kgVolume, unit);
  const value =
    v >= 100000
      ? `${(v / 1000).toFixed(0)}k`
      : v >= 1000
      ? `${(v / 1000).toFixed(1)}${unit === "kg" ? "t" : "k"}`
      : `${Math.round(v)}`;
  return { value, sub: `${unit} lifted (all time)` };
}

function trimNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n);
}


export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatDuration(minutes: number | null): string {
  if (minutes == null) return "—";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatSeconds(seconds: number | null): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

export function todayISO(): string {
  const now = new Date();
  const off = now.getTimezoneOffset();
  const local = new Date(now.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
}

export function timeFromTimestamp(ts: string | null): string {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Compute total volume (sum of reps * weight) for a workout's exercises.
export function totalVolume(exercises?: { exercise_sets?: { reps: number | null; weight: number | null }[] }[]): number {
  if (!exercises) return 0;
  let v = 0;
  for (const ex of exercises) {
    for (const s of ex.exercise_sets ?? []) {
      if (s.reps && s.weight) v += s.reps * s.weight;
    }
  }
  return Math.round(v);
}
