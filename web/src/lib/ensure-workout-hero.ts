/** Client helper — ensures a hero exists for this workout name (cached server-side). */
export async function ensureWorkoutHero(
  workoutName: string,
  workoutType: string,
  apiBase?: string,
): Promise<string | null> {
  const name = workoutName.trim();
  if (!name) return null;

  const base = (apiBase ?? "").replace(/\/$/, "");
  const url = `${base}/api/workouts/generate-hero`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workoutName: name, workoutType }),
    });
    const data = (await res.json()) as { imageUrl?: string };
    return data.imageUrl ?? null;
  } catch (err) {
    console.error("ensureWorkoutHero", err);
    return null;
  }
}
