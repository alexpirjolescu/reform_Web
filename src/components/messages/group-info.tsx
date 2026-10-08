"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Avatar, avatarColor, initialsOf } from "@/components/avatar";
import { PeoplePicker } from "@/components/workspace/people-picker";
import { storageSafeName } from "@/lib/library";
import type { ChatMessage, SelectedConversation } from "@/lib/messages";
import { createClient } from "@/lib/supabase/client";
import type { Theme } from "@/lib/theme-shared";
import type { Member } from "@/lib/workspace";

/** A group's picture, or its initials on a brand colour. */
export function GroupAvatar({ id, title, photoUrl, size = 44, ring }: { id: string; title: string; photoUrl: string | null; size?: number; ring?: string }) {
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage
    return <img src={photoUrl} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size, border: ring ? `2px solid ${ring}` : undefined }} />;
  }
  const bg = avatarColor(id);
  return (
    <span aria-hidden="true" className="grid shrink-0 place-items-center rounded-[30%] font-display font-bold"
      style={{ width: size, height: size, background: bg, color: bg === "#79569a" ? "#fff" : "#221f20", fontSize: Math.round(size * 0.36), border: ring ? `2px solid ${ring}` : undefined }}>
      {initialsOf(title)}
    </span>
  );
}

const urlPattern = /https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/g;

/** The people picker in the iOS-style kit: a menu-like list and soft chips (same in every theme). */
const pickerStyles = (input: string, muted: string) => ({ input, muted, popover: "ui-menu", chip: "rounded-full bg-th-fill" });

/**
 * Group info, as on WhatsApp: photo, name and description, members and admins, adding and removing
 * people, who may write or change things, mute, pinned messages, files and links, leaving.
 */
export function GroupInfo({
  conversation,
  meId,
  variant,
  messages,
  onClose,
  onChanged,
  onJump,
  onOpenAttachment,
}: {
  conversation: SelectedConversation;
  meId: string;
  variant: Theme;
  messages: ChatMessage[];
  onClose: () => void;
  onChanged: () => void;
  onJump: (id: string) => void;
  onOpenAttachment: (path: string) => void;
}) {
  const t = useTranslations("messages");
  const tr = useTranslations("roles");
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(conversation.title);
  const [description, setDescription] = useState(conversation.description);
  const [adding, setAdding] = useState(false);
  const [people, setPeople] = useState<Member[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [leaving, setLeaving] = useState(false);
  const [tab, setTab] = useState<"files" | "links">("files");
  const photoInput = useRef<HTMLInputElement>(null);
  const studio = variant !== "color";
  const admin = conversation.myRole === "admin";
  const muted = studio ? "text-th-muted" : "text-muted";
  const input = "ui-field ui-sm";
  const section = `flex flex-col gap-2.5 border-t pt-4 ${studio ? "border-th-line" : "border-line"}`;

  useEffect(() => {
    if (!adding || people) return;
    void supabase
      .from("profiles")
      .select("id, full_name, role")
      .is("deactivated_at", null)
      .order("full_name")
      .limit(500)
      .then(({ data }) => setPeople((data ?? []) as Member[]));
  }, [adding, people, supabase]);

  async function run(action: PromiseLike<{ error: { message: string } | null }>, failure = t("errors.generic")) {
    setError(null);
    const { error: actionError } = await action;
    if (actionError) {
      setError(/only admins|admins only/.test(actionError.message) ? t("errors.adminsOnly") : /not allowed to add/.test(actionError.message) ? t("errors.cannotAdd") : failure);
      return false;
    }
    onChanged();
    return true;
  }

  async function uploadPhoto(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) return setError(t("errors.photo"));
    const path = `${conversation.id}/group-${crypto.randomUUID()}-${storageSafeName(file.name)}`;
    const stored = await supabase.storage.from("messages").upload(path, file, { contentType: file.type });
    if (stored.error) return setError(t("errors.photo"));
    await run(supabase.rpc("update_group", { target: conversation.id, patch: { photo_path: path } }));
    if (photoInput.current) photoInput.current.value = "";
  }

  const pinned = messages.filter((m) => m.pinned_at && !m.deleted_at);
  const files = messages.filter((m) => !m.deleted_at && (m.attachment_path || m.library_file_id));
  const links = [...new Set(messages.filter((m) => !m.deleted_at).flatMap((m) => m.body.match(urlPattern) ?? []))].reverse();
  const memberIds = new Set(conversation.members.map((m) => m.id));

  return (
    <aside aria-label={t("groupInfo")} className={`absolute inset-0 z-30 flex flex-col overflow-y-auto md:static md:w-[340px] md:shrink-0 md:border-l ${studio ? "border-th-line bg-th-card" : "border-l-2 border-ink bg-white"}`}>
      <div className={`flex items-center justify-between gap-2 border-b px-5 py-4 ${studio ? "border-th-line" : "border-ink"}`}>
        <h2 className="font-display text-lg font-bold">{t("groupInfo")}</h2>
        <button type="button" onClick={onClose} aria-label={t("close")} className="ui-btn ui-gray ui-icon ui-sm ui-neutral text-lg font-normal">×</button>
      </div>
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-col items-center gap-3 text-center">
          <GroupAvatar id={conversation.id} title={conversation.title} photoUrl={conversation.photoUrl} size={96} ring={studio ? undefined : "#221f20"} />
          {conversation.canEdit && (
            <>
              <button type="button" onClick={() => photoInput.current?.click()} className="ui-btn ui-plain ui-sm">{t("changePhoto")}</button>
              <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void uploadPhoto(e.target.files?.[0])} />
            </>
          )}
          {editing ? (
            <form
              className="flex w-full flex-col gap-2 text-left"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await run(supabase.rpc("update_group", { target: conversation.id, patch: { title, description } }))) setEditing(false);
              }}
            >
              <label className="flex flex-col gap-1 text-sm">{t("groupName")}<input value={title} required maxLength={80} onChange={(e) => setTitle(e.target.value)} className={input} /></label>
              <label className="flex flex-col gap-1 text-sm">{t("groupDescription")}<textarea value={description} rows={3} maxLength={500} onChange={(e) => setDescription(e.target.value)} className={input} /></label>
              <div className="flex gap-2"><button type="submit" className="ui-btn ui-filled">{t("save")}</button><button type="button" onClick={() => setEditing(false)} className="ui-btn ui-gray ui-neutral">{t("cancel")}</button></div>
            </form>
          ) : (
            <>
              <h3 className="font-display text-xl font-bold break-words">{conversation.title}</h3>
              <p className={`text-sm ${muted}`}>{t("membersCount", { count: conversation.members.length })}</p>
              {conversation.description && <p className="text-sm whitespace-pre-wrap">{conversation.description}</p>}
              {conversation.canEdit && <button type="button" onClick={() => setEditing(true)} className="ui-btn ui-tinted ui-sm">{t("editGroup")}</button>}
            </>
          )}
        </div>

        {error && <p role="alert" className="bg-vermilion/20 px-3 py-2 text-sm">{error}</p>}

        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm">
          {t("mute")}
          <input type="checkbox" role="switch" key={`m${conversation.muted}`} defaultChecked={conversation.muted} className="ui-switch"
            onChange={(e) => void run(supabase.from("conversation_participants").update({ muted: e.target.checked }).eq("conversation_id", conversation.id).eq("profile_id", meId))} />
        </label>

        {admin && (
          <fieldset className={section}>
            <legend className="sr-only">{t("groupSettings")}</legend>
            <span className="font-display font-semibold">{t("groupSettings")}</span>
            <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm">
              {t("onlyAdminsSend")}
              <input type="checkbox" role="switch" key={`s${conversation.onlyAdminsSend}`} defaultChecked={conversation.onlyAdminsSend} className="ui-switch"
                onChange={(e) => void run(supabase.rpc("update_group", { target: conversation.id, patch: { only_admins_send: e.target.checked } }))} />
            </label>
            <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm">
              {t("onlyAdminsEdit")}
              <input type="checkbox" role="switch" key={`e${conversation.onlyAdminsEdit}`} defaultChecked={conversation.onlyAdminsEdit} className="ui-switch"
                onChange={(e) => void run(supabase.rpc("update_group", { target: conversation.id, patch: { only_admins_edit: e.target.checked } }))} />
            </label>
          </fieldset>
        )}

        {pinned.length > 0 && (
          <section className={section} aria-label={t("pinnedMessages")}>
            <span className="font-display font-semibold">📌 {t("pinnedMessages")}</span>
            <ul className="flex flex-col gap-1.5">
              {pinned.map((m) => (
                <li key={m.id}><button type="button" onClick={() => onJump(m.id)} className="line-clamp-2 text-left text-sm underline-offset-4 hover:underline">{m.body || t(`kinds.${m.kind}`)}</button></li>
              ))}
            </ul>
          </section>
        )}

        <section className={section} aria-label={t("members")}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-display font-semibold">{t("members")} · {conversation.members.length}</span>
            {admin && <button type="button" onClick={() => setAdding((on) => !on)} aria-expanded={adding} className="ui-btn ui-tinted ui-sm">+ {t("addMembers")}</button>}
          </div>
          {adding && (
            <div className="flex flex-col gap-2">
              {people === null ? (
                <p className="text-sm">{t("loading")}</p>
              ) : (
                <PeoplePicker
                  members={people.filter((p) => !memberIds.has(p.id))}
                  selected={picked}
                  onToggle={(id, on) => setPicked((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id)))}
                  label={t("addMembers")}
                  styles={pickerStyles(input, muted)}
                />
              )}
              <button type="button" disabled={!picked.length} className="ui-btn ui-filled"
                onClick={async () => {
                  if (await run(supabase.rpc("add_group_members", { target: conversation.id, members: picked }))) {
                    setPicked([]);
                    setAdding(false);
                  }
                }}>
                {t("add")}
              </button>
            </div>
          )}
          <ul className="flex flex-col">
            {conversation.members.map((member) => (
              <li key={member.id} className="flex items-center gap-3 py-2">
                <Avatar id={member.id} name={member.full_name} size={36} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{member.id === meId ? t("youFull", { name: member.full_name }) : member.full_name}</span>
                  <span className={`text-xs ${muted}`}>{member.schoolName ?? tr(member.role)}</span>
                </span>
                {member.groupRole === "admin" && <span className={`px-2 py-0.5 text-[11px] font-semibold ${studio ? "bg-teal/25" : "rounded-full border-[1.5px] border-ink bg-lime"}`}>{t("admin")}</span>}
                {admin && member.id !== meId && (
                  <details className="relative">
                    <summary aria-label={t("memberOptions", { name: member.full_name })} className="ui-btn ui-plain ui-icon ui-sm ui-neutral list-none text-lg [&::-webkit-details-marker]:hidden">⋯</summary>
                    <div className="ui-menu absolute right-0 z-10 mt-1 w-52 origin-top-right">
                      <button type="button" className="ui-menu-item"
                        onClick={() => void run(supabase.rpc("set_group_admin", { target: conversation.id, member: member.id, make_admin: member.groupRole !== "admin" }))}>
                        {member.groupRole === "admin" ? t("removeAdmin") : t("makeAdmin")}
                      </button>
                      <button type="button" className="ui-menu-item ui-danger"
                        onClick={() => void run(supabase.rpc("remove_group_member", { target: conversation.id, member: member.id }))}>
                        {t("removeMember")}
                      </button>
                    </div>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className={section} aria-label={t("filesAndLinks")}>
          <div role="tablist" className="ui-seg">
            {(["files", "links"] as const).map((name) => (
              <button key={name} type="button" role="tab" aria-selected={tab === name} onClick={() => setTab(name)}>
                {t(`tabs.${name}`)}
              </button>
            ))}
          </div>
          {tab === "files" ? (
            files.length === 0 ? <p className={`text-sm ${muted}`}>{t("noFiles")}</p> : (
              <ul className="flex flex-col gap-1.5">
                {files.map((m) => (
                  <li key={m.id}>
                    {m.attachment_path ? (
                      <button type="button" onClick={() => onOpenAttachment(m.attachment_path as string)} className="text-left text-sm underline-offset-4 hover:underline">{m.attachment_name}</button>
                    ) : (
                      <a href={`/app/library/file/${m.library_file_id}`} target="_blank" rel="noopener noreferrer" className="text-sm underline-offset-4 hover:underline">
                        {conversation.resources[m.library_file_id as string]?.name ?? t("resourceGone")}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )
          ) : links.length === 0 ? <p className={`text-sm ${muted}`}>{t("noLinks")}</p> : (
            <ul className="flex flex-col gap-1.5">
              {links.map((link) => <li key={link}><a href={link} target="_blank" rel="noopener noreferrer" className="text-sm break-all underline underline-offset-2">{link}</a></li>)}
            </ul>
          )}
        </section>

        <div className={section}>
          {leaving ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm">{t("leaveConfirm")}</p>
              <div className="flex gap-2">
                <button type="button" className="ui-btn ui-filled ui-danger" onClick={async () => { if (await run(supabase.rpc("leave_group", { target: conversation.id }))) router.push("/app/messages"); }}>{t("leaveYes")}</button>
                <button type="button" onClick={() => setLeaving(false)} className="ui-btn ui-gray ui-neutral">{t("cancel")}</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setLeaving(true)} className="ui-btn ui-tinted ui-danger self-start">{t("leaveGroup")}</button>
          )}
        </div>
      </div>
    </aside>
  );
}

/** Making a group: a name, then people from the school team and the re_form team. */
export function NewGroup({ variant, onClose, onCreated }: { variant: Theme; onClose: () => void; onCreated: (id: string) => void }) {
  const t = useTranslations("messages");
  const supabase = useMemo(() => createClient(), []);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [people, setPeople] = useState<Member[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const studio = variant !== "color";
  const input = "ui-field";
  const muted = studio ? "text-th-muted" : "text-muted";

  useEffect(() => {
    void (async () => {
      const { data: auth } = await supabase.auth.getClaims();
      const me = auth?.claims?.sub;
      const { data } = await supabase.from("profiles").select("id, full_name, role").is("deactivated_at", null).neq("id", me ?? "").order("full_name").limit(500);
      setPeople((data ?? []) as Member[]);
    })();
  }, [supabase]);

  return (
    <form
      aria-label={t("newGroup")}
      className={`flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto ${studio ? "px-[18px] pb-4" : "-mx-1 px-1 pb-1"}`}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim() || !picked.length) return;
        setBusy(true);
        setError(null);
        const { data, error: createError } = await supabase.rpc("create_group", { group_title: title.trim(), members: picked, group_description: description });
        setBusy(false);
        if (createError || !data) return setError(t("errors.cannotAdd"));
        onCreated(data as string);
      }}
    >
      <span className="font-display text-lg font-bold">{t("newGroup")}</span>
      <label className="flex flex-col gap-1 text-sm">{t("groupName")}<input autoFocus value={title} required maxLength={80} onChange={(e) => setTitle(e.target.value)} className={input} /></label>
      <label className="flex flex-col gap-1 text-sm">{t("groupDescriptionOptional")}<textarea value={description} rows={2} maxLength={500} onChange={(e) => setDescription(e.target.value)} className={input} /></label>
      {people === null ? (
        <p className={`text-sm ${muted}`}>{t("loading")}</p>
      ) : (
        <PeoplePicker
          members={people}
          selected={picked}
          onToggle={(id, on) => setPicked((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id)))}
          label={t("groupPeople")}
          styles={pickerStyles(input, muted)}
        />
      )}
      <p className={`text-xs ${muted}`}>{t("groupHint")}</p>
      {error && <p role="alert" className="text-sm text-vermilion">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !title.trim() || !picked.length} className="ui-btn ui-filled">
          {t("createGroup")}
        </button>
        <button type="button" onClick={onClose} className="ui-btn ui-gray ui-neutral">{t("cancel")}</button>
      </div>
    </form>
  );
}
