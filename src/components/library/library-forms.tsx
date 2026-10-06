"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { addLink, createFolder, updateFile } from "@/app/app/library/actions";
import { Field, FormAlert, SelectField, SubmitButton, TextAreaField, type ActionState } from "@/components/form";
import { moduleButtons } from "@/components/page-header";
import { createClient } from "@/lib/supabase/client";
import type { Theme } from "@/lib/theme-shared";

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

export function NewFolderForm({ schools, isStaff }: { schools: { id: string; name: string }[]; isStaff: boolean }) {
  const t = useTranslations();
  const [state, action] = useActionState<ActionState, FormData>(createFolder, {});
  const form = useResetOnDone(state);
  return (
    <form ref={form} action={action} className="flex flex-col gap-3">
      <Field id="folder-name" name="name" label={t("library.folderName")} required maxLength={80} />
      {isStaff && (
        <SelectField id="folder-target" name="target" label={t("library.space")} defaultValue="shared">
          <option value="shared">{t("library.shared")}</option>
          {schools.map((school) => (
            <option key={school.id} value={school.id}>{school.name}</option>
          ))}
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
  const panel =
    variant === "color" ? "rounded-[18px] border-2 border-ink bg-white" : "border border-th-cardline bg-th-raised text-th-fg";

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
        <div className={`absolute right-0 bottom-full z-30 mb-2 flex max-h-80 w-[min(320px,85vw)] flex-col gap-2 p-3 ${panel}`}>
          <label className="sr-only" htmlFor={`attach-search-${fileId}`}>{t("searchTasks")}</label>
          <input
            id={`attach-search-${fileId}`}
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchTasks")}
            className={`min-h-11 px-3 text-sm ${variant === "color" ? "rounded-xl border-2 border-ink" : "border border-th-edge bg-th-bg text-th-fg"}`}
          />
          {done && <p role="status" className="text-[13px]">{t("attachedTo", { title: done })}</p>}
          {error && <p role="alert" className="text-[13px] text-vermilion">{error}</p>}
          <ul className="flex flex-col overflow-y-auto">
            {cards === null && <li className="p-2 text-sm">{t("loading")}</li>}
            {cards !== null && shown.length === 0 && <li className="p-2 text-sm">{t("noTasks")}</li>}
            {shown.map((card) => (
              <li key={card.id}>
                <button type="button" onClick={() => void attach(card)} className="flex min-h-11 w-full flex-col items-start px-2 py-1.5 text-left text-sm hover:underline">
                  <span className="font-medium">{card.title}</span>
                  <span className="text-xs opacity-75">{card.board}</span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setOpen(false)} className={b.ghost}>{t("close")}</button>
        </div>
      )}
    </div>
  );
}
