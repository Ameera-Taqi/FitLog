import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Looks at the caller's last 7 days of workouts and reports which primary
// muscle group they've trained least (the "neglected" one). No secret needed —
// it queries with the caller's JWT so RLS scopes it to their own data.
// Called by both the web and mobile apps via supabase.functions.invoke().

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

// Map the app's granular muscle tags to primary training groups.
const GROUP_MAP: Record<string, string> = {
  Chest: "Chest", Back: "Back", Shoulders: "Shoulders",
  Biceps: "Arms", Triceps: "Arms", Forearms: "Arms",
  Quads: "Legs", Hamstrings: "Legs", Glutes: "Legs", Calves: "Legs",
  Core: "Core", Abs: "Core",
};
const PRIMARY = ["Chest", "Back", "Shoulders", "Arms", "Legs", "Core"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const since = new Date();
    since.setDate(since.getDate() - 7);
    const sinceStr = since.toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("workouts")
      .select("workout_date, muscle_groups")
      .gte("workout_date", sinceStr);
    if (error) return json({ error: "query_error", message: error.message }, 400);

    const workouts = (data ?? []) as { workout_date: string; muscle_groups: string[] | null }[];
    const counts: Record<string, number> = {};
    for (const g of PRIMARY) counts[g] = 0;

    for (const w of workouts) {
      const groups = new Set<string>();
      const mgs = w.muscle_groups ?? [];
      if (mgs.includes("Full body")) for (const g of PRIMARY) groups.add(g);
      for (const m of mgs) {
        const p = GROUP_MAP[m];
        if (p) groups.add(p);
      }
      for (const g of groups) counts[g] = (counts[g] ?? 0) + 1;
    }

    const minCount = Math.min(...PRIMARY.map((g) => counts[g]));
    const maxCount = Math.max(...PRIMARY.map((g) => counts[g]));
    const neglected = PRIMARY.filter((g) => counts[g] === minCount);
    // "balanced" when every primary group was hit and the spread is tight.
    const balanced = workouts.length > 0 && minCount > 0 && maxCount - minCount <= 1;

    return json({ sinceDate: sinceStr, totalWorkouts: workouts.length, counts, neglected, minCount, balanced });
  } catch (e) {
    return json({ error: "exception", message: String(e) }, 500);
  }
});
