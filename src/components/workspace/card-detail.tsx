"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/avatar";
import { CloseIcon, TrashIcon, UploadIcon } from "@/components/icons";
import Link from "next/link";
import { useFileViewer } from "@/components/viewer/file-viewer";
import { fileSize } from "@/lib/format";
import { uploadToLibrary } from "@/lib/library-upload";
import { libraryFileSource } from "@/lib/viewer";
import { createClient } from "@/lib/supabase/client";
import type { Theme } from "@/lib/theme-shared";
import { labelColors, type LabelColor } from "@/lib/types";
import { labelHex, stageColor, stages, type BoardColumn, type Member, type Stage } from "@/lib/workspace";
import { PeoplePicker } from "./people-picker";

type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  position: number;
  done_by: string | null;
  done_at: string | null;
  assignees: string[];
};

type Comment = { id: string; author_id: string; body: string; created_at: string; parent_id: string | null };

type Detail = {
  id: string;
  title: string;
  description: string;
  due_date: string | null;
  column_id: string;
  stage: Stage | null;
  labels: { id: string; name: string; color: LabelColor }[];
  assignees: string[];
  checklist: ChecklistItem[];
  comments: Comment[];
  attachments: { id: string; file: { id: string; name: string; mime_type: string; size_bytes: number; storage_path: string | null; external_url: string | null } }[];
  events: { id: number; actor_id: string | null; kind: string; created_at: string }[];
};

type LibraryPick = { id: string; name: string; folderName: string };
type UploadNote = { tone: "ok" | "problem"; text: string };

const detailSelect =
  "id, title, description, due_date, column_id, stage, card_labels(id, name, color), card_assignees(profile_id), checklist_items(id, label, done, position, done_by, done_at, checklist_item_assignees(profile_id)), card_comments(id, author_id, body, created_at, parent_id), card_attachments(id, library_files(id, name, mime_type, size_bytes, storage_path, external_url)), card_events(id, actor_id, kind, created_at)";

// Studio (dark and white) window; the colour design has its own. The controls are the iOS-style
// "ui-" kit in every theme (globals.css); only the comment field differs, white on colour's sand column.
const studio = {
  dialog: "border border-th-line bg-th-card text-th-fg",
  aside: "bg-th-sunk",
  asideField: "ui-field ui-sm",
  heading: "font-display text-base font-semibold text-th-heading",
  muted: "text-th-muted",
  chip: "rounded-th",
  rule: "border-th-line",
  thread: "rounded-th border border-th-cardline bg-th-card",
};

const ui: Record<Theme, typeof studio> = {
  dark: studio,
  white: studio,
  color: {
    dialog: "rounded-[28px] border-2 border-ink bg-white text-ink",
    aside: "bg-sand",
    asideField: "ui-field ui-sm bg-white",
    heading: "font-display text-base font-extrabold",
    muted: "text-muted",
    chip: "rounded-full border-[1.5px] border-ink",
    rule: "border-ink",
    thread: "rounded-2xl border-2 border-ink bg-white",
  },
};

/**
 * The open task, in a window in the middle of the screen: details on the left, the discussion
 * on the right (like comments in a document). Everything saves as you go.
 */
export function CardDetail({
  cardId,
  boardId,
  projectFolderId,
  columns,
  members,
  currentUserId,
  variant,
  locale,
  onClose,
  onChanged,
}: {
  cardId: string;
  boardId: string;
  /** The project's folder in the school library, where task files are listed too. */
  projectFolderId: string | null;
  columns: BoardColumn[];
  members: Member[];
  currentUserId: string;
  variant: Theme;
  locale: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = useTranslations("workspace");
  const tLibrary = useTranslations("library");
  const openInViewer = useFileViewer();
  const s = ui[variant];
  const supabase = useMemo(() => createClient(), []);
  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newItem, setNewItem] = useState("");
  const [newLabel, setNewLabel] = useState({ name: "", color: "teal" as LabelColor });
  const [picks, setPicks] = useState<LibraryPick[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadNote, setUploadNote] = useState<UploadNote | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const titleId = `task-title-${cardId}`;
  const when = (iso: string) =>
    new Date(iso).toLocaleString(locale === "en" ? "en-GB" : "ro-RO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const nameOf = (id: string | null) => (id && memberMap.get(id)?.full_name) || t("someone");

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase.from("cards").select(detailSelect).eq("id", cardId).maybeSingle();
    if (loadError || !data) {
      setError(t("loadFailed"));
      return;
    }
    setDetail({
      id: data.id,
      title: data.title,
      description: data.description,
      due_date: data.due_date,
      column_id: data.column_id,
      stage: (data.stage as Stage | null) ?? null,
      labels: data.card_labels.map((l) => ({ ...l, color: l.color as LabelColor })),
      assignees: data.card_assignees.map((a) => a.profile_id),
      checklist: [...data.checklist_items]
        .sort((a, b) => a.position - b.position)
        .map(({ checklist_item_assignees, ...item }) => ({ ...item, assignees: checklist_item_assignees.map((a) => a.profile_id) })),
      comments: [...data.card_comments].sort((a, b) => a.created_at.localeCompare(b.created_at)),
      attachments: data.card_attachments.flatMap((a) => (a.library_files ? [{ id: a.id, file: a.library_files }] : [])),
      events: [...data.card_events].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    });
  }, [cardId, supabase, t]);

  useEffect(() => {
    // Load the task whenever another one is opened; the effect only starts the async fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on open
    void load();
  }, [load]);

  // Comments, ticks and owners from teammates appear while the window is open.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void load(), 200);
    };
    const channel = supabase
      .channel(`card:${cardId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "card_comments", filter: `card_id=eq.${cardId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "checklist_items", filter: `card_id=eq.${cardId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "checklist_item_assignees" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "card_assignees", filter: `card_id=eq.${cardId}` }, refresh)
      .subscribe();
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [cardId, load, supabase]);

  // The board re-renders on every live update; keep the latest close handler without re-running the effect below
  // (re-running it would pull focus out of whatever field someone is typing in).
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  // A real dialog: Escape closes, focus starts inside and returns where it was, the page behind doesn't scroll.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close.current();
      if (event.key === "Tab" && dialog.current) {
        const focusable = dialog.current.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, []);

  async function run(action: PromiseLike<{ error: { message: string } | null }>) {
    const { error: actionError } = await action;
    if (actionError) setError(actionError.message);
    await load();
    onChanged();
  }

  const updateCard = (patch: { title?: string; description?: string; due_date?: string | null; column_id?: string; stage?: Stage | null }) =>
    run(supabase.from("cards").update(patch).eq("id", cardId));

  function openFile(file: Detail["attachments"][number]["file"]) {
    if (file.external_url) return void window.open(file.external_url, "_blank", "noopener");
    openInViewer(libraryFileSource(file));
  }

  // Files from the library that can be attached: anything readable, except other people's personal files.
  async function loadPicks() {
    const { data } = await supabase
      .from("library_files")
      .select("id, name, library_folders(name, space, owner_id)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(80);
    const attached = new Set(detail?.attachments.map((a) => a.file.id));
    setPicks(
      (data ?? [])
        .filter((f) => !attached.has(f.id) && (f.library_folders?.space !== "personal" || f.library_folders.owner_id === currentUserId))
        .map((f) => ({ id: f.id, name: f.name, folderName: f.library_folders?.name ?? "" })),
    );
  }

  // Files from the device are saved in the uploader's own space (they count towards their storage), then
  // attached to the task; the project's folder in the library lists them too.
  async function uploadAttachments(files: File[]) {
    if (!files.length) return;
    setUploading(true);
    setUploadNote(null);
    try {
      const { data: home } = await supabase
        .from("library_folders")
        .select("id")
        .eq("space", "personal")
        .eq("owner_id", currentUserId)
        .is("parent_id", null)
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (!home) throw new Error(t("noPersonalSpace"));
      const { ids, problems } = await uploadToLibrary(supabase, home.id, files, currentUserId, (key, values) => tLibrary(key, values));
      for (const fileId of ids) {
        const attached = await supabase.from("card_attachments").insert({ card_id: cardId, file_id: fileId });
        if (attached.error) problems.push(attached.error.message);
      }
      setUploadNote(problems.length ? { tone: "problem", text: problems.join(" ") } : { tone: "ok", text: t("uploadedToMySpace", { n: ids.length }) });
      await load();
      onChanged();
    } catch (uploadError) {
      setUploadNote({ tone: "problem", text: (uploadError as Error).message });
    } finally {
      setUploading(false);
    }
  }

  const pickerStyles = { input: "ui-field ui-sm ui-search", muted: s.muted, popover: "ui-menu", chip: "rounded-full bg-th-fill" };
  const column = detail ? columns.find((c) => c.id === detail.column_id) : null;

  const details = detail && (
    <div className="flex flex-col gap-6">
      <label className="flex flex-col gap-1">
        <span className="sr-only">{t("title")}</span>
        <textarea
          id={titleId}
          key={`title-${detail.title}`}
          defaultValue={detail.title}
          rows={2}
          onBlur={(e) => e.target.value.trim() && e.target.value !== detail.title && updateCard({ title: e.target.value.trim() })}
          className={`resize-none bg-transparent font-display text-[28px] leading-[1.15] font-extrabold ${variant === "color" ? "" : "text-th-fg"}`}
        />
      </label>

      <div className="grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-[130px_1fr] sm:items-center">
        <label htmlFor="task-status" className={s.muted}>{t("status")}</label>
        <select id="task-status" value={detail.column_id} onChange={(e) => updateCard({ column_id: e.target.value })} className="ui-field ui-select ui-sm sm:w-64">
          {columns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label htmlFor="task-stage" className={s.muted}>{t("stage")}</label>
        <div className="flex items-center gap-2">
          {detail.stage && <span aria-hidden="true" className="size-3 shrink-0 rounded-full" style={{ background: stageColor[detail.stage].bg }} />}
          <select id="task-stage" value={detail.stage ?? ""} onChange={(e) => updateCard({ stage: (e.target.value || null) as Stage | null })} className="ui-field ui-select ui-sm sm:w-64">
            <option value="">{t("noStage")}</option>
            {stages.map((stage) => <option key={stage} value={stage}>{t(`stages.${stage}.name`)}</option>)}
          </select>
        </div>
        <label htmlFor="task-due" className={s.muted}>{t("due")}</label>
        <input id="task-due" type="date" defaultValue={detail.due_date ?? ""} key={`due-${detail.due_date}`} onChange={(e) => updateCard({ due_date: e.target.value || null })} className="ui-field ui-sm sm:w-64" />
        <span className={`${s.muted} self-start sm:pt-2`}>{t("assignees")}</span>
        <PeoplePicker
          members={members}
          selected={detail.assignees}
          label={t("pickAssignees")}
          styles={pickerStyles}
          onToggle={(id, on) =>
            run(
              on
                ? supabase.from("card_assignees").insert({ card_id: cardId, profile_id: id })
                : supabase.from("card_assignees").delete().eq("card_id", cardId).eq("profile_id", id),
            )
          }
        />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className={s.heading}>_ {t("labels")}</h3>
        <div className="flex flex-wrap gap-1.5">
          {detail.labels.map((label) => (
            <span key={label.id} className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium ${s.chip}`} style={{ background: labelHex[label.color].bg, color: labelHex[label.color].fg }}>
              {label.name}
              <button type="button" aria-label={t("removeLabel", { name: label.name })} onClick={() => run(supabase.from("card_labels").delete().eq("id", label.id))} className="px-0.5">×</button>
            </span>
          ))}
        </div>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newLabel.name.trim()) return;
            void run(supabase.from("card_labels").insert({ card_id: cardId, name: newLabel.name.trim(), color: newLabel.color }));
            setNewLabel({ ...newLabel, name: "" });
          }}
        >
          <label className="sr-only" htmlFor="new-label">{t("newLabel")}</label>
          <input id="new-label" value={newLabel.name} onChange={(e) => setNewLabel({ ...newLabel, name: e.target.value })} placeholder={t("newLabel")} maxLength={30} className="ui-field ui-sm min-w-0 flex-1 basis-40" />
          <label className="sr-only" htmlFor="new-label-color">{t("labelColor")}</label>
          <select id="new-label-color" value={newLabel.color} onChange={(e) => setNewLabel({ ...newLabel, color: e.target.value as LabelColor })} className="ui-field ui-select ui-sm flex-none basis-36">
            {labelColors.map((color) => <option key={color} value={color}>{t(`colors.${color}`)}</option>)}
          </select>
          <button type="submit" className="ui-btn ui-tinted ui-sm">{t("add")}</button>
        </form>
      </div>

      <label className="flex flex-col gap-2">
        <span className={s.heading}>_ {t("description")}</span>
        <textarea
          key={`desc-${detail.description}`}
          defaultValue={detail.description}
          rows={4}
          placeholder={t("descriptionPlaceholder")}
          onBlur={(e) => e.target.value !== detail.description && updateCard({ description: e.target.value })}
          className="ui-field leading-relaxed"
        />
      </label>

      <fieldset className="flex flex-col gap-1">
        <legend className={`${s.heading} mb-2`}>
          _ {t("checklist")} · {detail.checklist.filter((i) => i.done).length}/{detail.checklist.length}
        </legend>
        {detail.checklist.map((item) => (
          <div key={item.id} className={`flex flex-col gap-0.5 border-b py-2 ${s.rule}`}>
            <div className="flex items-center gap-2.5 text-sm">
              <input
                id={`item-${item.id}`}
                type="checkbox"
                checked={item.done}
                onChange={() => {
                  // Tick at once; the database then records who did it and when.
                  setDetail((d) => d && { ...d, checklist: d.checklist.map((i) => (i.id === item.id ? { ...i, done: !item.done } : i)) });
                  void run(supabase.from("checklist_items").update({ done: !item.done }).eq("id", item.id));
                }}
                className="ui-check"
              />
              <label htmlFor={`item-${item.id}`} className={`min-w-0 flex-grow ${item.done ? "line-through opacity-70" : ""}`}>{item.label}</label>
              <PeoplePicker
                mode="compact"
                members={members}
                selected={item.assignees}
                label={t("pickItemOwners", { label: item.label })}
                styles={pickerStyles}
                onToggle={(id, on) =>
                  run(
                    on
                      ? supabase.from("checklist_item_assignees").insert({ item_id: item.id, profile_id: id })
                      : supabase.from("checklist_item_assignees").delete().eq("item_id", item.id).eq("profile_id", id),
                  )
                }
              />
              <button type="button" aria-label={t("removeItem", { label: item.label })} onClick={() => run(supabase.from("checklist_items").delete().eq("id", item.id))} className={`ui-btn ui-plain ui-icon ui-sm ui-neutral shrink-0 ${s.muted}`}>
                <TrashIcon size={15} />
              </button>
            </div>
            {item.done && item.done_at && (
              <p className={`pl-8 text-xs ${s.muted}`}>✓ {t("doneBy", { name: nameOf(item.done_by), date: when(item.done_at) })}</p>
            )}
          </div>
        ))}
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newItem.trim()) return;
            const last = detail.checklist.at(-1)?.position ?? 0;
            void run(supabase.from("checklist_items").insert({ card_id: cardId, label: newItem.trim(), position: last + 1 }));
            setNewItem("");
          }}
        >
          <label className="sr-only" htmlFor="new-item">{t("newItem")}</label>
          <input id="new-item" value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder={t("newItem")} className="ui-field ui-sm" />
          <button type="submit" className="ui-btn ui-tinted ui-sm">{t("add")}</button>
        </form>
      </fieldset>

      <div
        className={`flex flex-col gap-2 rounded-[14px] transition-colors ${dragging ? "bg-th-fill outline-2 outline-teal outline-dashed" : ""}`}
        onDragOver={(e) => {
          if (![...e.dataTransfer.types].includes("Files")) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => e.currentTarget.contains(e.relatedTarget as Node) || setDragging(false)}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return;
          e.preventDefault();
          setDragging(false);
          void uploadAttachments([...e.dataTransfer.files]);
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className={s.heading}>_ {t("attachments")}</h3>
          {projectFolderId && (
            <Link href={`/app/library?folder=${projectFolderId}`} className="ui-btn ui-plain ui-sm -mr-2">
              {t("projectFolder")} →
            </Link>
          )}
        </div>
        {detail.attachments.map(({ id, file }) => (
          <div key={id} className={`flex items-center gap-2 border-b py-1.5 text-sm ${s.rule}`}>
            <button type="button" onClick={() => openFile(file)} className="flex min-w-0 flex-grow items-baseline gap-2 text-left">
              <span className="truncate underline-offset-4 hover:underline">{file.name}</span>
              {!file.external_url && <span className={`shrink-0 text-xs ${s.muted}`}>{fileSize(file.size_bytes, locale)}</span>}
            </button>
            <button type="button" aria-label={t("removeAttachment", { name: file.name })} onClick={() => run(supabase.from("card_attachments").delete().eq("id", id))} className={`ui-btn ui-plain ui-icon ui-sm ui-neutral shrink-0 ${s.muted}`}>
              <TrashIcon size={15} />
            </button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading} className="ui-btn ui-tinted">
            <UploadIcon size={16} /> {uploading ? t("uploading") : t("uploadFile")}
          </button>
          <input ref={fileInput} type="file" multiple className="hidden" onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            void uploadAttachments(files);
          }} />
          <button type="button" onClick={loadPicks} className="ui-btn ui-tinted">{t("fromLibrary")}</button>
        </div>
        <p className={`text-xs ${s.muted}`}>{t("uploadHint")}</p>
        {uploadNote && (
          <p role={uploadNote.tone === "problem" ? "alert" : "status"} className={`rounded-[10px] px-3 py-2 text-sm ${uploadNote.tone === "problem" ? "bg-vermilion/20" : "bg-teal/25"}`}>
            {uploadNote.text}
          </p>
        )}
        {picks && (
          <label className="flex flex-col gap-1 text-sm">
            <span className={s.muted}>{t("pickFile")}</span>
            <select
              defaultValue=""
              onChange={(e) => {
                if (!e.target.value) return;
                void run(supabase.from("card_attachments").insert({ card_id: cardId, file_id: e.target.value }));
                setPicks(null);
              }}
              className="ui-field ui-select"
            >
              <option value="">—</option>
              {picks.map((pick) => <option key={pick.id} value={pick.id}>{pick.folderName} / {pick.name}</option>)}
            </select>
          </label>
        )}
      </div>

      {detail.events.length > 0 && (
        <div className={`flex flex-col gap-1 text-xs ${s.muted}`}>
          <h3 className={s.heading}>_ {t("history")}</h3>
          {detail.events.slice(0, 6).map((event) => (
            <p key={event.id}>{t(`events.${event.kind}`, { name: nameOf(event.actor_id) })} · {when(event.created_at)}</p>
          ))}
        </div>
      )}

      <div className={`flex flex-wrap items-center gap-2 border-t pt-4 ${s.rule}`}>
        {confirmDelete ? (
          <>
            <span className="text-sm">{t("confirmDelete")}</span>
            <button
              type="button"
              onClick={async () => {
                await supabase.from("cards").delete().eq("id", cardId).eq("board_id", boardId);
                onChanged();
                onClose();
              }}
              className="ui-btn ui-filled ui-danger"
            >
              {t("deleteYes")}
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="ui-btn ui-gray ui-neutral">{t("cancel")}</button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="ui-btn ui-tinted ui-danger">
            <TrashIcon size={15} /> {t("deleteCard")}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-6">
      <button type="button" tabIndex={-1} aria-label={t("close")} onClick={onClose} className="absolute inset-0 cursor-default bg-ink/50" />
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={detail ? titleId : undefined}
        aria-label={detail ? undefined : t("detailLabel")}
        tabIndex={-1}
        className={`relative flex h-full w-full max-w-[1120px] flex-col overflow-hidden outline-none sm:h-[min(880px,calc(100dvh-3rem))] ${s.dialog}`}
      >
        <div className={`flex shrink-0 items-center justify-between gap-3 border-b px-5 py-3 ${s.rule}`}>
          <span className={`truncate text-sm ${s.muted}`}>
            {t("detailLabel")}{column ? ` · ${column.name}` : ""}
          </span>
          <button type="button" onClick={onClose} aria-label={t("close")} className="ui-btn ui-plain ui-icon ui-neutral shrink-0">
            <CloseIcon />
          </button>
        </div>

        {error && <p role="alert" className="mx-5 mt-3 bg-vermilion/20 px-3 py-2 text-sm">{error}</p>}

        {!detail ? (
          <p className={`p-6 ${s.muted}`}>{t("loading")}</p>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:grid md:grid-cols-[minmax(0,1fr)_360px] md:overflow-hidden">
            <div className="px-5 py-5 sm:px-7 md:min-h-0 md:overflow-y-auto">{details}</div>
            <CommentsPanel
              comments={detail.comments}
              cardId={cardId}
              currentUserId={currentUserId}
              memberMap={memberMap}
              when={when}
              styles={s}
              onRun={run}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/** The discussion: threads like comments in a document, replies under each, its own scroll bar. */
function CommentsPanel({
  comments,
  cardId,
  currentUserId,
  memberMap,
  when,
  styles: s,
  onRun,
}: {
  comments: Comment[];
  cardId: string;
  currentUserId: string;
  memberMap: Map<string, Member>;
  when: (iso: string) => string;
  styles: (typeof ui)[Theme];
  onRun: (action: PromiseLike<{ error: { message: string } | null }>) => Promise<void>;
}) {
  const t = useTranslations("workspace");
  const supabase = useMemo(() => createClient(), []);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const threads = comments.filter((c) => !c.parent_id);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);
  const lastCount = useRef(0);

  // Start at the newest message, and follow new ones as they arrive.
  useEffect(() => {
    if (comments.length > lastCount.current && list.current && !replyTo) list.current.scrollTop = list.current.scrollHeight;
    lastCount.current = comments.length;
  }, [comments.length, replyTo]);

  /** Sends a comment; the field is cleared right away and gets its text back if sending fails. */
  async function post(body: string, parentId: string | null) {
    if (!body.trim()) return true;
    setSending(true);
    let ok = true;
    await onRun(
      supabase
        .from("card_comments")
        .insert({ card_id: cardId, author_id: currentUserId, body: body.trim(), parent_id: parentId })
        .then((result) => {
          ok = !result.error;
          return result;
        }),
    );
    setSending(false);
    return ok;
  }

  const submitOnCtrlEnter = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const message = (comment: Comment, small = false) => {
    const author = memberMap.get(comment.author_id);
    return (
      <div className="flex flex-col gap-1 text-sm leading-normal">
        <div className="flex items-center gap-2">
          <Avatar id={comment.author_id} name={author?.full_name ?? "?"} size={small ? 22 : 28} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{author?.full_name ?? t("someone")}</span>
            <span className={`block text-xs ${s.muted}`}>{when(comment.created_at)}</span>
          </span>
          {comment.author_id === currentUserId && (
            <button type="button" aria-label={t("deleteComment")} onClick={() => onRun(supabase.from("card_comments").delete().eq("id", comment.id))} className={`ui-btn ui-plain ui-icon ui-sm ui-neutral shrink-0 ${s.muted}`}>
              <TrashIcon size={14} />
            </button>
          )}
        </div>
        <p className="break-words whitespace-pre-wrap">{comment.body}</p>
      </div>
    );
  };

  return (
    <aside aria-labelledby="comments-title" className={`flex flex-col border-t md:min-h-0 md:border-t-0 md:border-l ${s.rule} ${s.aside}`}>
      <h3 id="comments-title" className={`shrink-0 px-5 pt-5 pb-3 ${s.heading}`}>_ {t("comments")} · {comments.length}</h3>
      <div ref={list} tabIndex={0} aria-label={t("commentsList")} className="flex max-h-[60vh] min-h-24 flex-col gap-3 overflow-y-auto px-5 pb-4 md:max-h-none md:min-h-0 md:flex-1">
        {threads.length === 0 && <p className={`text-sm ${s.muted}`}>{t("noComments")}</p>}
        {threads.map((thread) => {
          const replies = repliesOf(thread.id);
          return (
            <article key={thread.id} className={`flex flex-col gap-3 p-3 ${s.thread}`}>
              {message(thread)}
              {replies.length > 0 && (
                <ol className={`flex flex-col gap-3 border-l-2 pl-3 ${s.rule}`} aria-label={t("replies")}>
                  {replies.map((r) => <li key={r.id}>{message(r, true)}</li>)}
                </ol>
              )}
              {replyTo === thread.id ? (
                <form
                  className="flex flex-col gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const body = reply;
                    setReply("");
                    setReplyTo(null);
                    void post(body, thread.id).then((ok) => {
                      if (!ok) {
                        setReplyTo(thread.id);
                        setReply(body);
                      }
                    });
                  }}
                >
                  <label className="sr-only" htmlFor={`reply-${thread.id}`}>{t("replyTo", { name: memberMap.get(thread.author_id)?.full_name ?? t("someone") })}</label>
                  <textarea id={`reply-${thread.id}`} autoFocus rows={2} value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={submitOnCtrlEnter}
                    placeholder={t("replyPlaceholder")} className="ui-field ui-sm" />
                  <div className="flex gap-2">
                    <button type="submit" disabled={sending || !reply.trim()} className="ui-btn ui-filled ui-sm">{t("reply")}</button>
                    <button type="button" onClick={() => setReplyTo(null)} className="ui-btn ui-gray ui-neutral ui-sm">{t("cancel")}</button>
                  </div>
                </form>
              ) : (
                <button type="button" onClick={() => { setReplyTo(thread.id); setReply(""); }} className="ui-btn ui-plain ui-sm ui-neutral -ml-2 self-start">
                  {t("reply")}
                </button>
              )}
            </article>
          );
        })}
      </div>
      <form
        className={`flex shrink-0 flex-col gap-2 border-t p-4 ${s.rule}`}
        onSubmit={(e) => {
          e.preventDefault();
          const body = draft;
          setDraft("");
          void post(body, null).then((ok) => !ok && setDraft(body));
        }}
      >
        <label className="sr-only" htmlFor="new-comment">{t("newComment")}</label>
        <textarea id="new-comment" rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={submitOnCtrlEnter} placeholder={t("newComment")} className={s.asideField} />
        <button type="submit" disabled={sending || !draft.trim()} className="ui-btn ui-filled self-start">{t("send")}</button>
      </form>
    </aside>
  );
}
