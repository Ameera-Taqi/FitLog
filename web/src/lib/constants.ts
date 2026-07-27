import type { WorkoutType, Difficulty, ExerciseDifficulty, Mood, UnitPreference, Sex, FitnessGoal } from "./types";

// Per-exercise difficulty — a focused 3-level scale (labels share enum.difficulty.*).
export const EXERCISE_DIFFICULTIES: { value: ExerciseDifficulty }[] = [
  { value: "easy" },
  { value: "moderate" },
  { value: "hard" },
];

export const UNIT_OPTIONS: { value: UnitPreference; label: string }[] = [
  { value: "kg", label: "Kilograms (kg)" },
  { value: "lb", label: "Pounds (lb)" },
];

export const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

export const FITNESS_GOALS: { value: FitnessGoal; label: string; icon: string }[] = [
  { value: "strength", label: "Strength", icon: "🏋️" },
  { value: "hypertrophy", label: "Muscle growth", icon: "💪" },
  { value: "endurance", label: "Endurance", icon: "🏃" },
  { value: "weight_loss", label: "Weight loss", icon: "🔥" },
  { value: "general_fitness", label: "General fitness", icon: "✨" },
];

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

export const MOODS: { value: Mood; label: string; emoji: string }[] = [
  { value: "terrible", label: "Terrible", emoji: "😞" },
  { value: "bad", label: "Bad", emoji: "🙁" },
  { value: "okay", label: "Okay", emoji: "😐" },
  { value: "good", label: "Good", emoji: "🙂" },
  { value: "great", label: "Great", emoji: "😄" },
];

export const ENERGY_LEVELS = [1, 2, 3, 4, 5];

// Predefined workout templates for quick-start. `key` maps to template.<key>
// in the dictionaries; picking one prefills the name, type and muscle groups.
export const WORKOUT_TEMPLATES: {
  key: string;
  icon: string;
  type: WorkoutType;
  muscles: string[];
}[] = [
  { key: "push", icon: "💪", type: "strength", muscles: ["Chest", "Shoulders", "Triceps"] },
  { key: "pull", icon: "🏋️", type: "strength", muscles: ["Back", "Biceps", "Forearms"] },
  { key: "legs", icon: "🦵", type: "strength", muscles: ["Quads", "Hamstrings", "Glutes", "Calves"] },
  { key: "fullBody", icon: "🔩", type: "strength", muscles: ["Full body"] },
  { key: "cardio", icon: "❤️", type: "cardio", muscles: ["Cardio"] },
  { key: "mobility", icon: "🧘", type: "mobility", muscles: ["Core"] },
  { key: "hiit", icon: "⚡", type: "hiit", muscles: ["Full body"] },
  { key: "running", icon: "🏃", type: "cardio", muscles: ["Cardio"] },
];

export const MUSCLE_GROUPS = [
  "Chest",
  "Back",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Forearms",
  "Core",
  "Abs",
  "Quads",
  "Hamstrings",
  "Glutes",
  "Calves",
  "Full body",
  "Cardio",
];

export const COMMON_EXERCISES = [
  "Bench Press",
  "Squat",
  "Deadlift",
  "Overhead Press",
  "Barbell Row",
  "Pull-up",
  "Push-up",
  "Lat Pulldown",
  "Leg Press",
  "Romanian Deadlift",
  "Dumbbell Curl",
  "Tricep Pushdown",
  "Plank",
  "Running",
  "Cycling",
  "Rowing",
  "Jump Rope",
  "Lunges",
];

export function difficultyLabel(d: Difficulty | null): string {
  return DIFFICULTIES.find((x) => x.value === d)?.label ?? "—";
}

export function workoutTypeMeta(t: WorkoutType) {
  return WORKOUT_TYPES.find((x) => x.value === t) ?? WORKOUT_TYPES[WORKOUT_TYPES.length - 1];
}

export function moodMeta(m: Mood | null) {
  return MOODS.find((x) => x.value === m);
}
