import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Motivational workout-session summary via an LLM.
// Called by both the web and mobile apps through supabase.functions.invoke().
// Keys stay server-side — set them as Supabase secrets. Preference order:
//   1. GROQ_API_KEY   — Groq has a free tier (no credit purchase). Recommended.
//   2. OPENROUTER_API_KEY — needs credits; free models are locked without a purchase.
// Optionally override the model with GROQ_MODEL / OPENROUTER_MODEL.

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const GROQ_MODEL = Deno.env.get("GROQ_MODEL");
const OPENROUTER_MODEL = Deno.env.get("OPENROUTER_MODEL");

// Each attempt is an OpenAI-compatible chat-completions endpoint + model.
function buildAttempts(): { provider: string; url: string; key: string; model: string; headers?: Record<string, string> }[] {
  const list: { provider: string; url: string; key: string; model: string; headers?: Record<string, string> }[] = [];
  if (GROQ_API_KEY) {
    const models = GROQ_MODEL ? [GROQ_MODEL] : ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
    for (const model of models) {
      list.push({ provider: "groq", url: "https://api.groq.com/openai/v1/chat/completions", key: GROQ_API_KEY, model });
    }
  }
  if (OPENROUTER_API_KEY) {
    const models = OPENROUTER_MODEL ? [OPENROUTER_MODEL] : ["openai/gpt-4o-mini"];
    for (const model of models) {
      list.push({
        provider: "openrouter",
        url: "https://openrouter.ai/api/v1/chat/completions",
        key: OPENROUTER_API_KEY,
        model,
        headers: { "HTTP-Referer": "https://fitlog.app", "X-Title": "FitLog" },
      });
    }
  }
  return list;
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

type SetInput = { reps?: number | null; weight?: number | null };
type ExerciseInput = { name?: string; sets?: SetInput[] | number | null };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const attemptsCfg = buildAttempts();
    if (attemptsCfg.length === 0) {
      return json({ error: "not_configured", message: "No LLM key set. Add GROQ_API_KEY (recommended) or OPENROUTER_API_KEY as a Supabase secret." }, 500);
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

    let lastStatus = 0;
    let lastDetail = "";
    const attempts: { provider: string; model: string; status: number }[] = [];
    for (const cfg of attemptsCfg) {
      const res = await fetch(cfg.url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${cfg.key}`,
          "Content-Type": "application/json",
          ...(cfg.headers ?? {}),
        },
        body: JSON.stringify({
          model: cfg.model,
          messages: [
            { role: "system", content: "You are an encouraging fitness coach who writes concise, motivating workout recaps." },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 180,
          temperature: 0.8,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const summary: string = data?.choices?.[0]?.message?.content?.trim() ?? "";
        if (summary) return json({ summary, model: cfg.model, provider: cfg.provider });
        lastStatus = 502;
        lastDetail = "No summary returned.";
        continue;
      }

      lastStatus = res.status;
      lastDetail = (await res.text().catch(() => "")).slice(0, 300);
      attempts.push({ provider: cfg.provider, model: cfg.model, status: res.status });
      // Fall through to the next model/provider on any error.
    }

    return json({ error: "llm_error", status: lastStatus, message: lastDetail, attempts }, 502);
  } catch (e) {
    return json({ error: "exception", message: String(e) }, 500);
  }
});
