import { createClient } from "@/lib/supabase/server";
import type { Profile, UnitPreference } from "@/lib/types";

// Fetch the signed-in user's profile row (or null if none yet).
export async function getMyProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return (data as Profile) ?? null;
}

// Convenience: just the weight-unit preference, defaulting to kg.
export async function getMyUnit(): Promise<UnitPreference> {
  const profile = await getMyProfile();
  return profile?.unit_preference ?? "kg";
}
