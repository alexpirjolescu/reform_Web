"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/avatar";
import { ClipIcon, FileIcon, SearchIcon, SendIcon } from "@/components/icons";
import { Logo } from "@/components/logo";
import { relativeStamp, timeOfDay } from "@/lib/format";
import { storageSafeName } from "@/lib/library";
import {
  maxMessageAttachment,
  messageAttachmentTypes,
  type ChatMessage,
  type ConversationSummary,
  type Person,
  type SelectedConversation,
} from "@/lib/messages";
import { createClient } from "@/lib/supabase/client";
import type { Theme } from "@/lib/theme-shared";

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

/** Direct messages (PRD module 5): conversation list, live thread, composer, safety tools. */
export function Messenger({ variant, me, inbox, selected, locale }: Props) {
  const t = useTranslations("messages");
  const tr = useTranslations("roles");
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<ChatMessage[]>(selected?.messages ?? []);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [composing, setComposing] = useState(false);
  const [menu, setMenu] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const [typing, setTyping] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const typingChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSent = useRef(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const conversationId = selected?.id ?? null;

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

  // Live: new messages in any of my conversations (RLS only sends mine).
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
        setTyping(true);
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
    void typingChannel.current?.send({ type: "broadcast", event: "typing", payload: { id: me.id } });
  }

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const body = draft.trim();
    if (!conversationId || !body || sending) return;
    setSending(true);
    setError(null);
    const { data, error: sendError } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, body })
      .select("id, sender_id, body, attachment_path, attachment_name, created_at, edited_at, deleted_at")
      .single();
    setSending(false);
    if (sendError) return setError(selected?.blockedByMe ? t("errors.blocked") : t("errors.sendFailed"));
    setDraft("");
    setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
    scheduleRefresh();
  }

  async function attach(file: File) {
    if (!conversationId) return;
    if (file.size > maxMessageAttachment) return setError(t("errors.tooLarge"));
    if (!messageAttachmentTypes.includes(file.type)) return setError(t("errors.badType"));
    setSending(true);
    setError(null);
    const path = `${conversationId}/${crypto.randomUUID()}-${storageSafeName(file.name)}`;
    const stored = await supabase.storage.from("messages").upload(path, file, { contentType: file.type });
    if (stored.error) {
      setSending(false);
      return setError(t("errors.sendFailed"));
    }
    const { data, error: sendError } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, body: draft.trim(), attachment_path: path, attachment_name: file.name })
      .select("id, sender_id, body, attachment_path, attachment_name, created_at, edited_at, deleted_at")
      .single();
    setSending(false);
    if (fileInput.current) fileInput.current.value = "";
    if (sendError) return setError(t("errors.sendFailed"));
    setDraft("");
    setMessages((prev) => [...prev, data]);
    scheduleRefresh();
  }

  async function openAttachment(path: string) {
    const { data } = await supabase.storage.from("messages").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }

  async function removeMessage(id: string) {
    setConfirmDelete(null);
    const { error: removeError } = await supabase.from("messages").update({ body: "", deleted_at: new Date().toISOString() }).eq("id", id);
    if (removeError) return setError(t("errors.deleteFailed"));
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, body: "", deleted_at: new Date().toISOString() } : m)));
  }

  async function toggleBlock() {
    if (!selected) return;
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
    ? inbox.filter((c) => `${c.other.full_name} ${c.other.schoolName ?? ""}`.toLocaleLowerCase("ro").includes(filter.trim().toLocaleLowerCase("ro")))
    : inbox;

  // ---- shared pieces -------------------------------------------------------

  const searchBox = (
    <label className={`flex h-11 items-center gap-2 px-3 ${variant === "dark" ? "bg-night-3" : variant === "color" ? "rounded-full border-2 border-ink px-3.5" : "border border-ink"}`}>
      <SearchIcon size={16} strokeWidth={variant === "color" ? 2.5 : 2} className={variant === "dark" ? "text-night-muted" : ""} />
      <span className="sr-only">{t("searchConversations")}</span>
      <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)}
        placeholder={variant === "color" ? t("searchFun") : variant === "dark" ? t("searchPlaceholder") : t("searchPeople")}
        className={`w-full min-w-0 border-0 bg-transparent text-sm ${variant === "dark" ? "text-white placeholder:text-night-muted" : ""}`} />
    </label>
  );

  const newButton = (
    <button type="button" onClick={() => setComposing((on) => !on)} aria-expanded={composing}
      aria-label={variant === "white" ? undefined : t("newConversation")}
      className={
        variant === "dark"
          ? "grid size-11 place-items-center bg-teal text-[22px] text-night"
          : variant === "color"
            ? "grid size-11 place-items-center rounded-full border-2 border-ink bg-vermilion text-[22px] font-semibold"
            : "h-10 bg-ink px-3.5 text-sm text-white"
      }>
      {variant === "white" ? `+ ${t("new")}` : "+"}
    </button>
  );

  const conversationList = (
    <ul className={`flex min-h-0 flex-1 flex-col overflow-auto ${variant === "color" ? "gap-2" : ""}`}>
      {shownInbox.length === 0 && <li className={`p-4 text-sm ${variant === "dark" ? "text-night-muted" : "text-muted"}`}>{inbox.length ? t("noMatches") : t("empty")}</li>}
      {shownInbox.map((c) => {
        const active = c.id === conversationId;
        const stamp = relativeStamp(c.lastAt, locale);
        const preview = c.lastText === null ? (c.hasMessages ? t("deleted") : t("noMessagesYet")) : `${c.lastMine ? `${t("you")}: ` : ""}${c.lastText}`;
        if (variant === "dark") {
          return (
            <li key={c.id}>
              <Link href={`/app/messages?c=${c.id}`} aria-current={active ? "true" : undefined}
                className={`flex gap-3 border-b border-night-rule px-[18px] py-3.5 ${active ? "bg-night-4" : "hover:bg-night-2"}`}>
                <Avatar id={c.other.id} name={c.other.full_name} size={40} />
                <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <span className="flex justify-between gap-2"><span className="text-[15px] font-medium">{c.other.full_name}</span><span className="text-xs text-night-muted">{stamp}</span></span>
                  <span className="text-xs text-night-muted">{subLabel(c.other)}</span>
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] text-night-body">{preview}</span>
                    {c.unread > 0 && !active && <span className="shrink-0 bg-teal px-[7px] py-px text-xs text-night">{c.unread}</span>}
                  </span>
                </span>
              </Link>
            </li>
          );
        }
        if (variant === "color") {
          return (
            <li key={c.id}>
              <Link href={`/app/messages?c=${c.id}`} aria-current={active ? "true" : undefined}
                className={`flex gap-3 rounded-[20px] border-2 py-2.5 pr-3 pl-2.5 ${active ? "border-ink bg-vermilion-wash" : "border-transparent hover:border-line"}`}>
                <Avatar id={c.other.id} name={c.other.full_name} size={44} ring="#221f20" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex justify-between gap-2"><span className="text-[15px] font-semibold">{c.other.full_name}</span><span className="text-xs text-muted">{stamp}</span></span>
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] text-[#4a4648]">{preview}</span>
                    {c.unread > 0 && !active && <span className="shrink-0 rounded-full border-[1.5px] border-ink bg-vermilion px-2 font-fun text-[13px] font-bold">{c.unread}</span>}
                  </span>
                </span>
              </Link>
            </li>
          );
        }
        return (
          <li key={c.id}>
            <Link href={`/app/messages?c=${c.id}`} aria-current={active ? "true" : undefined}
              className={`flex flex-col gap-1 border-b border-line px-[22px] py-3.5 ${active ? "bg-teal-wash" : "hover:bg-sand"}`}>
              <span className="flex items-baseline justify-between gap-2"><span className={`font-display text-base ${c.unread && !active ? "font-extrabold" : "font-semibold"}`}>{c.other.full_name}</span><span className="text-xs text-muted">{stamp}</span></span>
              <span className="text-xs text-muted">{subLabel(c.other)}</span>
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-[13px]">{preview}</span>
                {c.unread > 0 && !active && <span className="shrink-0 bg-teal px-[7px] text-xs font-semibold">{c.unread}</span>}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );

  const listColumn = (header: ReactNode) => (
    <section aria-label={t("conversations")} className={`${conversationId ? "hidden md:flex" : "flex"} min-h-0 shrink-0 flex-col ${
      variant === "dark" ? "border-night-line md:w-[320px] md:border-r" : variant === "color" ? "gap-3.5 px-4 pt-6 pb-4 md:w-[320px] md:pl-5" : "border-ink md:w-[300px] md:border-r"
    }`}>
      {header}
      {composing ? <NewConversation variant={variant} onClose={() => setComposing(false)} subLabel={subLabel} /> : conversationList}
    </section>
  );

  // ---- thread -------------------------------------------------------------

  const bubbles = () => {
    const out: ReactNode[] = [];
    let lastDay = "";
    for (const m of messages) {
      const day = dayKey(m.created_at);
      if (day !== lastDay) {
        lastDay = day;
        const label = relativeStamp(m.created_at, locale).includes(":") ? t("today") : new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ro-RO", { timeZone: "Europe/Bucharest", weekday: "long", day: "numeric", month: "long" }).format(new Date(m.created_at));
        out.push(
          variant === "white" ? (
            <div key={`d-${day}`} className="flex items-center gap-3 text-xs text-muted"><span className="flex-1 border-t border-line" />{label}<span className="flex-1 border-t border-line" /></div>
          ) : variant === "color" ? (
            <span key={`d-${day}`} className="self-center rounded-full border-[1.5px] border-ink px-3 py-0.5 text-xs font-medium">{label}</span>
          ) : (
            <div key={`d-${day}`} className="self-center pt-1 pb-2.5 text-xs text-night-muted">{label}</div>
          ),
        );
      }
      const mine = m.sender_id === me.id;
      const bubble =
        variant === "dark"
          ? mine ? "bg-teal text-night" : "bg-night-4 text-white"
          : variant === "color"
            ? `border-2 border-ink ${mine ? "rounded-[20px_20px_6px_20px] bg-vermilion" : "rounded-[20px_20px_20px_6px] bg-white"}`
            : `border border-ink ${mine ? "bg-ink text-white" : "bg-white"}`;
      const fileChip =
        variant === "dark" ? "border border-night-edge bg-night-4" : variant === "color" ? "rounded-[20px] border-2 border-ink bg-white" : "border border-ink";
      out.push(
        <div key={m.id} className={`group flex max-w-[85%] flex-col gap-1 sm:max-w-[64%] ${mine ? "items-end self-end" : "items-start self-start"}`}>
          {m.deleted_at ? (
            <div className={`px-4 py-2.5 text-sm italic ${variant === "dark" ? "text-night-muted" : "text-muted"}`}>{t("deleted")}</div>
          ) : (
            <>
              {m.attachment_path && (
                <button type="button" onClick={() => void openAttachment(m.attachment_path as string)} className={`flex items-center gap-3 px-3.5 py-3 text-left ${fileChip}`}>
                  <span className={`px-1.5 py-[5px] font-display text-[11px] font-bold ${variant === "color" ? "rounded-xl border-2 border-ink" : ""} ${m.attachment_name?.toLowerCase().endsWith(".pdf") ? "bg-vermilion text-ink" : "bg-lime text-ink"}`}>
                    {m.attachment_name?.split(".").pop()?.toUpperCase().slice(0, 4) ?? "FILE"}
                  </span>
                  <span className="flex flex-col"><span className="text-sm">{m.attachment_name}</span><span className={`text-xs ${variant === "dark" ? "text-night-muted" : "text-muted"}`}>{t("open")}</span></span>
                </button>
              )}
              {m.body && <div className={`px-4 py-3 text-[15px] leading-normal break-words whitespace-pre-wrap ${bubble}`}>{m.body}</div>}
            </>
          )}
          <span className={`flex items-center gap-2 text-[11px] ${variant === "dark" ? "text-night-muted" : "text-muted"}`}>
            {timeOfDay(m.created_at, locale)}
            {mine && !m.deleted_at && (
              confirmDelete === m.id ? (
                <>
                  <button type="button" onClick={() => void removeMessage(m.id)} className="min-h-6 font-medium text-vermilion underline">{t("confirmDelete")}</button>
                  <button type="button" onClick={() => setConfirmDelete(null)} className="min-h-6 underline">{t("cancel")}</button>
                </>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(m.id)} className="min-h-6 underline opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus:opacity-100">{t("delete")}</button>
              )
            )}
          </span>
        </div>,
      );
    }
    return out;
  };

  const blockedNote = selected?.blockedByMe && (
    <p className={`px-4 py-2 text-sm ${variant === "dark" ? "bg-night-4" : "bg-honey-wash"}`}>{t("youBlocked")}</p>
  );

  const composer = selected && (
    <form onSubmit={send} className={
      variant === "dark" ? "flex items-end gap-2.5 border-t border-night-line px-4 pt-4 pb-[22px] sm:px-7"
        : variant === "color" ? "flex items-center gap-2.5 border-t-2 border-ink px-[18px] py-3.5"
          : "flex items-stretch px-4 pt-4 pb-[22px] sm:px-8"
    }>
      <button type="button" onClick={() => fileInput.current?.click()} disabled={sending || selected.blockedByMe} aria-label={t("attach")}
        className={
          variant === "dark" ? "grid size-12 shrink-0 place-items-center border border-night-edge disabled:opacity-50"
            : variant === "color" ? "grid size-12 shrink-0 place-items-center rounded-full border-2 border-ink bg-honey disabled:opacity-50"
              : "grid w-[52px] shrink-0 place-items-center border-2 border-r-0 border-ink disabled:opacity-50"
        }>
        <ClipIcon size={20} strokeWidth={variant === "color" ? 2.5 : 2} />
      </button>
      <input ref={fileInput} type="file" accept={messageAttachmentTypes.join(",")} className="sr-only" tabIndex={-1} aria-hidden="true"
        onChange={(e) => e.target.files?.[0] && void attach(e.target.files[0])} />
      <label className="flex flex-1">
        <span className="sr-only">{t("messageTo", { name: selected.other.full_name })}</span>
        <textarea
          rows={1}
          value={draft}
          maxLength={4000}
          disabled={selected.blockedByMe}
          onChange={(e) => {
            setDraft(e.target.value);
            announceTyping();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={variant === "color" ? t("writeTo", { name: selected.other.full_name.split(" ")[0] }) : t("write")}
          className={
            variant === "dark" ? "min-h-12 w-full resize-none border border-night-edge bg-night-3 px-3.5 py-3 text-[15px] text-white"
              : variant === "color" ? "h-12 w-full resize-none rounded-full border-2 border-ink px-[18px] py-3 text-[15px]"
                : "min-h-[52px] w-full resize-none border-2 border-ink p-3.5 text-[15px]"
          }
        />
      </label>
      <button type="submit" disabled={sending || !draft.trim() || selected.blockedByMe} aria-label={variant === "color" ? t("send") : undefined}
        className={
          variant === "dark" ? "h-12 shrink-0 bg-teal px-5 font-display text-[15px] font-semibold text-night disabled:opacity-60"
            : variant === "color" ? "grid size-12 shrink-0 place-items-center rounded-full border-2 border-ink bg-vermilion disabled:opacity-60"
              : "shrink-0 border-2 border-ink bg-ink px-[22px] font-display text-[15px] font-semibold text-white disabled:opacity-60"
        }>
        {variant === "color" ? <SendIcon size={20} strokeWidth={2.5} /> : t("send")}
      </button>
    </form>
  );

  const typingNote = typing && selected && (
    <div aria-live="polite" className={`flex items-center gap-2.5 text-[13px] ${variant === "dark" ? "text-night-muted" : "text-muted"}`}>
      <span aria-hidden="true" className={`flex gap-[5px] px-3.5 py-3 ${variant === "color" ? "rounded-[20px_20px_20px_6px] border-2 border-ink" : variant === "dark" ? "bg-night-4" : "border border-ink"}`}>
        {[0, 1, 2].map((i) => <span key={i} className={`size-2 rounded-full ${variant === "dark" ? "bg-teal" : "bg-vermilion"}`} />)}
      </span>
      {t("typing", { name: selected.other.full_name.split(" ")[0] })}
    </div>
  );

  const safetyMenu = selected && (
    <div role="menu" aria-label={t("options")} className={`absolute top-full right-4 z-20 mt-2 flex w-[260px] flex-col py-1.5 sm:right-7 ${variant === "dark" ? "border border-night-edge bg-night-3" : "rounded-[18px] border-2 border-ink bg-white"}`}>
      <button type="button" role="menuitem" onClick={() => void toggleBlock()} className="px-4 py-3 text-left text-sm hover:underline">
        {selected.blockedByMe ? t("unblock") : t("block")}
      </button>
      {reporting ? (
        <ReportForm variant={variant} onCancel={() => setReporting(false)} onSubmit={report} />
      ) : (
        <button type="button" role="menuitem" onClick={() => setReporting(true)} className={`border-t px-4 py-3 text-left text-sm hover:underline ${variant === "dark" ? "border-night-line text-honey" : "border-line font-medium"}`}>
          {t("report")}
        </button>
      )}
    </div>
  );

  const thread = (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-auto px-4 py-6 sm:px-7">
      {selected && messages.length === 0 && <p className={`self-center text-sm ${variant === "dark" ? "text-night-muted" : "text-muted"}`}>{t("startHint", { name: selected.other.full_name })}</p>}
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
    <div className={`hidden flex-1 place-items-center p-8 text-center md:grid ${variant === "dark" ? "text-night-muted" : "text-muted"}`}>
      <p>{inbox.length ? t("pick") : t("emptyLong")}</p>
    </div>
  );

  // ---- layouts ------------------------------------------------------------

  if (variant === "dark") {
    return (
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {listColumn(
          <div className="flex flex-col gap-4 px-[18px] pt-[26px] pb-4">
            <div className="flex items-center justify-between"><h1 className="font-display text-[36px] font-bold text-teal">{t("title")}</h1>{newButton}</div>
            {!composing && searchBox}
          </div>,
        )}
        {selected ? (
          <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="relative flex items-center gap-3.5 border-b border-night-line px-4 py-[18px] sm:px-7">
              {backLink}
              <Avatar id={selected.other.id} name={selected.other.full_name} size={44} />
              <div className="min-w-0 flex-1"><h2 className="font-display text-[19px] font-semibold">{selected.other.full_name}</h2><div className="text-[13px] text-night-muted">{subLabel(selected.other)}</div></div>
              <button type="button" onClick={() => setFilesOpen((on) => !on)} aria-expanded={filesOpen} aria-label={t("filesInConversation")} className={`grid size-11 place-items-center border ${filesOpen ? "border-teal bg-night-4" : "border-night-edge"}`}><FileIcon size={18} /></button>
              <button type="button" onClick={() => setMenu((on) => !on)} aria-expanded={menu} aria-label={t("options")} className={`size-11 border text-xl ${menu ? "border-teal bg-night-4" : "border-night-edge"}`}>⋯</button>
              {menu && safetyMenu}
            </div>
            {filesOpen && (
              <div className="border-b border-night-line bg-night-2 px-4 py-3 text-sm sm:px-7">
                {selected.files.length === 0 ? <span className="text-night-muted">{t("noFiles")}</span> : (
                  <ul className="flex flex-wrap gap-2">
                    {selected.files.map((f) => <li key={f.id}><button type="button" onClick={() => void openAttachment(f.path)} className="border border-night-edge px-3 py-1.5 hover:border-white">{f.name}</button></li>)}
                  </ul>
                )}
              </div>
            )}
            {alerts}
            {thread}
            {composer}
          </main>
        ) : emptyThread}
      </div>
    );
  }

  if (variant === "color") {
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
          <main className="m-3 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[28px] border-2 border-ink md:my-4 md:mr-4 md:ml-0">
            <div className="relative flex items-center gap-3.5 border-b-2 border-ink bg-vermilion px-4 py-3.5 sm:px-5">
              {backLink}
              <Avatar id={selected.other.id} name={selected.other.full_name} size={46} ring="#221f20" />
              <div className="min-w-0 flex-1"><h2 className="font-display text-xl font-extrabold">{selected.other.full_name}</h2><div className="text-[13px]">{subLabel(selected.other)}</div></div>
              <button type="button" onClick={() => setMenu((on) => !on)} aria-expanded={menu} aria-label={t("optionsLong")} className="size-11 rounded-full border-2 border-ink bg-white text-xl">⋯</button>
              {menu && safetyMenu}
            </div>
            {alerts}
            {thread}
            {composer}
          </main>
        ) : emptyThread}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      {listColumn(
        <div className="flex flex-col gap-3.5 border-b-2 border-ink px-[22px] pt-[22px] pb-3.5">
          <div className="flex items-center justify-between"><h1 className="font-display text-[30px] font-extrabold">{t("title")}</h1>{newButton}</div>
          {!composing && searchBox}
        </div>,
      )}
      {selected ? (
        <>
          <main className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-3.5 border-b border-ink px-4 py-5 sm:px-8">
              {backLink}
              <h2 className="font-display text-[26px] font-extrabold">{selected.other.full_name}</h2>
              <span className="text-[13px] text-muted">{subLabel(selected.other)}</span>
            </div>
            {alerts}
            {thread}
            {composer}
          </main>
          <aside aria-label={t("about")} className="hidden shrink-0 flex-col gap-6 overflow-auto border-l border-ink px-6 py-[26px] lg:flex lg:w-[280px]">
            <div className="flex flex-col gap-2.5">
              <Avatar id={selected.other.id} name={selected.other.full_name} size={72} />
              <h2 className="font-display text-[22px] font-extrabold">{selected.other.full_name}</h2>
              <span className="text-[13px] text-muted">{[tr(selected.other.role), selected.other.schoolName].filter(Boolean).join(" · ")}</span>
            </div>
            <div>
              <h3 className="mb-1 font-display text-[15px] font-bold">_ {t("sentFiles")}</h3>
              {selected.files.length === 0 && <p className="py-2 text-sm text-muted">{t("noFiles")}</p>}
              {selected.files.map((f) => (
                <button key={f.id} type="button" onClick={() => void openAttachment(f.path)} className="flex w-full justify-between gap-2 border-b border-line py-2.5 text-left text-sm hover:underline">
                  <span className="truncate">{f.name}</span><span className="shrink-0 text-muted">{relativeStamp(f.at, locale)}</span>
                </button>
              ))}
            </div>
            <div>
              <h3 className="mb-1 font-display text-[15px] font-bold">_ {t("sharedTasks")}</h3>
              {selected.tasks.length === 0 && <p className="py-2 text-sm text-muted">{t("noTasks")}</p>}
              {selected.tasks.map((task) => (
                <Link key={task.id} href={`/app/workspace/${task.board_id}`} className="block border-b border-line py-2.5 text-sm hover:underline">{task.title}</Link>
              ))}
            </div>
            <div className="mt-auto flex flex-col gap-2">
              <h3 className="mb-1 font-display text-[15px] font-bold">_ {t("safety")}</h3>
              <button type="button" onClick={() => void toggleBlock()} className="h-11 border border-ink px-3.5 text-left text-sm hover:bg-sand">{selected.blockedByMe ? t("unblock") : t("block")}</button>
              {reporting ? (
                <ReportForm variant="white" onCancel={() => setReporting(false)} onSubmit={report} />
              ) : (
                <button type="button" onClick={() => setReporting(true)} className="h-11 border border-ink px-3.5 text-left text-sm hover:bg-sand">{t("report")}</button>
              )}
              <p className="mt-1 text-xs leading-normal text-muted">{t("safetyNote")}</p>
            </div>
          </aside>
        </>
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
          className={`p-2 text-sm ${variant === "dark" ? "border border-night-edge bg-night text-white" : variant === "color" ? "rounded-xl border-2 border-ink" : "border border-ink"}`} />
      </label>
      <div className="flex gap-2">
        <button type="submit" className={`min-h-11 px-3 text-sm font-medium ${variant === "dark" ? "bg-honey text-night" : variant === "color" ? "rounded-full border-2 border-ink bg-honey" : "bg-ink text-white"}`}>{t("sendReport")}</button>
        <button type="button" onClick={onCancel} className="min-h-11 px-3 text-sm underline">{t("cancel")}</button>
      </div>
      <p className={`text-xs ${variant === "dark" ? "text-night-muted" : "text-muted"}`}>{t("safetyNote")}</p>
    </form>
  );
}

type Candidate = { id: string; full_name: string; role: Person["role"]; schools: { name: string } | null };

function NewConversation({ variant, onClose, subLabel }: { variant: Theme; onClose: () => void; subLabel: (p: Person) => string }) {
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

  const muted = variant === "dark" ? "text-night-muted" : "text-muted";
  return (
    <div className={`flex min-h-0 flex-1 flex-col gap-3 ${variant === "color" ? "" : "px-[18px] pb-4"}`}>
      <label className={`flex h-11 items-center gap-2 px-3 ${variant === "dark" ? "bg-night-3" : variant === "color" ? "rounded-full border-2 border-ink" : "border border-ink"}`}>
        <SearchIcon size={16} />
        <span className="sr-only">{t("findPerson")}</span>
        <input autoFocus type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("findPerson")}
          className={`w-full border-0 bg-transparent text-sm ${variant === "dark" ? "text-white placeholder:text-night-muted" : ""}`} />
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
