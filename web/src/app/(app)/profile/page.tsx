import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/ProfileForm";
import type { Profile } from "@/lib/types";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const { t } = await getT();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-black uppercase tracking-tight text-ink-900">{t("profile.title")}</h1>
        <p className="text-sm text-ink-500">{t("profile.subtitle")}</p>
      </div>
      <ProfileForm initial={(data as Profile) ?? null} email={user.email ?? ""} />
    </div>
  );
}
