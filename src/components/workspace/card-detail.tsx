"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/avatar";
import { CloseIcon, TrashIcon, UploadIcon } from "@/components/icons";
import { maxUploadBytes, storageSafeName } from "@/lib/library";
import { createClient } from "@/lib/supabase/client";
import type { Theme } from "@/lib/theme-shared";
import { labelColors, type LabelColor } from "@/lib/types";
import { labelHex, type BoardColumn, type Member } from "@/lib/workspace";

type Detail = {
  id: string;
  title: string;
  description: string;
  due_date: string | null;
  column_id: string;
  labels: { id: string; name: string; color: LabelColor }[];
  assignees: string[];
  checklist: { id: string; label: string; done: boolean; position: number }[];
  comments: { id: string; author_id: string; body: string; created_at: string }[];
  attachments: { id: string; file: { id: string; name: string; size_bytes: number; storage_path: string | null; external_url: string | null } }[];
  events: { id: number; actor_id: string | null; kind: string; created_at: string }[];
};

type LibraryPick = { id: string; name: string; folderName: string };

// Studio (dark and white) panel; the colour design has its own.
const studio: Record<string, string> = {
  panel: "bg-th-card text-th-fg",
  input: "w-full rounded-th border border-th-edge bg-th-bg px-3 py-2.5 text-[15px] text-th-fg",
  button: "min-h-11 rounded-th bg-teal px-4 font-display font-semibold text-ink",
  ghost: "min-h-11 rounded-th border border-th-edge px-3 text-sm text-th-fg hover:border-th-fg",
  heading: "font-display text-base font-semibold text-th-heading",
  muted: "text-th-muted",
  chip: "rounded-th",
  rule: "border-th-line",
};

const ui: Record<Theme, Record<string, string>> = {
  dark: studio,
  white: studio,
  color: {
    panel: "bg-white text-ink",
    input: "w-full rounded-xl border-2 border-ink bg-white px-3 py-2.5 text-[15px]",
    button: "min-h-11 rounded-full border-2 border-ink bg-pink px-5 font-display font-bold",
    ghost: "min-h-11 rounded-full border-2 border-ink px-4 text-sm font-medium",
    heading: "font-display text-base font-extrabold",
    muted: "text-muted",
    chip: "rounded-full border-[1.5px] border-ink",
    rule: "border-ink",
  },
};

/** The open task: everything WS-3, WS-5 and WS-8 ask for. Saves as you go. */
export function CardDetail({
  cardId,
  boardId,
  schoolId,
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
  schoolId: string;
  columns: BoardColumn[];
  members: Member[];
  currentUserId: string;
  variant: Theme;
  locale: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = useTranslations("workspace");
  const s = ui[variant];
  const supabase = useMemo(() => createClient(), []);
  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newItem, setNewItem] = useState("");
  const [newComment, setNewComment] = useState("");
  const [newLabel, setNewLabel] = useState({ name: "", color: "teal" as LabelColor });
  const [picks, setPicks] = useState<LibraryPick[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from("cards")
      .select(
        "id, title, description, due_date, column_id, card_labels(id, name, color), card_assignees(profile_id), checklist_items(id, label, done, position), card_comments(id, author_id, body, created_at), card_attachments(id, library_files(id, name, size_bytes, storage_path, external_url)), card_events(id, actor_id, kind, created_at)",
      )
      .eq("id", cardId)
      .maybeSingle();
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
      labels: data.card_labels.map((l) => ({ ...l, color: l.color as LabelColor })),
      assignees: data.card_assignees.map((a) => a.profile_id),
      checklist: [...data.checklist_items].sort((a, b) => a.position - b.position),
      comments: [...data.card_comments].sort((a, b) => a.created_at.localeCompare(b.created_at)),
      attachments: data.card_attachments.flatMap((a) => (a.library_files ? [{ id: a.id, file: a.library_files }] : [])),
      events: [...data.card_events].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    });
  }, [cardId, supabase, t]);

  useEffect(() => {
    // Load the card whenever another one is opened; the effect only starts the async fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on open
    void load();
  }, [load]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function run(action: PromiseLike<{ error: { message: string } | null }>) {
    const { error: actionError } = await action;
    if (actionError) setError(actionError.message);
    await load();
    onChanged();
  }

  const updateCard = (patch: { title?: string; description?: string; due_date?: string | null; column_id?: string }) =>
    run(supabase.from("cards").update(patch).eq("id", cardId));

  async function openFile(file: { storage_path: string | null; external_url: string | null }) {
    if (file.external_url) return void window.open(file.external_url, "_blank", "noopener");
    if (!file.storage_path) return;
    const { data } = await supabase.storage.from("library").createSignedUrl(file.storage_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }

  async function loadPicks() {
    const { data } = await supabase
      .from("library_files")
      .select("id, name, library_folders(name, space, school_id)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(60);
    setPicks((data ?? []).map((f) => ({ id: f.id, name: f.name, folderName: f.library_folders?.name ?? "" })));
  }

  async function uploadAttachment(file: File) {
    setUploading(true);
    setError(null);
    try {
      // Device uploads land in the school's "Attachments" folder so they are also in the library (WS-5).
      const folderName = t("attachmentsFolder");
      let { data: folder } = await supabase
        .from("library_folders")
        .select("id")
        .eq("space", "school")
        .eq("school_id", schoolId)
        .eq("name", folderName)
        .maybeSingle();
      if (!folder) {
        const created = await supabase
          .from("library_folders")
          .insert({ space: "school", school_id: schoolId, name: folderName, created_by: currentUserId })
          .select("id")
          .single();
        if (created.error) throw created.error;
        folder = created.data;
      }
      if (file.size > maxUploadBytes) throw new Error(t("tooLarge"));
      const path = `${folder.id}/${crypto.randomUUID()}-${storageSafeName(file.name)}`;
      const upload = await supabase.storage.from("library").upload(path, file, { contentType: file.type || undefined });
      if (upload.error) throw upload.error;
      const inserted = await supabase
        .from("library_files")
        .insert({ folder_id: folder.id, name: file.name, mime_type: file.type || "application/octet-stream", size_bytes: file.size, storage_path: path, uploaded_by: currentUserId })
        .select("id")
        .single();
      if (inserted.error) throw inserted.error;
      await run(supabase.from("card_attachments").insert({ card_id: cardId, file_id: inserted.data.id }));
    } catch (uploadError) {
      setError((uploadError as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const container = `fixed inset-y-0 right-0 z-50 flex w-full max-w-[440px] flex-col gap-5 overflow-y-auto px-6 py-5 shadow-none ${variant === "color" ? "border-l-2 border-ink" : "border-l border-th-line"}`;

  const body = (
    <section role="dialog" aria-modal aria-label={t("detailLabel")} className={`${container} ${s.panel}`}>
      <div className="flex items-center justify-between gap-3">
        {detail ? (
          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only">{t("status")}</span>
            <select value={detail.column_id} onChange={(e) => updateCard({ column_id: e.target.value })} className={`${s.input} w-auto py-1.5 text-sm`}>
              {columns.map((column) => (
                <option key={column.id} value={column.id}>{column.name}</option>
              ))}
            </select>
          </label>
        ) : <span />}
        <button type="button" onClick={onClose} aria-label={t("close")} className="grid size-11 place-items-center">
          <CloseIcon />
        </button>
      </div>

      {error && <p role="alert" className="bg-vermilion/20 px-3 py-2 text-sm">{error}</p>}
      {!detail ? (
        <p className={s.muted}>{t("loading")}</p>
      ) : (
        <>
          <label className="flex flex-col gap-1">
            <span className="sr-only">{t("title")}</span>
            <textarea
              key={`title-${detail.title}`}
              defaultValue={detail.title}
              rows={2}
              onBlur={(e) => e.target.value.trim() && e.target.value !== detail.title && updateCard({ title: e.target.value.trim() })}
              className={`resize-none bg-transparent font-display text-[26px] leading-[1.15] font-extrabold ${variant === "color" ? "" : "text-th-fg"}`}
            />
          </label>

          <div className="grid grid-cols-[110px_1fr] items-center gap-y-3 text-sm">
            <span className={s.muted}>{t("due")}</span>
            <input
              type="date"
              defaultValue={detail.due_date ?? ""}
              key={`due-${detail.due_date}`}
              onChange={(e) => updateCard({ due_date: e.target.value || null })}
              className={`${s.input} py-1.5`}
            />
            <span className={s.muted}>{t("assignees")}</span>
            <div className="flex flex-wrap gap-1.5">
              {members.map((member) => {
                const on = detail.assignees.includes(member.id);
                return (
                  <button
                    key={member.id}
                    type="button"
                    aria-pressed={on}
                    title={member.full_name}
                    onClick={() =>
                      run(
                        on
                          ? supabase.from("card_assignees").delete().eq("card_id", cardId).eq("profile_id", member.id)
                          : supabase.from("card_assignees").insert({ card_id: cardId, profile_id: member.id }),
                      )
                    }
                    className={`rounded-full p-0.5 ${on ? "ring-2 ring-offset-1 " + (variant === "color" ? "ring-ink" : "ring-th-link ring-offset-th-card") : "opacity-50 hover:opacity-100"}`}
                  >
                    <Avatar id={member.id} name={member.full_name} size={30} />
                    <span className="sr-only">{member.full_name}</span>
                  </button>
                );
              })}
            </div>
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
              <input id="new-label" value={newLabel.name} onChange={(e) => setNewLabel({ ...newLabel, name: e.target.value })} placeholder={t("newLabel")} maxLength={30} className={`${s.input} w-36 py-1.5 text-sm`} />
              <label className="sr-only" htmlFor="new-label-color">{t("labelColor")}</label>
              <select id="new-label-color" value={newLabel.color} onChange={(e) => setNewLabel({ ...newLabel, color: e.target.value as LabelColor })} className={`${s.input} w-auto py-1.5 text-sm`}>
                {labelColors.map((color) => <option key={color} value={color}>{t(`colors.${color}`)}</option>)}
              </select>
              <button type="submit" className={s.ghost}>{t("add")}</button>
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
              className={`${s.input} text-[15px] leading-relaxed`}
            />
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className={`${s.heading} mb-2`}>
              _ {t("checklist")} · {detail.checklist.filter((i) => i.done).length}/{detail.checklist.length}
            </legend>
            {detail.checklist.map((item) => (
              <div key={item.id} className="flex items-center gap-2.5 text-sm">
                <input
                  id={`item-${item.id}`}
                  type="checkbox"
                  checked={item.done}
                  onChange={() => run(supabase.from("checklist_items").update({ done: !item.done }).eq("id", item.id))}
                  className={`size-[18px] ${variant === "color" ? "accent-ink" : "accent-th-link"}`}
                />
                <label htmlFor={`item-${item.id}`} className={`flex-grow ${item.done ? "line-through opacity-70" : ""}`}>{item.label}</label>
                <button type="button" aria-label={t("removeItem", { name: item.label })} onClick={() => run(supabase.from("checklist_items").delete().eq("id", item.id))} className={`grid size-8 place-items-center ${s.muted}`}>
                  <TrashIcon size={15} />
                </button>
              </div>
            ))}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newItem.trim()) return;
                const last = detail.checklist.at(-1)?.position ?? 0;
                void run(supabase.from("checklist_items").insert({ card_id: cardId, label: newItem.trim(), position: last + 1 }));
                setNewItem("");
              }}
            >
              <label className="sr-only" htmlFor="new-item">{t("newItem")}</label>
              <input id="new-item" value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder={t("newItem")} className={`${s.input} py-1.5 text-sm`} />
              <button type="submit" className={s.ghost}>{t("add")}</button>
            </form>
          </fieldset>

          <div className="flex flex-col gap-2">
            <h3 className={s.heading}>_ {t("attachments")}</h3>
            {detail.attachments.map(({ id, file }) => (
              <div key={id} className={`flex items-center gap-2 border-b py-2 text-sm ${s.rule}`}>
                <button type="button" onClick={() => void openFile(file)} className="flex-grow truncate text-left underline-offset-4 hover:underline">
                  {file.name}
                </button>
                <button type="button" aria-label={t("removeAttachment", { name: file.name })} onClick={() => run(supabase.from("card_attachments").delete().eq("id", id))} className={`grid size-8 place-items-center ${s.muted}`}>
                  <TrashIcon size={15} />
                </button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading} className={`${s.ghost} inline-flex items-center gap-2`}>
                <UploadIcon size={16} /> {uploading ? t("uploading") : t("uploadFile")}
              </button>
              <input ref={fileInput} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && uploadAttachment(e.target.files[0])} />
              <button type="button" onClick={loadPicks} className={s.ghost}>{t("fromLibrary")}</button>
            </div>
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
                  className={s.input}
                >
                  <option value="">—</option>
                  {picks.map((pick) => <option key={pick.id} value={pick.id}>{pick.folderName} / {pick.name}</option>)}
                </select>
              </label>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <h3 className={s.heading}>_ {t("comments")} · {detail.comments.length}</h3>
            {detail.comments.map((comment) => {
              const author = memberMap.get(comment.author_id);
              return (
                <div key={comment.id} className="text-sm leading-normal">
                  <div className="flex items-center gap-2 font-medium">
                    {author?.full_name ?? "—"}
                    <span className={`text-xs font-normal ${s.muted}`}>· {new Date(comment.created_at).toLocaleString(locale === "en" ? "en-GB" : "ro-RO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    {comment.author_id === currentUserId && (
                      <button type="button" aria-label={t("deleteComment")} onClick={() => run(supabase.from("card_comments").delete().eq("id", comment.id))} className={`ml-auto grid size-8 place-items-center ${s.muted}`}>
                        <TrashIcon size={14} />
                      </button>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap">{comment.body}</p>
                </div>
              );
            })}
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newComment.trim()) return;
                void run(supabase.from("card_comments").insert({ card_id: cardId, author_id: currentUserId, body: newComment.trim() }));
                setNewComment("");
              }}
            >
              <label className="flex flex-col gap-1 text-sm">
                <span className={s.muted}>{t("newComment")}</span>
                <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} rows={2} className={s.input} />
              </label>
              <button type="submit" className={`${s.button} self-start`}>{t("send")}</button>
            </form>
          </div>

          {detail.events.length > 0 && (
            <div className={`flex flex-col gap-1 text-xs ${s.muted}`}>
              {detail.events.slice(0, 6).map((event) => (
                <p key={event.id}>
                  {t(`events.${event.kind}`, { name: (event.actor_id && memberMap.get(event.actor_id)?.full_name) || t("someone") })} ·{" "}
                  {new Date(event.created_at).toLocaleString(locale === "en" ? "en-GB" : "ro-RO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              ))}
            </div>
          )}

          <div className={`mt-2 flex flex-wrap items-center gap-2 border-t pt-4 ${s.rule}`}>
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
                  className={`${s.ghost} bg-vermilion text-ink`}
                >
                  {t("deleteYes")}
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className={s.ghost}>{t("cancel")}</button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className={`${s.ghost} inline-flex items-center gap-2`}>
                <TrashIcon size={15} /> {t("deleteCard")}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );

  return (
    <>
      <button type="button" aria-label={t("close")} onClick={onClose} className="fixed inset-0 z-40 cursor-default bg-ink/40" />
      {body}
    </>
  );
}
