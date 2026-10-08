"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { addLink, createFolder, moveItemForm, shareItem, unshareItem, updateFile } from "@/app/app/library/actions";
import { Field, FormAlert, SelectField, SubmitButton, TextAreaField, selectClass, type ActionState } from "@/components/form";
import { moduleButtons } from "@/components/page-header";
import { PeoplePicker } from "@/components/workspace/people-picker";
import { createClient } from "@/lib/supabase/client";
import type { Theme } from "@/lib/theme-shared";
import type { Member } from "@/lib/workspace";

function useResetOnDone(state: ActionState) {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.done) form.current?.reset();
  }, [state.done]);
  return form;
}

function Feedback({ state }: { state: ActionState }) {
  const t = useTranslations();
  if (state.error) return <FormAlert tone="error">{t(state.error)}</FormAlert>;
  if (state.message) return <FormAlert tone="success">{t(state.message)}</FormAlert>;
  return null;
}

export function NewFolderForm({
  schools,
  isStaff,
  parent,
}: {
  schools: { id: string; name: string }[];
  isStaff: boolean;
  /** The open folder, when the new folder goes inside it. */
  parent: { id: string; name: string } | null;
}) {
  const t = useTranslations();
  const [state, action] = useActionState<ActionState, FormData>(createFolder, {});
  const form = useResetOnDone(state);
  return (
    <form ref={form} action={action} className="flex flex-col gap-3">
      <Field id="folder-name" name="name" label={t("library.folderName")} required maxLength={80} />
      {parent ? (
        <>
          <input type="hidden" name="parent" value={parent.id} />
          <p className="text-[13px]">{t("library.insideFolder", { name: parent.name })}</p>
        </>
      ) : (
        <SelectField id="folder-target" name="target" label={t("library.space")} defaultValue="personal">
          <option value="personal">{t("library.mySpace")}</option>
          {isStaff ? (
            <>
              <option value="shared">{t("library.shared")}</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>{school.name}</option>
              ))}
            </>
          ) : (
            <option value="school">{t("library.mySchool")}</option>
          )}
        </SelectField>
      )}
      <Feedback state={state} />
      <SubmitButton pendingLabel={t("common.sending")}>{t("library.createFolder")}</SubmitButton>
    </form>
  );
}

export function AddLinkForm({ folderId }: { folderId: string }) {
  const t = useTranslations();
  const [state, action] = useActionState<ActionState, FormData>(addLink, {});
  const form = useResetOnDone(state);
  return (
    <form ref={form} action={action} className="flex flex-col gap-3">
      <input type="hidden" name="folderId" value={folderId} />
      <Field id="link-url" name="url" type="url" required label={t("library.linkUrl")} placeholder="https://" />
      <Field id="link-name" name="name" required maxLength={200} label={t("library.linkName")} />
      <Field id="link-tags" name="tags" label={t("library.tags")} hint={t("library.tagsHint")} />
      <Feedback state={state} />
      <SubmitButton pendingLabel={t("common.sending")}>{t("library.addLink")}</SubmitButton>
    </form>
  );
}

export function EditFileForm({ file }: { file: { id: string; name: string; description: string; tags: string[] } }) {
  const t = useTranslations();
  const [state, action] = useActionState<ActionState, FormData>(updateFile, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={file.id} />
      <Field id="file-name" name="name" required maxLength={200} defaultValue={file.name} label={t("library.fileName")} />
      <TextAreaField id="file-description" name="description" rows={3} maxLength={2000} defaultValue={file.description} label={t("library.description")} />
      <Field id="file-tags" name="tags" defaultValue={file.tags.join(", ")} label={t("library.tags")} hint={t("library.tagsHint")} />
      <Feedback state={state} />
      <SubmitButton pendingLabel={t("common.sending")}>{t("common.save")}</SubmitButton>
    </form>
  );
}

export function CopyLinkButton({ fileId, className }: { fileId: string; className: string }) {
  const t = useTranslations("library");
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await navigator.clipboard.writeText(`${window.location.origin}/app/library?file=${fileId}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      <span aria-live="polite">{copied ? t("copied") : t("copyLink")}</span>
    </button>
  );
}

type CardPick = { id: string; title: string; board: string };

/** "Attach to a task" from the mockups: links this file to a card on one of the person's boards (WS-5). */
export function AttachToCard({ fileId, variant, className }: { fileId: string; variant: Theme; className: string }) {
  const t = useTranslations("library");
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [cards, setCards] = useState<CardPick[] | null>(null);
  const [search, setSearch] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const b = moduleButtons[variant];

  async function load() {
    const { data } = await supabase
      .from("cards")
      .select("id, title, boards!inner(name, archived_at)")
      .is("boards.archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(80);
    setCards((data ?? []).map((card) => ({ id: card.id, title: card.title, board: card.boards.name })));
  }

  async function attach(card: CardPick) {
    setError(null);
    const { error: attachError } = await supabase.from("card_attachments").insert({ card_id: card.id, file_id: fileId });
    if (attachError) setError(attachError.code === "23505" ? t("alreadyAttached") : attachError.message);
    else setDone(card.title);
  }

  const shown = (cards ?? []).filter((card) => `${card.title} ${card.board}`.toLocaleLowerCase("ro").includes(search.toLocaleLowerCase("ro")));

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        className={className}
        onClick={() => {
          setOpen((on) => !on);
          if (!cards) void load();
        }}
      >
        {t("attachToTask")}
      </button>
      {open && (
        <div className="ui-menu absolute right-0 bottom-full z-30 mb-2 flex max-h-80 w-[min(320px,85vw)] flex-col gap-1.5 p-2 md:w-full">
          <label className="sr-only" htmlFor={`attach-search-${fileId}`}>{t("searchTasks")}</label>
          <input
            id={`attach-search-${fileId}`}
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchTasks")}
            className="ui-field ui-sm ui-search"
          />
          {done && <p role="status" className="px-2 text-[13px]">{t("attachedTo", { title: done })}</p>}
          {error && <p role="alert" className="px-2 text-[13px] text-th-danger">{error}</p>}
          <ul className="flex flex-col overflow-y-auto">
            {cards === null && <li className="px-3 py-2 text-sm text-th-muted">{t("loading")}</li>}
            {cards !== null && shown.length === 0 && <li className="px-3 py-2 text-sm text-th-muted">{t("noTasks")}</li>}
            {shown.map((card) => (
              <li key={card.id}>
                <button type="button" onClick={() => void attach(card)} className="ui-menu-item min-h-11 flex-col items-start justify-center gap-0 py-1.5 text-sm">
                  <span className="font-medium">{card.title}</span>
                  <span className="text-xs text-th-muted">{card.board}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="ui-menu-sep" />
          <button type="button" onClick={() => setOpen(false)} className={`${b.ghost} ui-sm`}>{t("close")}</button>
        </div>
      )}
    </div>
  );
}

/** "Move to…": the keyboard-friendly twin of dragging a file or folder onto another folder. */
export function MoveForm({
  kind,
  id,
  targets,
  current,
  variant,
}: {
  kind: "file" | "folder";
  id: string;
  targets: { id: string; label: string }[];
  current: string | null;
  variant: Theme;
}) {
  const t = useTranslations();
  const [state, action] = useActionState<ActionState, FormData>(moveItemForm, {});
  const b = moduleButtons[variant];
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <label className="flex flex-col gap-1.5 text-sm">
        {kind === "file" ? t("library.moveFileTo") : t("library.moveFolderTo")}
        <select name="to" defaultValue="" required className={selectClass}>
          <option value="" disabled>{t("library.pickFolder")}</option>
          {kind === "folder" && <option value="root">{t("library.toTop")}</option>}
          {targets.filter((f) => f.id !== current && f.id !== id).map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
      </label>
      <Feedback state={state} />
      <SubmitButton pendingLabel={t("common.sending")} className={b.ghost}>{t("library.move")}</SubmitButton>
    </form>
  );
}

/** Share a file or folder of one's personal space with people from the team (read-only for them). */
export function SharePanel({
  kind,
  id,
  shares,
  variant,
  meId,
}: {
  kind: "file" | "folder";
  id: string;
  shares: { id: string; profileId: string; name: string }[];
  variant: Theme;
  meId: string;
}) {
  const t = useTranslations();
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [people, setPeople] = useState<Member[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const b = moduleButtons[variant];

  useEffect(() => {
    let live = true;
    void supabase
      .from("profiles")
      .select("id, full_name, role")
      .is("deactivated_at", null)
      .neq("id", meId)
      .order("full_name")
      .limit(500)
      .then(({ data }) => live && setPeople((data ?? []) as Member[]));
    return () => {
      live = false;
    };
  }, [supabase, meId]);

  const already = new Set(shares.map((s) => s.profileId));
  // The picker's own popover is positioned by PeoplePicker; the kit gives it the iOS menu look. It opens
  // inside another ui-menu panel, where a second backdrop blur can't see the page, so it is opaque.
  const styles = {
    input: "ui-field ui-search",
    muted: variant === "color" ? "text-muted" : "text-th-muted",
    popover: "ui-menu bg-th-high",
    chip: "rounded-full bg-th-fill",
  };

  async function share() {
    if (!picked.length) return;
    setBusy(true);
    setError(null);
    const result = await shareItem({ kind, id, people: picked });
    setBusy(false);
    if (result.error) setError(t(result.error));
    else {
      setPicked([]);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px]">{kind === "file" ? t("library.shareFileHint") : t("library.shareFolderHint")}</p>
      {shares.length > 0 && (
        <ul className="flex flex-col gap-1" aria-label={t("library.sharedWith")}>
          {shares.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
              <span>{s.name}</span>
              <form action={unshareItem}>
                <input type="hidden" name="id" value={s.id} />
                <button type="submit" className="ui-btn ui-plain ui-sm ui-danger -mr-2" aria-label={t("library.unshare", { name: s.name })}>{t("library.stopSharing")}</button>
              </form>
            </li>
          ))}
        </ul>
      )}
      {people === null ? (
        <p className="text-sm">{t("library.loading")}</p>
      ) : (
        <PeoplePicker
          members={people.filter((p) => !already.has(p.id))}
          selected={picked}
          onToggle={(pid, on) => setPicked((prev) => (on ? [...prev, pid] : prev.filter((x) => x !== pid)))}
          label={t("library.shareWith")}
          styles={styles}
        />
      )}
      {error && <FormAlert tone="error">{error}</FormAlert>}
      <button type="button" disabled={busy || !picked.length} onClick={() => void share()} className={b.primary}>
        {t("library.share")}
      </button>
    </div>
  );
}
