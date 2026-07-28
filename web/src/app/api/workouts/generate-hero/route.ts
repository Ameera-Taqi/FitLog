import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { fal } from "@fal-ai/client";
import { createClient } from "@/lib/supabase/server";
import {
  buildHeroPrompt,
  defaultHeroUrl,
  findHeroByName,
  heroNameKey,
  HERO_BUCKET,
  workoutTypeLabel,
} from "@/lib/hero-images";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  workoutName?: string;
  workoutType?: string;
};

type FalImageResult = {
  images?: { url: string }[];
};

function jsonImage(imageUrl: string, status = 200) {
  return NextResponse.json({ imageUrl }, { status });
}

function bearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim() || null;
}

async function getAuthedClient(request: NextRequest) {
  const token = bearerToken(request);
  if (token) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createSupabaseJsClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return { supabase: null, user: null };
    return { supabase, user: data.user };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

async function uploadHeroToStorage(
  supabase: NonNullable<Awaited<ReturnType<typeof getAuthedClient>>["supabase"]>,
  imageUrl: string,
  nameKey: string,
): Promise<string | null> {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/png";
    const ext = contentType.includes("webp")
      ? "webp"
      : contentType.includes("jpeg") || contentType.includes("jpg")
        ? "jpg"
        : "png";
    const bytes = Buffer.from(await res.arrayBuffer());
    const path = `${nameKey.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workout"}-${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from(HERO_BUCKET).upload(path, bytes, {
      contentType,
      upsert: false,
    });
    if (error) {
      console.error("hero upload", error.message);
      return null;
    }

    const { data } = supabase.storage.from(HERO_BUCKET).getPublicUrl(path);
    return data.publicUrl || null;
  } catch (err) {
    console.error("hero upload failed", err);
    return null;
  }
}

async function generateWithFal(prompt: string): Promise<{ url: string | null; error?: string }> {
  const key = process.env.FAL_KEY;
  if (!key) {
    console.error("FAL_KEY is not set");
    return { url: null, error: "FAL_KEY is not set" };
  }

  try {
    fal.config({ credentials: key });
    const result = await fal.subscribe("fal-ai/flux/schnell", {
      input: {
        prompt,
        image_size: "landscape_16_9",
        num_images: 1,
        num_inference_steps: 4,
      },
    });
    const data = result.data as FalImageResult;
    return { url: data?.images?.[0]?.url ?? null };
  } catch (err: unknown) {
    const detail =
      err && typeof err === "object" && "body" in err
        ? JSON.stringify((err as { body?: unknown }).body)
        : err instanceof Error
          ? err.message
          : String(err);
    console.error("fal.ai generate failed", err);
    return { url: null, error: detail };
  }
}

export async function POST(request: NextRequest) {
  const fallback = defaultHeroUrl(request.nextUrl.origin);

  try {
    const { supabase, user } = await getAuthedClient(request);

    if (!supabase || !user) {
      return NextResponse.json({ error: "Unauthorized", imageUrl: fallback }, { status: 401 });
    }

    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return jsonImage(fallback);
    }

    const workoutName = (body.workoutName ?? "").trim();
    const workoutType = (body.workoutType ?? "strength").trim() || "strength";

    if (!workoutName) {
      return jsonImage(fallback);
    }

    // 1) Case-insensitive cache hit — never call fal.ai
    try {
      const existing = await findHeroByName(supabase, workoutName);
      if (existing?.image_url) {
        return jsonImage(existing.image_url);
      }
    } catch (err) {
      console.error("hero lookup failed", err);
    }

    // 2) Generate with fal.ai
    const prompt = buildHeroPrompt(workoutName, workoutType);
    const generated = await generateWithFal(prompt);
    if (!generated.url) {
      return jsonImage(fallback);
    }

    // 3) Prefer durable storage; fall back to fal CDN URL
    const storedUrl =
      (await uploadHeroToStorage(supabase, generated.url, heroNameKey(workoutName))) ?? generated.url;

    // 4) Persist cache row (race-safe: unique name_key)
    try {
      const { data: inserted, error: insertErr } = await supabase
        .from("workout_hero_images")
        .insert({
          workout_name: workoutName,
          name_key: heroNameKey(workoutName),
          workout_type: workoutTypeLabel(workoutType),
          prompt,
          image_url: storedUrl,
        })
        .select("image_url")
        .single();

      if (insertErr) {
        const again = await findHeroByName(supabase, workoutName);
        if (again?.image_url) return jsonImage(again.image_url);
        console.error("hero insert failed", insertErr.message);
        return jsonImage(storedUrl);
      }

      return jsonImage(inserted.image_url);
    } catch (err) {
      console.error("hero persist failed", err);
      return jsonImage(storedUrl);
    }
  } catch (err) {
    console.error("generate-hero", err);
    return jsonImage(fallback);
  }
}
