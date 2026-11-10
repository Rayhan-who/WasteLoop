"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Camera, Loader2, Star, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { ACCEPTED_PHOTO_TYPES, MAX_SOURCE_BYTES, preparePhoto } from "@/lib/photos/resize";
import { MAX_PHOTOS } from "@/lib/validation/listing";
import { cn } from "@/lib/utils";

const BUCKET = "listing-photos";

/**
 * Listing photos (FR-3.1): up to six, uploaded straight to Supabase Storage
 * under "<user id>/…" (Storage RLS only allows a user's own folder). The
 * first photo is the cover. Photos uploaded in this session and then removed
 * are deleted from Storage; previously saved ones are removed on save.
 */
export function PhotoUploader({
  userId,
  value,
  onChange,
  onFirstUpload,
  error,
}: {
  userId: string;
  value: string[];
  onChange: (paths: string[]) => void;
  /** Called with the first photo uploaded, for advisory ML suggestions. */
  onFirstUpload?: (path: string) => void;
  error?: string;
}) {
  const t = useTranslations("listingForm.photos");
  const tv = useTranslations("validation");
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [problem, setProblem] = useState<"type" | "size" | "failed" | "limit" | null>(null);
  const [sessionUploads, setSessionUploads] = useState<string[]>([]);
  const supabase = createClient();
  const publicUrl = (path: string) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setProblem(null);
    const room = MAX_PHOTOS - value.length;
    const chosen = Array.from(files).slice(0, Math.max(0, room));
    if (files.length > room) setProblem("limit");

    const added: string[] = [];
    for (const file of chosen) {
      if (!(ACCEPTED_PHOTO_TYPES as readonly string[]).includes(file.type)) {
        setProblem("type");
        continue;
      }
      if (file.size > MAX_SOURCE_BYTES) {
        setProblem("size");
        continue;
      }
      setUploading((n) => n + 1);
      try {
        const photo = await preparePhoto(file);
        const path = `${userId}/${crypto.randomUUID()}.${photo.ext}`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, photo.blob, { contentType: photo.contentType, cacheControl: "31536000", upsert: false });
        if (uploadError) {
          console.error("photo upload", uploadError.message);
          setProblem("failed");
        } else {
          added.push(path);
        }
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (added.length > 0) {
      const next = [...value, ...added];
      onChange(next);
      setSessionUploads((s) => [...s, ...added]);
      if (value.length === 0) onFirstUpload?.(added[0]);
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  async function remove(path: string) {
    onChange(value.filter((p) => p !== path));
    if (sessionUploads.includes(path)) {
      setSessionUploads((s) => s.filter((p) => p !== path));
      await supabase.storage.from(BUCKET).remove([path]);
    }
  }

  function makeCover(path: string) {
    onChange([path, ...value.filter((p) => p !== path)]);
  }

  const problemText = problem ? t(`problem.${problem}`, { max: MAX_PHOTOS }) : error ? tv(error as "tooManyPhotos") : null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">
        {t("label")} <span className="font-normal text-wl-ink-muted">({t("count", { count: value.length, max: MAX_PHOTOS })})</span>
      </p>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {value.map((path, i) => (
          <li key={path} className="group relative aspect-square overflow-hidden rounded-xl border border-wl-border bg-wl-chrome-soft">
            <Image src={publicUrl(path)} alt={t("photoAlt", { n: i + 1 })} fill sizes="160px" className="object-cover" />
            {i === 0 ? (
              <span className="absolute bottom-1 left-1 rounded-full bg-wl-inverse px-2 py-0.5 text-xs text-wl-on-inverse">{t("cover")}</span>
            ) : (
              <button
                type="button"
                onClick={() => makeCover(path)}
                aria-label={t("makeCover", { n: i + 1 })}
                className="absolute bottom-1 left-1 inline-flex size-8 items-center justify-center rounded-full bg-wl-surface/90 text-wl-ink shadow"
              >
                <Star aria-hidden className="size-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => remove(path)}
              aria-label={t("remove", { n: i + 1 })}
              className="absolute top-1 right-1 inline-flex size-8 items-center justify-center rounded-full bg-wl-surface/90 text-wl-ink shadow"
            >
              <X aria-hidden className="size-4" />
            </button>
          </li>
        ))}
        {value.length + uploading < MAX_PHOTOS ? (
          <li>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-wl-grey-300 bg-wl-surface text-sm text-wl-ink-soft transition-colors hover:border-wl-ink hover:text-wl-ink"
            >
              <Camera aria-hidden className="size-6" />
              {t("add")}
            </button>
          </li>
        ) : null}
        {Array.from({ length: uploading }).map((_, i) => (
          <li key={`up-${i}`} className="flex aspect-square items-center justify-center rounded-xl border border-wl-border bg-wl-chrome-soft">
            <Loader2 aria-hidden className="size-6 animate-spin text-wl-ink-soft" />
            <span className="sr-only">{t("uploading")}</span>
          </li>
        ))}
      </ul>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_PHOTO_TYPES.join(",")}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      <p className="text-sm text-wl-ink-soft">{t("hint")}</p>
      <p aria-live="polite" className={cn("text-sm text-wl-danger", !problemText && "sr-only")}>
        {problemText}
      </p>
    </div>
  );
}
