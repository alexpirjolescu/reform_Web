"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { TrashIcon, UploadIcon } from "@/components/icons";
import type { SubmissionFile } from "@/lib/assessments";
import { maxUploadBytes, storageSafeName } from "@/lib/library";
import { createClient } from "@/lib/supabase/client";
import type { Theme } from "@/lib/theme-shared";

/** Hand-in for an assignment (AS-2): files, a link and/or text, saved as the student works. */
export function AssignmentRunner({
  variant,
  attemptId,
  initialText,
  initialLink,
  initialFiles,
  header,
}: {
  variant: Theme;
  attemptId: string;
  initialText: string;
  initialLink: string;
  initialFiles: SubmissionFile[];
  header?: ReactNode;
}) {
  const t = useTranslations("assessments");
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [files, setFiles] = useState(initialFiles);
  const [text, setText] = useState(initialText);
  const [link, setLink] = useState(initialLink);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef({ text, link });

  async function saveResponse() {
    clearTimeout(timer.current);
    setSaving("saving");
    const { error: saveError } = await supabase.rpc("save_attempt_response", {
      target_attempt: attemptId,
      response_text: latest.current.text,
      response_link: latest.current.link,
    });
    setSaving(saveError ? "error" : "saved");
  }

  function schedule(next: { text: string; link: string }) {
    latest.current = next;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveResponse(), 800);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  async function upload(list: File[]) {
    setUploading(true);
    setError(null);
    for (const file of list) {
      if (file.size > maxUploadBytes) {
        setError(t("tooLarge", { name: file.name }));
        continue;
      }
      const path = `${attemptId}/${crypto.randomUUID()}-${storageSafeName(file.name)}`;
      const stored = await supabase.storage.from("submissions").upload(path, file, { contentType: file.type || undefined });
      if (stored.error) {
        setError(`${file.name}: ${stored.error.message}`);
        continue;
      }
      const { data, error: rowError } = await supabase
        .from("submission_files")
        .insert({ attempt_id: attemptId, name: file.name, storage_path: path, mime_type: file.type || "application/octet-stream", size_bytes: file.size })
        .select("id, name, storage_path, size_bytes, mime_type")
        .single();
      if (rowError) setError(`${file.name}: ${rowError.message}`);
      else setFiles((prev) => [...prev, data]);
    }
    setUploading(false);
    if (input.current) input.current.value = "";
  }

  async function remove(file: SubmissionFile) {
    await supabase.storage.from("submissions").remove([file.storage_path]);
    const { error: removeError } = await supabase.from("submission_files").delete().eq("id", file.id);
    if (removeError) setError(removeError.message);
    else setFiles((prev) => prev.filter((f) => f.id !== file.id));
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    await saveResponse();
    const { error: submitError } = await supabase.rpc("submit_attempt", { target_attempt: attemptId });
    if (submitError) {
      setError(submitError.message === "closed" ? t("errors.closed") : t("errors.submitFailed"));
      setSubmitting(false);
      return;
    }
    router.refresh();
  }

  const box =
    variant === "dark"
      ? "rounded-[2px] border border-night-edge bg-night-2 text-white"
      : variant === "color"
        ? "rounded-[18px] border-2 border-ink bg-white"
        : "border border-ink bg-white";
  const primary =
    variant === "dark"
      ? "min-h-12 rounded-[2px] bg-teal px-6 font-display font-semibold text-night disabled:opacity-60"
      : variant === "color"
        ? "min-h-12 rounded-full border-2 border-ink bg-lavender px-6 font-display font-bold text-white disabled:opacity-60"
        : "min-h-12 bg-ink px-6 font-display font-semibold text-white disabled:opacity-60";
  const ghost =
    variant === "dark"
      ? "inline-flex min-h-11 items-center gap-2 rounded-[2px] border border-night-edge px-4 text-sm hover:border-white"
      : variant === "color"
        ? "inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-ink bg-honey px-4 text-sm font-medium"
        : "inline-flex min-h-11 items-center gap-2 border border-ink px-4 text-sm";
  const muted = variant === "dark" ? "text-night-muted" : "text-muted";

  return (
    <div className="flex max-w-[780px] flex-col gap-6">
      {header}
      <section aria-labelledby="handin-files" className="flex flex-col gap-3">
        <h3 id="handin-files" className="font-display text-lg font-bold">{t("files")}</h3>
        {files.length > 0 && (
          <ul className="flex flex-col gap-2">
            {files.map((file) => (
              <li key={file.id} className={`flex items-center gap-3 px-3 py-2 text-sm ${box}`}>
                <span className="min-w-0 flex-1 truncate">{file.name}</span>
                <button type="button" onClick={() => void remove(file)} aria-label={t("removeFile", { name: file.name })} className="grid size-11 place-items-center">
                  <TrashIcon size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div>
          <button type="button" onClick={() => input.current?.click()} disabled={uploading} className={ghost}>
            <UploadIcon size={16} /> {uploading ? t("uploading") : t("addFiles")}
          </button>
          <input ref={input} type="file" multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void upload(Array.from(e.target.files ?? []))} />
        </div>
      </section>
      <label className="flex flex-col gap-2">
        <span className="font-display text-lg font-bold">{t("linkResponse")}</span>
        <span className={`text-[13px] ${muted}`}>{t("linkHint")}</span>
        <input
          type="url"
          value={link}
          placeholder="https://"
          onChange={(e) => {
            setLink(e.target.value);
            schedule({ text, link: e.target.value });
          }}
          className={`min-h-12 px-3 text-base ${box}`}
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="font-display text-lg font-bold">{t("textResponse")}</span>
        <textarea
          rows={6}
          maxLength={8000}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            schedule({ text: e.target.value, link });
          }}
          className={`p-3 text-base leading-relaxed ${box}`}
        />
      </label>
      {error && <p role="alert" className="bg-vermilion/20 px-3 py-2 text-sm">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <span className={`text-[13px] ${muted}`} aria-live="polite">
          {saving === "saving" ? t("saving") : saving === "error" ? t("saveFailed") : t("autosave")}
        </span>
        {confirming ? (
          <button type="button" onClick={() => void submit()} disabled={submitting} className={`ml-auto ${primary}`}>
            {submitting ? t("submitting") : t("confirmHandIn")}
          </button>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} disabled={!files.length && !text.trim() && !link.trim()} className={`ml-auto ${primary}`}>
            {t("handIn")}
          </button>
        )}
      </div>
    </div>
  );
}
