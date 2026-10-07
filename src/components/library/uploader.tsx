"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { UploadIcon } from "@/components/icons";
import { moduleButtons } from "@/components/page-header";
import { acceptedTypes } from "@/lib/library";
import { uploadToLibrary } from "@/lib/library-upload";
import { createClient } from "@/lib/supabase/client";
import type { Theme } from "@/lib/theme-shared";

type FolderOption = { id: string; name: string; group: string };

/**
 * Uploads straight from the browser to the private "library" bucket (LIB-2), then records the file.
 * Files go into the open folder; from the overview, the person picks a folder first. One button, every theme.
 */
export function Uploader({
  variant,
  folders,
  currentFolderId,
  profileId,
}: {
  variant: Theme;
  folders: FolderOption[];
  currentFolderId: string | null;
  profileId: string;
}) {
  const t = useTranslations("library");
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const input = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState(currentFolderId ?? "");
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const b = moduleButtons[variant];

  async function upload(list: File[]) {
    if (!target || !list.length) return;
    setBusy(true);
    setProblems([]);
    const { saved, problems: failed } = await uploadToLibrary(supabase, target, list, profileId, t, (current, total) =>
      setStatus(t("uploadingCount", { current, total })),
    );
    setBusy(false);
    setProblems(failed);
    setStatus(saved ? t("uploaded", { count: saved }) : null);
    setPicking(false);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  const fileInput = (
    <input
      ref={input}
      type="file"
      multiple
      accept={acceptedTypes.join(",")}
      className="sr-only"
      tabIndex={-1}
      aria-hidden="true"
      onChange={(e) => void upload(Array.from(e.target.files ?? []))}
    />
  );

  const folderSelect = (
    <label className="flex flex-col gap-1.5 text-sm">
      {t("uploadInto")}
      <select
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        className={`min-h-11 px-3 text-sm ${variant === "color" ? "rounded-xl border-2 border-ink bg-white" : "rounded-th border border-th-edge bg-th-bg text-th-fg"}`}
      >
        <option value="" disabled>{t("pickFolder")}</option>
        {[...new Set(folders.map((f) => f.group))].map((group) => (
          <optgroup key={group} label={group}>
            {folders.filter((f) => f.group === group).map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );

  const feedback = (status || problems.length > 0) && (
    <div role="status" className="flex flex-col gap-1 text-[13px]">
      {status && <span>{status}</span>}
      {problems.map((problem) => (
        <span key={problem} className="text-vermilion">{problem}</span>
      ))}
    </div>
  );

  return (
    <div className="relative flex flex-col items-end gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => (currentFolderId ? input.current?.click() : setPicking((on) => !on))}
        aria-expanded={currentFolderId ? undefined : picking}
        className={variant === "color" ? b.primary.replace("bg-pink", "bg-honey") : b.primary}
      >
        <UploadIcon size={16} /> {busy ? status : t("upload")}
      </button>
      {picking && (
        <div className={`absolute top-full right-0 z-20 mt-2 flex w-72 flex-col gap-3 p-4 ${variant === "color" ? "rounded-[18px] border-2 border-ink bg-white" : "border border-th-cardline bg-th-raised text-th-fg"}`}>
          {folderSelect}
          <button type="button" disabled={!target} onClick={() => input.current?.click()} className={b.primary}>{t("chooseFiles")}</button>
        </div>
      )}
      {fileInput}
      {!busy && feedback}
    </div>
  );
}
