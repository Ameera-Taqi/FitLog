export type WorkoutType =
  | "strength" | "cardio" | "mobility" | "flexibility" | "hiit" | "sports" | "crossfit" | "other";
export type Difficulty = "easy" | "moderate" | "hard" | "very_hard" | "max_effort";
export type Mood = "terrible" | "bad" | "okay" | "good" | "great";

export interface ExerciseSet {
  id?: string;
  set_number: number;
  reps: number | null;
  weight: number | null;
  distance_km: number | null;
  duration_seconds: number | null;
  rest_seconds: number | null;
  is_pr: boolean;
  completed: boolean;
}
export interface Exercise {
  id?: string;
  workout_id?: string;
  name: string;
  position: number;
  is_pr: boolean;
  completed?: boolean;
  distance_km: number | null;
  duration_seconds: number | null;
  notes: string | null;
  exercise_sets?: ExerciseSet[];
}
export interface Workout {
  id: string;
  user_id: string;
  name: string;
  workout_date: string;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  workout_type: WorkoutType;
  muscle_groups: string[];
  calories_burned: number | null;
  difficulty: Difficulty | null;
  energy_before: number | null;
  mood_after: Mood | null;
  notes: string | null;
  location: string | null;
  completed: boolean;
  body_weight: number | null;
  created_at: string;
  updated_at: string;
  exercises?: Exercise[];
  progress_photos?: ProgressPhoto[];
}

export interface ProgressPhoto {
  id: string;
  workout_id?: string | null;
  user_id?: string;
  storage_path: string;
  caption?: string | null;
  created_at?: string;
}

export const WORKOUT_TYPES: { value: WorkoutType; label: string; icon: string }[] = [
  { value: "strength", label: "Strength", icon: "🏋️" },
  { value: "cardio", label: "Cardio", icon: "🏃" },
  { value: "mobility", label: "Mobility", icon: "🧘" },
  { value: "flexibility", label: "Flexibility", icon: "🤸" },
  { value: "hiit", label: "HIIT", icon: "⚡" },
  { value: "crossfit", label: "CrossFit", icon: "🔥" },
  { value: "sports", label: "Sports", icon: "⚽" },
  { value: "other", label: "Other", icon: "💪" },
];
export const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "moderate", label: "Moderate" },
  { value: "hard", label: "Hard" },
  { value: "very_hard", label: "Very hard" },
  { value: "max_effort", label: "Max effort" },
];
export const MUSCLE_GROUPS = [
  "Chest", "Back", "Shoulders", "Biceps", "Triceps", "Forearms",
  "Core", "Abs", "Legs", "Quads", "Hamstrings", "Glutes", "Calves", "Full body", "Cardio",
];

export function typeMeta(t: WorkoutType) {
  return WORKOUT_TYPES.find((x) => x.value === t) ?? WORKOUT_TYPES[WORKOUT_TYPES.length - 1];
}
export function difficultyLabel(d: Difficulty | null): string {
  return DIFFICULTIES.find((x) => x.value === d)?.label ?? "—";
}
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}
export function formatDuration(min: number | null): string {
  if (min == null) return "—";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
export function totalVolume(exercises?: Exercise[]): number {
  if (!exercises) return 0;
  let v = 0;
  for (const ex of exercises) for (const s of ex.exercise_sets ?? []) if (s.reps && s.weight) v += s.reps * s.weight;
  return Math.round(v);
}
