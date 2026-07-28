import { supabase } from "@/lib/supabase";
import type { Workout } from "@/lib/types";

/** Map workout id → signed URL for the first progress photo (if any). */
export async function fetchWorkoutPhotoHeroMap(
  workouts: Workout[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const targets: { workoutId: string; path: string }[] = [];

  for (const w of workouts) {
    const photos = [...(w.progress_photos ?? [])].sort((a, b) =>
      (a.created_at ?? "").localeCompare(b.created_at ?? ""),
    );
    const path = photos[0]?.storage_path;
    if (path) targets.push({ workoutId: w.id, path });
  }

  if (!targets.length) return map;

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

  await Promise.all(
    targets.map(async ({ workoutId, path }) => {
      const { data } = await supabase.storage.from("progress-photos").createSignedUrl(path, 60 * 60);
      if (data?.signedUrl) map.set(workoutId, data.signedUrl);
    }),
  );

  return map;
}
