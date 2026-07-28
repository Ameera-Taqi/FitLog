import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProgressPhoto, Workout } from "@/lib/types";

export const DEFAULT_HERO_PATH = "/workout-hero.png";

/** Prefer the workout's first progress photo; otherwise the FitLog default. */
export function resolveHeroSrc(photoUrl?: string | null): string {
  return photoUrl?.trim() || DEFAULT_HERO_PATH;
}

function firstPhoto(workout: Workout): ProgressPhoto | undefined {
  const photos = workout.progress_photos ?? [];
  if (!photos.length) return undefined;
  return [...photos].sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))[0];
}

/** Map workout id → signed URL for the first progress photo (if any). */
export async function fetchWorkoutPhotoHeroMap(
  supabase: SupabaseClient,
  workouts: Workout[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const targets: { workoutId: string; path: string }[] = [];

  for (const w of workouts) {
    const photo = firstPhoto(w);
    if (photo?.storage_path) {
      targets.push({ workoutId: w.id, path: photo.storage_path });
    }
  }

  if (!targets.length) return map;

  // Prefer batch signing when available.
  const { data: batch, error } = await supabase.storage
    .from("progress-photos")
    .createSignedUrls(
      targets.map((t) => t.path),
      60 * 60,
    );

  if (!error && batch) {
    for (let i = 0; i < targets.length; i++) {
      const signed = batch[i]?.signedUrl;
      if (signed) map.set(targets[i].workoutId, signed);
    }
    return map;
  }

  // Fallback: sign one-by-one
  await Promise.all(
    targets.map(async ({ workoutId, path }) => {
      const { data } = await supabase.storage.from("progress-photos").createSignedUrl(path, 60 * 60);
      if (data?.signedUrl) map.set(workoutId, data.signedUrl);
    }),
  );

  return map;
}
