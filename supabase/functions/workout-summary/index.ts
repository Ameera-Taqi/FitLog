import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Motivational workout-session summary via OpenRouter.
// Called by both the web and mobile apps through supabase.functions.invoke().
// The OpenRouter key stays server-side — set it as a Supabase secret:
//   supabase secrets set OPENROUTER_API_KEY=sk-or-...   (optionally OPENROUTER_MODEL=...)

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const MODEL = Deno.env.get("OPENROUTER_MODEL") ?? "openai/gpt-4o-mini";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

type SetInput = { reps?: number | null; weight?: number | null };
type ExerciseInput = { name?: string; sets?: SetInput[] | number | null };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    if (!OPENROUTER_API_KEY) {
      return json({ error: "not_configured", message: "OPENROUTER_API_KEY is not set for this project." }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const workoutName: string = body?.workoutName ?? "Session";
    const workoutType: string | undefined = body?.workoutType;
    const durationMinutes: number | undefined = body?.durationMinutes;
    const unit: string = body?.unit === "lb" ? "lb" : "kg";
    const exercises: ExerciseInput[] = Array.isArray(body?.exercises) ? body.exercises : [];

    if (exercises.length === 0) {
      return json({ error: "bad_request", message: "No exercises provided." }, 400);
    }

    const lines = exercises
      .filter((e) => e && typeof e.name === "string" && e.name.trim())
      .map((e) => {
        let detail = "";
        if (Array.isArray(e.sets) && e.sets.length) {
          detail = e.sets
            .map((s) => `${s.reps ?? "?"} reps${s.weight != null ? ` @ ${s.weight}${unit}` : ""}`)
            .join(", ");
        } else if (typeof e.sets === "number") {
          detail = `${e.sets} sets`;
        }
        return `- ${e.name}${detail ? `: ${detail}` : ""}`;
      })
      .join("\n");

    const userPrompt = `Workout: ${workoutName}${workoutType ? ` (${workoutType})` : ""}${durationMinutes ? `, ${durationMinutes} min` : ""}\nExercises:\n${lines}\n\nWrite a short, upbeat motivational recap of this session in 2-3 sentences. Reference something specific about what they did. No markdown, no bullet points, no emojis.`;

    const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://fitlog.app",
        "X-Title": "FitLog",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: "You are an encouraging fitness coach who writes concise, motivating workout recaps." },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 180,
        temperature: 0.8,
      }),
    });

    if (!orRes.ok) {
      const detail = await orRes.text().catch(() => "");
      return json({ error: "openrouter_error", status: orRes.status, message: detail.slice(0, 300) }, 502);
    }

    const data = await orRes.json();
    const summary: string = data?.choices?.[0]?.message?.content?.trim() ?? "";
    if (!summary) return json({ error: "empty", message: "No summary returned." }, 502);

    return json({ summary, model: MODEL });
  } catch (e) {
    return json({ error: "exception", message: String(e) }, 500);
  }
});
