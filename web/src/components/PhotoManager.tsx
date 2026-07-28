"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";

export interface PhotoItem {
  id: string;
  storage_path: string;
  url: string; // signed url
}

const BUCKET = "progress-photos";

export function PhotoManager({
  workoutId,
  initial,
}: {
  workoutId: string;
  initial: PhotoItem[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const { t } = useI18n();
  const [photos, setPhotos] = useState<PhotoItem[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setBusy(true);
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Session expired.");

      const added: PhotoItem[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${uid}/${workoutId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });
        if (upErr) throw upErr;

        const { data: row, error: insErr } = await supabase
          .from("progress_photos")
          .insert({ workout_id: workoutId, user_id: uid, storage_path: path })
          .select("id, storage_path")
          .single();
        if (insErr) throw insErr;

        const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
        added.push({ id: row.id, storage_path: path, url: signed?.signedUrl ?? "" });
      }
      setPhotos((cur) => [...added, ...cur]);
      // Hero cards depend on photos — refresh list views after upload
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(photo: PhotoItem) {
    setBusy(true);
    setError(null);
    try {
      await supabase.storage.from(BUCKET).remove([photo.storage_path]);
      await supabase.from("progress_photos").delete().eq("id", photo.id);
      setPhotos((cur) => cur.filter((p) => p.id !== photo.id));
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't delete photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wide text-ink-500">{t("photos.title")}</h3>
        <button onClick={() => inputRef.current?.click()} disabled={busy} className="btn-secondary py-2 text-xs">
          {busy ? t("photos.working") : t("photos.add")}
        </button>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      </div>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {photos.length === 0 ? (
        <p className="text-sm text-ink-400">{t("photos.none")}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p) => (
            <div key={p.id} className="relative aspect-square overflow-hidden rounded-xl ring-1 ring-ink-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="Progress" className="h-full w-full object-cover object-center" />
              <button
                type="button"
                onClick={() => remove(p)}
                disabled={busy}
                className="absolute end-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full bg-black/70 text-white shadow-md backdrop-blur-sm transition hover:bg-red-500 disabled:opacity-50"
                aria-label={t("photos.delete")}
                title={t("photos.delete")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
