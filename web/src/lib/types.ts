// Shared domain types for the Gym Tracker.

export type WorkoutType =
  | "strength"
  | "cardio"
  | "mobility"
  | "flexibility"
  | "hiit"
  | "sports"
  | "crossfit"
  | "other";

export type Difficulty = "easy" | "moderate" | "hard" | "very_hard" | "max_effort";

// Per-exercise difficulty is a simpler 3-level scale.
export type ExerciseDifficulty = "easy" | "moderate" | "hard";

export type Mood = "terrible" | "bad" | "okay" | "good" | "great";

export type UnitPreference = "kg" | "lb";

export type Sex = "male" | "female" | "other" | "prefer_not_to_say";

export type FitnessGoal =
  | "strength"
  | "hypertrophy"
  | "endurance"
  | "weight_loss"
  | "general_fitness";

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  unit_preference: UnitPreference;
  height_cm: number | null;
  date_of_birth: string | null; // YYYY-MM-DD
  sex: Sex | null;
  body_weight_kg: number | null;
  fitness_goal: FitnessGoal | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExerciseSet {
  id?: string;
  exercise_id?: string;
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
  difficulty: ExerciseDifficulty | null;
  completed: boolean;
  distance_km: number | null;
  duration_seconds: number | null;
  notes: string | null;
  exercise_sets?: ExerciseSet[];
}

export interface Workout {
  id: string;
  user_id: string;
  name: string;
  workout_date: string; // YYYY-MM-DD
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  workout_type: WorkoutType;
  muscle_groups: string[];
  calories_burned: number | null;
  difficulty: Difficulty | null;
  energy_before: number | null; // 1-5
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

export interface WorkoutSchedule {
  id: string;
  user_id: string;
  workout_id: string;
  scheduled_date: string; // YYYY-MM-DD
  created_at: string;
  workouts?: Workout;
}

export interface ProgressPhoto {
  id: string;
  workout_id: string | null;
  user_id: string;
  storage_path: string;
  caption: string | null;
  created_at: string;
}

export interface WorkoutFilters {
  search?: string;        // matches workout name
  exercise?: string;      // matches exercise name
  type?: WorkoutType | "";
  muscleGroup?: string;
  difficulty?: Difficulty | "";
  location?: string;
  status?: "all" | "completed" | "incomplete";
  pr?: boolean;           // only workouts with a PR
  from?: string;          // date
  to?: string;            // date
}
