"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { badgeOf } from "@/lib/library";
import { createClient } from "@/lib/supabase/client";

type Pick = { id: string; name: string; mime_type: string; external_url: string | null; space: "personal" | "school" | "shared"; folder: string };

/**
 * Choose a file from the resource library to send: one's personal space, the team's space or the
 * re_form library. Personal files become visible to everyone in the chat (shared automatically).
 */
export function ResourcePicker({
  meId,
  onPick,
  onClose,
  panelClass,
  inputClass,
  tabClass,
}: {
  meId: string;
  onPick: (file: { id: string; name: string }, note: string) => Promise<boolean>;
  onClose: () => void;
  panelClass: string;
  inputClass: string;
  tabClass: (active: boolean) => string;
}) {
  const t = useTranslations("messages");
  const supabase = useMemo(() => createClient(), []);
  const [files, setFiles] = useState<Pick[] | null>(null);
  const [space, setSpace] = useState<Pick["space"]>("personal");
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void supabase
      .from("library_files")
      .select("id, name, mime_type, external_url, library_folders!inner(space, owner_id, name)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(300)
      .then(({ data }) => {
        if (!live) return;
        setFiles(
          (data ?? [])
            // Someone else's personal files (shared with me) can't be passed on.
            .filter((f) => f.library_folders.space !== "personal" || f.library_folders.owner_id === meId)
            .map((f) => ({ id: f.id, name: f.name, mime_type: f.mime_type, external_url: f.external_url, space: f.library_folders.space as Pick["space"], folder: f.library_folders.name })),
        );
      });
    return () => {
      live = false;
    };
  }, [supabase, meId]);

  const needle = query.trim().toLocaleLowerCase("ro");
  const shown = (files ?? []).filter((f) => f.space === space && (!needle || `${f.name} ${f.folder}`.toLocaleLowerCase("ro").includes(needle)));

  return (
    <div role="dialog" aria-label={t("fromResources")} className={`absolute bottom-full left-0 z-30 mb-2 flex max-h-[420px] w-[min(420px,calc(100vw-2rem))] flex-col gap-2.5 p-3 ${panelClass}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-display font-semibold">{t("fromResources")}</span>
        <button type="button" onClick={onClose} aria-label={t("close")} className="grid size-9 place-items-center">×</button>
      </div>
      <div role="tablist" className="flex flex-wrap gap-1.5">
        {(["personal", "school", "shared"] as const).map((name) => (
          <button key={name} type="button" role="tab" aria-selected={space === name} onClick={() => setSpace(name)} className={tabClass(space === name)}>
            {t(`spaces.${name}`)}
          </button>
        ))}
      </div>
      <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("searchFiles")} aria-label={t("searchFiles")} className={inputClass} />
      <ul className="flex min-h-24 flex-col overflow-y-auto">
        {files === null && <li className="p-2 text-sm">{t("loading")}</li>}
        {files !== null && shown.length === 0 && <li className="p-2 text-sm opacity-80">{t("noFilesHere")}</li>}
        {shown.map((file) => {
          const badge = badgeOf(file);
          return (
            <li key={file.id}>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={async () => {
                  setBusy(file.id);
                  const ok = await onPick(file, note);
                  setBusy(null);
                  if (ok) onClose();
                }}
                className="flex min-h-11 w-full items-center gap-3 rounded-lg px-1.5 py-1.5 text-left hover:bg-black/5"
              >
                <span className="w-11 shrink-0 py-1 text-center font-display text-[10px] font-bold" style={{ background: badge.bg, color: badge.fg }}>{badge.label.slice(0, 5)}</span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{file.name}</span>
                  <span className="truncate text-xs opacity-75">{busy === file.id ? t("sending") : file.folder}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <label className="flex flex-col gap-1 text-xs">
        {t("addNote")}
        <input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} className={inputClass} />
      </label>
      {space === "personal" && <p className="text-xs opacity-80">{t("personalShareNote")}</p>}
    </div>
  );
}
