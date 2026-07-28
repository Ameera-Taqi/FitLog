import type { SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_HERO_PATH = "/workout-hero.png";
export const HERO_BUCKET = "workout-heroes";

const TYPE_LABELS: Record<string, string> = {
  strength: "Strength Training",
  cardio: "Cardio",
  mobility: "Mobility",
  flexibility: "Flexibility",
  hiit: "HIIT",
  sports: "Sports",
  crossfit: "CrossFit",
  other: "Fitness",
};

export function heroNameKey(workoutName: string): string {
  return workoutName.trim().toLowerCase();
}

export function workoutTypeLabel(workoutType: string): string {
  const raw = workoutType.trim();
  const key = raw.toLowerCase().replace(/\s+/g, "_");
  if (TYPE_LABELS[key]) return TYPE_LABELS[key];
  // Accept already-friendly labels like "Strength Training"
  if (raw.includes(" ")) return raw;
  return TYPE_LABELS[raw.toLowerCase()] ?? raw;
}

export function buildHeroPrompt(workoutName: string, workoutType: string): string {
  const typeLabel = workoutTypeLabel(workoutType);
  return (
    `A realistic cinematic fitness hero banner of a male athlete performing a ${typeLabel} workout ` +
    `focused on "${workoutName.trim()}", Exercise Instructions Images style, dramatic gym lighting, ` +
    `photorealistic, high quality, wide banner composition.`
  );
}

export function defaultHeroUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}${DEFAULT_HERO_PATH}`;
}

export type HeroImageRow = {
  id: string;
  workout_name: string;
  name_key: string;
  workout_type: string;
  prompt: string;
  image_url: string;
  created_at: string;
};

export async function findHeroByName(
  supabase: SupabaseClient,
  workoutName: string,
): Promise<HeroImageRow | null> {
  const key = heroNameKey(workoutName);
  if (!key) return null;
  const { data, error } = await supabase
    .from("workout_hero_images")
    .select("*")
    .eq("name_key", key)
    .maybeSingle();
  if (error) throw error;
  return (data as HeroImageRow | null) ?? null;
}

/** Map of lowercased workout name → image URL for card grids. */
export async function fetchHeroImageMap(
  supabase: SupabaseClient,
  workoutNames: string[],
): Promise<Map<string, string>> {
  const keys = [...new Set(workoutNames.map(heroNameKey).filter(Boolean))];
  const map = new Map<string, string>();
  if (!keys.length) return map;

  const { data, error } = await supabase
    .from("workout_hero_images")
    .select("name_key, image_url")
    .in("name_key", keys);

  if (error) {
    console.error("fetchHeroImageMap", error.message);
    return map;
  }

  for (const row of data ?? []) {
    map.set(row.name_key, row.image_url);
  }
  return map;
}
