"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/avatar";
import { ClipIcon, FileIcon, SearchIcon, SendIcon } from "@/components/icons";
import { Logo } from "@/components/logo";
import { relativeStamp } from "@/lib/format";
import type { GifResult } from "@/lib/giphy";
import { storageSafeName } from "@/lib/library";
import {
  maxMessageAttachment,
  messageAttachmentTypes,
  messageColumns,
  type ChatMessage,
  type ConversationSummary,
  type Person,
  type Poll,
  type Reaction,
  type SelectedConversation,
} from "@/lib/messages";
import { createClient } from "@/lib/supabase/client";
import type { Theme } from "@/lib/theme-shared";
import { GroupAvatar, GroupInfo, NewGroup } from "./group-info";
import { MessageItem, type MessageHandlers } from "./message-item";
import { PollComposer } from "./poll";
import { ResourcePicker } from "./resource-picker";
import { StickerPicker } from "./stickers";

type Props = {
  variant: Theme;
  me: { id: string; full_name: string };
  inbox: ConversationSummary[];
  selected: SelectedConversation | null;
  locale: string;
};

function dayKey(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest" }).format(new Date(iso));
}

/** Messages (PRD module 5): chats and groups, live thread, replies, reactions, polls, stickers, GIFs, files. */
export function Messenger({ variant, me, inbox, selected, locale }: Props) {
  const t = useTranslations("messages");
  const tr = useTranslations("roles");
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<ChatMessage[]>(selected?.messages ?? []);
  const [reactions, setReactions] = useState<Reaction[]>(selected?.reactions ?? []);
  const [polls, setPolls] = useState<Poll[]>(selected?.polls ?? []);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [composing, setComposing] = useState<null | "chat" | "group">(null);
  const [menu, setMenu] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const [typing, setTyping] = useState<boolean | string>(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [panel, setPanel] = useState<null | "attach" | "stickers" | "resources" | "poll">(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const typingChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSent = useRef(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const conversationId = selected?.id ?? null;
  const group = selected?.kind === "group";

  const scheduleRefresh = useCallback(() => {
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => router.refresh(), 400);
  }, [router]);

  // Server refreshes bring a fresh copy of the thread: merge it in (by id) while rendering.
  const [seenSelected, setSeenSelected] = useState(selected);
  if (selected !== seenSelected) {
    setSeenSelected(selected);
    if (selected) {
      const byId = new Map(messages.map((m) => [m.id, m]));
      for (const m of selected.messages) byId.set(m.id, m);
      setMessages([...byId.values()].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)));
      setReactions(selected.reactions);
      setPolls(selected.polls);
    }
  }

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length, conversationId]);

  // Opening a conversation marks it read (also updates the badge in the menu).
  useEffect(() => {
    if (!conversationId) return;
    void supabase.rpc("mark_conversation_read", { target: conversationId }).then(() => scheduleRefresh());
  }, [conversationId, supabase, scheduleRefresh]);

  // Live: new and changed messages, reactions, votes and group changes (RLS only sends mine).
  useEffect(() => {
    const channel = supabase
      .channel(`inbox:${me.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const message = payload.new as ChatMessage & { conversation_id: string };
        if (message.conversation_id === conversationId) {
          setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
          setTyping(false);
          if (message.sender_id !== me.id && document.visibilityState === "visible") {
            void supabase.rpc("mark_conversation_read", { target: message.conversation_id });
          }
        }
        scheduleRefresh();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        const message = payload.new as ChatMessage & { conversation_id: string };
        if (message.conversation_id === conversationId) setMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "poll_votes" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "polls" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_participants" }, scheduleRefresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations" }, scheduleRefresh)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, me.id, conversationId, scheduleRefresh]);

  // "… is typing" over a broadcast channel per conversation.
  useEffect(() => {
    if (!conversationId) return;
    let hide: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel(`typing:${conversationId}`)
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload?.id === me.id) return;
        setTyping(payload?.name ?? true);
        clearTimeout(hide);
        hide = setTimeout(() => setTyping(false), 3500);
      })
      .subscribe();
    typingChannel.current = channel;
    return () => {
      clearTimeout(hide);
      typingChannel.current = null;
      void supabase.removeChannel(channel);
    };
  }, [supabase, conversationId, me.id]);

  function announceTyping() {
    const now = Date.now();
    if (now - lastTypingSent.current < 2000) return;
    lastTypingSent.current = now;
    void typingChannel.current?.send({ type: "broadcast", event: "typing", payload: { id: me.id, name: me.full_name.split(" ")[0] } });
  }

  const names = useMemo(() => {
    const map = new Map<string, string>(Object.entries(selected?.people ?? {}));
    for (const m of selected?.members ?? []) map.set(m.id, m.full_name);
    if (selected?.other.id) map.set(selected.other.id, selected.other.full_name);
    map.set(me.id, me.full_name);
    return map;
  }, [selected, me]);

  /** Adds what was just sent (the live update may arrive first; ids keep it single). */
  function added(data: ChatMessage | null) {
    if (data) setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
    setReplyTo(null);
    scheduleRefresh();
  }

  async function insertMessage(row: Record<string, unknown>) {
    if (!conversationId) return false;
    setSending(true);
    setError(null);
    const { data, error: sendError } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, reply_to: replyTo?.id ?? null, ...row })
      .select(messageColumns)
      .single();
    setSending(false);
    if (sendError) {
      setError(selected?.blockedByMe ? t("errors.blocked") : t("errors.sendFailed"));
      return false;
    }
    added(data as unknown as ChatMessage);
    return true;
  }

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    if (await insertMessage({ body })) setDraft("");
  }

  async function attach(file: File) {
    if (!conversationId) return;
    if (file.size > maxMessageAttachment) return setError(t("errors.tooLarge"));
    if (!messageAttachmentTypes.includes(file.type)) return setError(t("errors.badType"));
    setSending(true);
    const path = `${conversationId}/${crypto.randomUUID()}-${storageSafeName(file.name)}`;
    const stored = await supabase.storage.from("messages").upload(path, file, { contentType: file.type });
    setSending(false);
    if (fileInput.current) fileInput.current.value = "";
    if (stored.error) return setError(t("errors.sendFailed"));
    if (await insertMessage({ body: draft.trim(), attachment_path: path, attachment_name: file.name })) setDraft("");
  }

  async function sendResource(file: { id: string; name: string }, note: string) {
    if (!conversationId) return false;
    setError(null);
    const { data, error: sendError } = await supabase.rpc("send_resource", { target: conversationId, file: file.id, note, answer: replyTo?.id ?? (null as unknown as string) });
    if (sendError) {
      setError(/cannot open files of that school/.test(sendError.message) ? t("errors.resourceAccess") : t("errors.sendFailed"));
      return false;
    }
    if (data) {
      const { data: row } = await supabase.from("messages").select(messageColumns).eq("id", data).single();
      added(row as unknown as ChatMessage);
    }
    return true;
  }

  async function sendSticker(id: string) {
    setPanel(null);
    await insertMessage({ kind: "sticker", sticker: id, body: "" });
  }

  async function sendGif(gif: GifResult) {
    setPanel(null);
    await insertMessage({ kind: "gif", gif: { id: gif.id, url: gif.url, width: gif.width, height: gif.height, title: gif.title }, body: "" });
  }

  async function createPoll(question: string, options: string[], multiple: boolean) {
    if (!conversationId) return false;
    const { error: pollError } = await supabase.rpc("create_poll", { target: conversationId, poll_question: question, poll_options: options, allow_multiple: multiple });
    if (pollError) {
      setError(t("errors.sendFailed"));
      return false;
    }
    router.refresh();
    return true;
  }

  async function openAttachment(path: string) {
    const { data } = await supabase.storage.from("messages").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }

  const handlers: MessageHandlers = {
    onReply: (message) => {
      setReplyTo(message);
      textarea.current?.focus();
    },
    onReact: async (message, emoji, on) => {
      setReactions((prev) => (on ? [...prev, { message_id: message.id, profile_id: me.id, emoji }] : prev.filter((r) => !(r.message_id === message.id && r.profile_id === me.id && r.emoji === emoji))));
      const result = on
        ? await supabase.from("message_reactions").insert({ message_id: message.id, emoji })
        : await supabase.from("message_reactions").delete().eq("message_id", message.id).eq("profile_id", me.id).eq("emoji", emoji);
      if (result.error && result.error.code !== "23505") setError(t("errors.generic"));
      scheduleRefresh();
    },
    onPin: async (message, pin) => {
      const { error: pinError } = await supabase.rpc("pin_message", { target: message.id, pin });
      if (pinError) return setError(t("errors.adminsOnly"));
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, pinned_at: pin ? new Date().toISOString() : null } : m)));
      scheduleRefresh();
    },
    onDelete: async (message) => {
      const { error: removeError } = await supabase.from("messages").update({ body: "", deleted_at: new Date().toISOString() }).eq("id", message.id);
      if (removeError) return setError(t("errors.deleteFailed"));
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, body: "", deleted_at: new Date().toISOString() } : m)));
    },
    onOpenAttachment: (path) => void openAttachment(path),
    onVote: async (poll, optionIds) => {
      setPolls((prev) => prev.map((p) => (p.id === poll.id ? { ...p, votes: [...p.votes.filter((v) => v.profile_id !== me.id), ...optionIds.map((option_id) => ({ option_id, profile_id: me.id }))] } : p)));
      const { error: voteError } = await supabase.rpc("vote_poll", { target_poll: poll.id, choices: optionIds });
      if (voteError) setError(t("errors.generic"));
      scheduleRefresh();
    },
    onClosePoll: async (poll) => {
      const { error: closeError } = await supabase.rpc("close_poll", { target_poll: poll.id });
      if (closeError) setError(t("errors.generic"));
      scheduleRefresh();
    },
    onJump: (id) => {
      const target = document.getElementById(`msg-${id}`);
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
      target?.animate([{ outline: "3px solid #77bfb2" }, { outline: "3px solid transparent" }], { duration: 1600 });
    },
  };

  async function toggleBlock() {
    if (!selected || group) return;
    setMenu(false);
    const result = selected.blockedByMe
      ? await supabase.from("user_blocks").delete().eq("blocker_id", me.id).eq("blocked_id", selected.other.id)
      : await supabase.from("user_blocks").insert({ blocker_id: me.id, blocked_id: selected.other.id });
    if (result.error) return setError(t("errors.generic"));
    router.refresh();
  }

  async function report(reason: string) {
    if (!conversationId) return;
    const { error: reportError } = await supabase.from("message_reports").insert({ conversation_id: conversationId, reason: reason.slice(0, 2000) });
    if (reportError) return setError(t("errors.generic"));
    setReporting(false);
    setMenu(false);
    setReported(true);
  }

  const subLabel = (person: Person) =>
    person.role === "staff" || person.role === "admin" ? t("teamLabel") : [person.schoolName, tr(person.role)].filter(Boolean).join(" · ");

  const shownInbox = filter.trim()
    ? inbox.filter((c) => `${c.title} ${c.other.schoolName ?? ""}`.toLocaleLowerCase("ro").includes(filter.trim().toLocaleLowerCase("ro")))
    : inbox;

  // Studio (dark and white) and colour; the colours of the studio come from the theme tokens.
  const studio = variant !== "color";
  const muted = studio ? "text-th-muted" : "text-muted";
  const popover = studio ? "border border-th-edge bg-th-card text-th-fg shadow-lg" : "rounded-[22px] border-2 border-ink bg-white text-ink";
  const fieldClass = studio ? "min-h-10 w-full rounded-th border border-th-edge bg-th-bg px-3 text-sm text-th-fg" : "min-h-10 w-full rounded-xl border-2 border-ink bg-white px-3 text-sm";
  const tabClass = (active: boolean) =>
    studio ? `min-h-9 px-3 text-sm ${active ? "bg-th-fg text-th-bg" : "border border-th-edge"}` : `min-h-9 rounded-full border-2 border-ink px-3 text-sm ${active ? "bg-ink text-white" : ""}`;
  const primaryClass = studio ? "min-h-11 rounded-th bg-teal px-4 font-display text-sm font-semibold text-ink disabled:opacity-60" : "min-h-11 rounded-full border-2 border-ink bg-honey px-4 font-display text-sm font-bold disabled:opacity-60";

  const previewOf = (c: ConversationSummary) => {
    if (c.lastText === null && !c.lastKind) return c.hasMessages ? t("deleted") : t("noMessagesYet");
    const who = c.lastMine ? `${t("you")}: ` : c.lastSender ? `${c.lastSender}: ` : "";
    if (c.lastKind && c.lastKind !== "text" && c.lastKind !== "system") return `${who}${t(`kinds.${c.lastKind}`)}`;
    if (c.lastKind === "system") return t("groupUpdate");
    return c.lastText === null ? t("deleted") : `${who}${c.lastText}`;
  };

  // ---- shared pieces -------------------------------------------------------

  const searchBox = (
    <label className={`flex h-11 items-center gap-2 px-3 ${studio ? "border border-th-fieldline bg-th-card" : "rounded-full border-2 border-ink px-3.5"}`}>
      <SearchIcon size={16} strokeWidth={studio ? 2 : 2.5} className={studio ? "text-th-muted" : ""} />
      <span className="sr-only">{t("searchConversations")}</span>
      <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)}
        placeholder={studio ? t("searchPlaceholder") : t("searchFun")}
        className={`w-full min-w-0 border-0 bg-transparent text-sm ${studio ? "text-th-fg placeholder:text-th-muted" : ""}`} />
    </label>
  );

  const newButton = (
    <button type="button" onClick={() => setComposing((on) => (on ? null : "chat"))} aria-expanded={Boolean(composing)}
      aria-label={t("newConversation")}
      className={
        studio
          ? "grid size-11 place-items-center rounded-th bg-teal text-[22px] text-ink"
          : "grid size-11 place-items-center rounded-full border-2 border-ink bg-vermilion text-[22px] font-semibold"
      }>
      +
    </button>
  );

  const avatarOf = (c: { id: string; kind: "direct" | "group"; title: string; photoUrl: string | null; other: Person }, size: number, ring?: string) =>
    c.kind === "group" ? <GroupAvatar id={c.id} title={c.title} photoUrl={c.photoUrl} size={size} ring={ring} /> : <Avatar id={c.other.id} name={c.other.full_name} size={size} ring={ring} />;

  const conversationList = (
    <ul className={`flex min-h-0 flex-1 flex-col overflow-auto ${variant === "color" ? "gap-2" : ""}`}>
      {shownInbox.length === 0 && <li className={`p-4 text-sm ${muted}`}>{inbox.length ? t("noMatches") : t("empty")}</li>}
      {shownInbox.map((c) => {
        const active = c.id === conversationId;
        const stamp = relativeStamp(c.lastAt, locale);
        const preview = previewOf(c);
        const sub = c.kind === "group" ? t("membersCount", { count: c.memberCount }) : subLabel(c.other);
        const badge = c.unread > 0 && !active;
        if (studio) {
          return (
            <li key={c.id}>
              <Link href={`/app/messages?c=${c.id}`} aria-current={active ? "true" : undefined}
                className={`flex gap-3 border-b border-th-rule px-[18px] py-3.5 ${active ? "bg-th-raised" : "hover:bg-th-sunk"}`}>
                {avatarOf(c, 40)}
                <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <span className="flex justify-between gap-2"><span className="truncate text-[15px] font-medium">{c.title}</span><span className="shrink-0 text-xs text-th-muted">{stamp}</span></span>
                  <span className="text-xs text-th-muted">{sub}</span>
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] text-th-body">{preview}</span>
                    {c.muted && <span aria-label={t("muted")} title={t("muted")} className="text-xs">🔕</span>}
                    {badge && <span className={`shrink-0 px-[7px] py-px text-xs ${c.muted ? "bg-th-sunk text-th-muted" : "bg-teal text-ink"}`}>{c.unread}</span>}
                  </span>
                </span>
              </Link>
            </li>
          );
        }
        return (
          <li key={c.id}>
            <Link href={`/app/messages?c=${c.id}`} aria-current={active ? "true" : undefined}
              className={`flex gap-3 rounded-[20px] border-2 py-2.5 pr-3 pl-2.5 ${active ? "border-ink bg-vermilion-wash" : "border-transparent hover:border-line"}`}>
              {avatarOf(c, 44, "#221f20")}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex justify-between gap-2"><span className="truncate text-[15px] font-semibold">{c.title}</span><span className="shrink-0 text-xs text-muted">{stamp}</span></span>
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] text-[#4a4648]">{preview}</span>
                  {c.muted && <span aria-label={t("muted")} title={t("muted")} className="text-xs">🔕</span>}
                  {badge && <span className={`shrink-0 rounded-full border-[1.5px] border-ink px-2 font-fun text-[13px] font-bold ${c.muted ? "bg-white" : "bg-vermilion"}`}>{c.unread}</span>}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );

  const listColumn = (header: ReactNode) => (
    <section aria-label={t("conversations")} className={`${conversationId ? "hidden md:flex" : "flex"} min-h-0 shrink-0 flex-col ${
      studio ? "border-th-line md:w-[320px] md:border-r" : "gap-3.5 px-4 pt-6 pb-4 md:w-[320px] md:pl-5"
    }`}>
      {header}
      {composing === "group" ? (
        <NewGroup variant={variant} onClose={() => setComposing(null)} onCreated={(id) => { setComposing(null); router.push(`/app/messages?c=${id}`); }} />
      ) : composing === "chat" ? (
        <NewConversation variant={variant} onClose={() => setComposing(null)} onGroup={() => setComposing("group")} subLabel={subLabel} />
      ) : conversationList}
    </section>
  );

  // ---- thread -------------------------------------------------------------

  const byId = new Map(messages.map((m) => [m.id, m]));
  const bubbles = () => {
    const out: ReactNode[] = [];
    let lastDay = "";
    let lastSender = "";
    for (const m of messages) {
      const day = dayKey(m.created_at);
      if (day !== lastDay) {
        lastDay = day;
        lastSender = "";
        const label = relativeStamp(m.created_at, locale).includes(":") ? t("today") : new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ro-RO", { timeZone: "Europe/Bucharest", weekday: "long", day: "numeric", month: "long" }).format(new Date(m.created_at));
        out.push(
          !studio ? (
            <span key={`d-${day}`} className="self-center rounded-full border-[1.5px] border-ink px-3 py-0.5 text-xs font-medium">{label}</span>
          ) : (
            <div key={`d-${day}`} className="self-center pt-1 pb-2.5 text-xs text-th-muted">{label}</div>
          ),
        );
      }
      out.push(
        <MessageItem
          key={m.id}
          message={m}
          meId={me.id}
          names={names}
          variant={variant}
          locale={locale}
          group={group}
          showSender={m.sender_id !== lastSender}
          reactions={reactions.filter((r) => r.message_id === m.id)}
          poll={m.kind === "poll" ? polls.find((p) => p.message_id === m.id) : undefined}
          resource={m.library_file_id ? selected?.resources[m.library_file_id] : undefined}
          repliedTo={m.reply_to ? byId.get(m.reply_to) : undefined}
          canPin={!group || Boolean(selected?.canEdit)}
          canAct={Boolean(selected?.canPost) || group}
          handlers={handlers}
        />,
      );
      lastSender = m.kind === "system" ? "" : m.sender_id;
    }
    return out;
  };

  const pinned = messages.filter((m) => m.pinned_at && !m.deleted_at).sort((a, b) => Date.parse(b.pinned_at as string) - Date.parse(a.pinned_at as string));
  const pinnedBar = pinned.length > 0 && (
    <button type="button" onClick={() => handlers.onJump(pinned[0].id)}
      className={`flex items-center gap-2 px-4 py-2 text-left text-sm sm:px-7 ${studio ? "border-b border-th-line bg-th-sunk" : "border-b-2 border-ink bg-honey-wash"}`}>
      <span aria-hidden="true">📌</span>
      <span className="min-w-0 flex-1 truncate"><span className="font-semibold">{t("pinned")}:</span> {pinned[0].body || t(`kinds.${pinned[0].kind}`)}</span>
      {pinned.length > 1 && <span className={`text-xs ${muted}`}>+{pinned.length - 1}</span>}
    </button>
  );

  const blockedNote = selected?.blockedByMe && (
    <p className={`px-4 py-2 text-sm ${studio ? "bg-th-raised" : "bg-honey-wash"}`}>{t("youBlocked")}</p>
  );

  const closePanel = useCallback(() => setPanel(null), []);
  const canWrite = Boolean(selected?.canPost) && !selected?.blockedByMe;
  const iconButton = studio
    ? "grid size-12 shrink-0 place-items-center rounded-th border border-th-edge disabled:opacity-50"
    : "grid size-12 shrink-0 place-items-center rounded-full border-2 border-ink bg-honey disabled:opacity-50";

  const composer = selected && (
    canWrite ? (
      <div className={studio ? "border-t border-th-line" : "border-t-2 border-ink"}>
        {replyTo && (
          <div className={`flex items-center gap-3 px-4 pt-3 sm:px-7`}>
            <div className={`min-w-0 flex-1 border-l-4 px-3 py-1.5 text-xs ${studio ? "border-teal bg-th-sunk" : "rounded-xl border-ink bg-sand"}`}>
              <span className="block font-semibold">{t("replyingTo", { name: replyTo.sender_id === me.id ? t("you") : names.get(replyTo.sender_id) ?? t("someone") })}</span>
              <span className="line-clamp-1 opacity-80">{replyTo.body || t(`kinds.${replyTo.kind}`)}</span>
            </div>
            <button type="button" onClick={() => setReplyTo(null)} aria-label={t("cancelReply")} className="grid size-9 place-items-center text-lg">×</button>
          </div>
        )}
        <div className="relative">
          {panel === "attach" && (
            <div role="menu" aria-label={t("attach")} className={`absolute bottom-full left-4 z-30 mb-2 flex w-60 flex-col py-1.5 ${popover}`}>
              <button type="button" role="menuitem" onClick={() => { setPanel(null); fileInput.current?.click(); }} className="px-4 py-3 text-left text-sm hover:underline">{t("fromDevice")}</button>
              <button type="button" role="menuitem" onClick={() => setPanel("resources")} className="px-4 py-3 text-left text-sm hover:underline">{t("fromResources")}</button>
              <button type="button" role="menuitem" onClick={() => setPanel("poll")} className="px-4 py-3 text-left text-sm hover:underline">{t("newPoll")}</button>
            </div>
          )}
          {panel === "resources" && (
            <ResourcePicker meId={me.id} onPick={sendResource} onClose={closePanel} panelClass={popover} inputClass={fieldClass} tabClass={tabClass} />
          )}
          {panel === "poll" && (
            <div className="absolute bottom-full left-4 z-30 mb-2 w-[min(400px,calc(100vw-2rem))]">
              <PollComposer onCreate={createPoll} onCancel={closePanel} panelClass={popover} inputClass={fieldClass} buttonClass={primaryClass} />
            </div>
          )}
          {panel === "stickers" && (
            <StickerPicker onSticker={(id) => void sendSticker(id)} onGif={(gif) => void sendGif(gif)} onClose={closePanel} panelClass={popover} tabClass={tabClass} />
          )}
        <form onSubmit={send} className={studio ? "relative flex items-end gap-2.5 px-4 pt-4 pb-[22px] sm:px-7" : "relative flex items-center gap-2.5 px-[18px] py-3.5"}>
          <button type="button" onClick={() => setPanel((p) => (p === "attach" ? null : "attach"))} disabled={sending} aria-label={t("attach")} aria-expanded={panel === "attach"} className={iconButton}>
            <ClipIcon size={20} strokeWidth={variant === "color" ? 2.5 : 2} />
          </button>
          <button type="button" onClick={() => setPanel((p) => (p === "stickers" ? null : "stickers"))} disabled={sending} aria-label={t("stickersAndGifs")} aria-expanded={panel === "stickers"} className={`${iconButton} text-xl`}>
            ☺
          </button>
          <input ref={fileInput} type="file" accept={messageAttachmentTypes.join(",")} className="sr-only" tabIndex={-1} aria-hidden="true"
            onChange={(e) => e.target.files?.[0] && void attach(e.target.files[0])} />
          <label className="flex flex-1">
            <span className="sr-only">{t("messageTo", { name: selected.title })}</span>
            <textarea
              ref={textarea}
              rows={1}
              value={draft}
              maxLength={4000}
              onChange={(e) => {
                setDraft(e.target.value);
                announceTyping();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
                if (e.key === "Escape" && replyTo) setReplyTo(null);
              }}
              placeholder={variant === "color" ? t("writeTo", { name: selected.title.split(" ")[0] }) : t("write")}
              className={
                studio ? "min-h-12 w-full resize-none rounded-th border border-th-edge bg-th-card px-3.5 py-3 text-[15px] text-th-fg"
                  : "h-12 w-full resize-none rounded-full border-2 border-ink px-[18px] py-3 text-[15px]"
              }
            />
          </label>
          <button type="submit" disabled={sending || !draft.trim()} aria-label={variant === "color" ? t("send") : undefined}
            className={
              studio ? "h-12 shrink-0 rounded-th bg-teal px-5 font-display text-[15px] font-semibold text-ink disabled:opacity-60"
                : "grid size-12 shrink-0 place-items-center rounded-full border-2 border-ink bg-vermilion disabled:opacity-60"
            }>
            {variant === "color" ? <SendIcon size={20} strokeWidth={2.5} /> : t("send")}
          </button>
        </form>
        </div>
      </div>
    ) : (
      <p className={`px-4 py-4 text-center text-sm sm:px-7 ${studio ? "border-t border-th-line text-th-muted" : "border-t-2 border-ink"}`}>
        {selected.blockedByMe ? t("youBlocked") : group ? t("onlyAdminsCanWrite") : t("cannotWrite")}
      </p>
    )
  );

  const typingNote = typing && selected && (
    <div aria-live="polite" className={`flex items-center gap-2.5 text-[13px] ${muted}`}>
      <span aria-hidden="true" className={`flex gap-[5px] px-3.5 py-3 ${studio ? "bg-th-raised" : "rounded-[20px_20px_20px_6px] border-2 border-ink"}`}>
        {[0, 1, 2].map((i) => <span key={i} className={`size-2 rounded-full ${studio ? "bg-teal" : "bg-vermilion"}`} />)}
      </span>
      {t("typing", { name: typeof typing === "string" ? typing : selected.title.split(" ")[0] })}
    </div>
  );

  const safetyMenu = selected && (
    <div role="menu" aria-label={t("options")} className={`absolute top-full right-4 z-20 mt-2 flex w-[260px] flex-col py-1.5 sm:right-7 ${studio ? "border border-th-edge bg-th-card" : "rounded-[18px] border-2 border-ink bg-white"}`}>
      {group ? (
        <button type="button" role="menuitem" onClick={() => { setMenu(false); setInfoOpen(true); }} className="px-4 py-3 text-left text-sm hover:underline">{t("groupInfo")}</button>
      ) : (
        <button type="button" role="menuitem" onClick={() => void toggleBlock()} className="px-4 py-3 text-left text-sm hover:underline">
          {selected.blockedByMe ? t("unblock") : t("block")}
        </button>
      )}
      {reporting ? (
        <ReportForm variant={variant} onCancel={() => setReporting(false)} onSubmit={report} />
      ) : (
        <button type="button" role="menuitem" onClick={() => setReporting(true)} className={`border-t px-4 py-3 text-left text-sm hover:underline ${studio ? "border-th-line text-th-notice" : "border-line font-medium"}`}>
          {t("report")}
        </button>
      )}
    </div>
  );

  const thread = (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-auto px-4 py-6 sm:px-7">
      {selected && messages.length === 0 && <p className={`self-center text-sm ${muted}`}>{t("startHint", { name: selected.title })}</p>}
      {bubbles()}
      {typingNote}
      <div ref={bottom} />
    </div>
  );

  const alerts = (
    <>
      {blockedNote}
      {reported && <p role="status" className="bg-teal/30 px-4 py-2 text-sm">{t("reported")}</p>}
      {error && <p role="alert" className="bg-vermilion/25 px-4 py-2 text-sm">{error} <button type="button" onClick={() => setError(null)} className="underline">{t("dismiss")}</button></p>}
    </>
  );

  const backLink = (
    <Link href="/app/messages" className="grid size-11 shrink-0 place-items-center text-xl md:hidden" aria-label={t("back")}>←</Link>
  );

  const emptyThread = (
    <div className={`hidden flex-1 place-items-center p-8 text-center md:grid ${muted}`}>
      <p>{inbox.length ? t("pick") : t("emptyLong")}</p>
    </div>
  );

  const headerTitle = selected && (
    group ? (
      <button type="button" onClick={() => setInfoOpen((on) => !on)} aria-expanded={infoOpen} className="flex min-w-0 flex-1 items-center gap-3.5 text-left">
        <GroupAvatar id={selected.id} title={selected.title} photoUrl={selected.photoUrl} size={studio ? 44 : 46} ring={studio ? undefined : "#221f20"} />
        <span className="min-w-0 flex-1">
          <span className={`block truncate font-display ${studio ? "text-[19px] font-semibold" : "text-xl font-extrabold"}`}>{selected.title}</span>
          <span className={`block truncate text-[13px] ${studio ? "text-th-muted" : ""}`}>{selected.members.map((m) => (m.id === me.id ? t("you") : m.full_name.split(" ")[0])).join(", ")}</span>
        </span>
      </button>
    ) : (
      <>
        <Avatar id={selected.other.id} name={selected.other.full_name} size={studio ? 44 : 46} ring={studio ? undefined : "#221f20"} />
        <div className="min-w-0 flex-1"><h2 className={`font-display ${studio ? "text-[19px] font-semibold" : "text-xl font-extrabold"}`}>{selected.other.full_name}</h2><div className={`text-[13px] ${studio ? "text-th-muted" : ""}`}>{subLabel(selected.other)}</div></div>
      </>
    )
  );

  const info = selected && group && infoOpen && (
    <GroupInfo conversation={selected} meId={me.id} variant={variant} messages={messages} onClose={() => setInfoOpen(false)}
      onChanged={() => router.refresh()} onJump={(id) => { setInfoOpen(false); setTimeout(() => handlers.onJump(id), 50); }} onOpenAttachment={(path) => void openAttachment(path)} />
  );

  // ---- layouts ------------------------------------------------------------

  if (studio) {
    return (
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {listColumn(
          <div className="flex flex-col gap-4 px-[18px] pt-[26px] pb-4">
            <div className="flex items-center justify-between"><h1 className="font-display text-[36px] font-bold text-th-heading">{t("title")}</h1>{newButton}</div>
            {!composing && searchBox}
          </div>,
        )}
        {selected ? (
          <div className="relative flex min-h-0 min-w-0 flex-1">
            <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="relative flex items-center gap-3.5 border-b border-th-line px-4 py-[18px] sm:px-7">
                {backLink}
                {headerTitle}
                {!group && (
                  <button type="button" onClick={() => setFilesOpen((on) => !on)} aria-expanded={filesOpen} aria-label={t("filesInConversation")} className={`grid size-11 place-items-center border ${filesOpen ? "border-teal bg-th-raised" : "border-th-edge"}`}><FileIcon size={18} /></button>
                )}
                <button type="button" onClick={() => setMenu((on) => !on)} aria-expanded={menu} aria-label={t("options")} className={`size-11 border text-xl ${menu ? "border-teal bg-th-raised" : "border-th-edge"}`}>⋯</button>
                {menu && safetyMenu}
              </div>
              {filesOpen && !group && (
                <div className="border-b border-th-line bg-th-sunk px-4 py-3 text-sm sm:px-7">
                  {selected.files.length === 0 ? <span className="text-th-muted">{t("noFiles")}</span> : (
                    <ul className="flex flex-wrap gap-2">
                      {selected.files.map((f) => <li key={f.id}><button type="button" onClick={() => void openAttachment(f.path)} className="border border-th-edge px-3 py-1.5 hover:border-th-fg">{f.name}</button></li>)}
                    </ul>
                  )}
                </div>
              )}
              {pinnedBar}
              {alerts}
              {thread}
              {composer}
            </main>
            {info}
          </div>
        ) : emptyThread}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      {listColumn(
        <>
          <Logo name="community" height={30} />
          <div className="flex items-center justify-between"><h1 className="font-display text-[32px] font-extrabold">{t("title")}</h1>{newButton}</div>
          {!composing && searchBox}
        </>,
      )}
      {selected ? (
        <div className="relative m-3 flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-[28px] border-2 border-ink md:my-4 md:mr-4 md:ml-0">
          <main className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="relative flex items-center gap-3.5 border-b-2 border-ink bg-vermilion px-4 py-3.5 sm:px-5">
              {backLink}
              {headerTitle}
              <button type="button" onClick={() => setMenu((on) => !on)} aria-expanded={menu} aria-label={t("optionsLong")} className="size-11 rounded-full border-2 border-ink bg-white text-xl">⋯</button>
              {menu && safetyMenu}
            </div>
            {pinnedBar}
            {alerts}
            {thread}
            {composer}
          </main>
          {info}
        </div>
      ) : emptyThread}
    </div>
  );
}

function ReportForm({ variant, onCancel, onSubmit }: { variant: Theme; onCancel: () => void; onSubmit: (reason: string) => Promise<void> }) {
  const t = useTranslations("messages");
  const [reason, setReason] = useState("");
  return (
    <form
      className="flex flex-col gap-2 px-4 py-3"
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit(reason);
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm">
        {t("reportReason")}
        <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={2000}
          className={`p-2 text-sm ${variant === "color" ? "rounded-xl border-2 border-ink" : "border border-th-edge bg-th-bg text-th-fg"}`} />
      </label>
      <div className="flex gap-2">
        <button type="submit" className={`min-h-11 px-3 text-sm font-medium ${variant === "color" ? "rounded-full border-2 border-ink bg-honey" : "bg-honey text-ink"}`}>{t("sendReport")}</button>
        <button type="button" onClick={onCancel} className="min-h-11 px-3 text-sm underline">{t("cancel")}</button>
      </div>
      <p className={`text-xs ${variant === "color" ? "text-muted" : "text-th-muted"}`}>{t("safetyNote")}</p>
    </form>
  );
}

type Candidate = { id: string; full_name: string; role: Person["role"]; schools: { name: string } | null };

function NewConversation({ variant, onClose, onGroup, subLabel }: { variant: Theme; onClose: () => void; onGroup: () => void; subLabel: (p: Person) => string }) {
  const t = useTranslations("messages");
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Candidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const { data: auth } = await supabase.auth.getClaims();
      const me = auth?.claims?.sub;
      let request = supabase.from("profiles").select("id, full_name, role, schools(name)").is("deactivated_at", null).order("full_name").limit(30);
      if (me) request = request.neq("id", me);
      const cleaned = query.trim().replace(/[%_,()]/g, " ").trim();
      if (cleaned) request = request.ilike("full_name", `%${cleaned}%`);
      const { data } = await request;
      setPeople((data ?? []) as Candidate[]);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, supabase]);

  async function start(person: Candidate) {
    setError(null);
    const { data, error: startError } = await supabase.rpc("start_conversation", { target: person.id });
    if (startError || !data) return setError(t("errors.cannotMessage"));
    onClose();
    router.push(`/app/messages?c=${data}`);
  }

  const studio = variant !== "color";
  const muted = studio ? "text-th-muted" : "text-muted";
  return (
    <div className={`flex min-h-0 flex-1 flex-col gap-3 ${studio ? "px-[18px] pb-4" : ""}`}>
      <button type="button" onClick={onGroup}
        className={`flex min-h-12 items-center gap-3 px-3 text-left text-sm font-semibold ${studio ? "border border-th-edge hover:border-th-fg" : "rounded-full border-2 border-ink bg-lime"}`}>
        <span aria-hidden="true" className="text-lg">👥</span> {t("newGroup")}
      </button>
      <label className={`flex h-11 items-center gap-2 px-3 ${studio ? "border border-th-fieldline bg-th-card" : "rounded-full border-2 border-ink"}`}>
        <SearchIcon size={16} />
        <span className="sr-only">{t("findPerson")}</span>
        <input autoFocus type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("findPerson")}
          className={`w-full border-0 bg-transparent text-sm ${studio ? "text-th-fg placeholder:text-th-muted" : ""}`} />
      </label>
      {error && <p role="alert" className="text-sm text-vermilion">{error}</p>}
      <ul className="flex min-h-0 flex-1 flex-col overflow-auto">
        {people === null && <li className={`p-2 text-sm ${muted}`}>{t("loading")}</li>}
        {people?.length === 0 && <li className={`p-2 text-sm ${muted}`}>{t("noPeople")}</li>}
        {people?.map((person) => (
          <li key={person.id}>
            <button type="button" onClick={() => void start(person)} className="flex min-h-11 w-full items-center gap-3 px-1 py-2 text-left hover:underline">
              <Avatar id={person.id} name={person.full_name} size={34} />
              <span className="flex flex-col">
                <span className="text-sm font-medium">{person.full_name}</span>
                <span className={`text-xs ${muted}`}>{subLabel({ id: person.id, full_name: person.full_name, role: person.role, schoolName: person.schools?.name ?? null })}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onClose} className={`min-h-11 text-sm underline ${muted}`}>{t("cancel")}</button>
    </div>
  );
}
