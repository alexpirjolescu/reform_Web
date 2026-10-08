"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { EmbedFrame } from "@/components/news/embed-frame";
import { embedPlayer, parseLink, providerNames } from "@/lib/embeds";
import { timeOfDay } from "@/lib/format";
import { badgeOf } from "@/lib/library";
import { quickReactions, type ChatMessage, type Poll, type Reaction, type Resource } from "@/lib/messages";
import type { Theme } from "@/lib/theme-shared";
import { PollView } from "./poll";
import { Sticker } from "./stickers";

const urlPattern = /https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/g;

/** Text with its links clickable. */
function Linkified({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(urlPattern)) {
    out.push(text.slice(last, match.index));
    out.push(
      <a key={match.index} href={match[0]} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-2">
        {match[0]}
      </a>,
    );
    last = (match.index ?? 0) + match[0].length;
  }
  out.push(text.slice(last));
  return <>{out}</>;
}

/** Videos and posts linked in a message play right in the chat. YouTube and Vimeo load at once
 * (no cookies until played); Instagram, TikTok, Facebook and Spotify take one tap (they track). */
function LinkPlayers({ text, studio }: { text: string; studio: boolean }) {
  const t = useTranslations("news");
  const players = [...new Set(text.match(urlPattern) ?? [])]
    .slice(0, 3)
    .flatMap((raw) => {
      const parsed = parseLink(raw);
      if (parsed?.kind !== "embed") return [];
      const player = embedPlayer(parsed.provider, parsed.url);
      return player ? [{ ...parsed, player }] : [];
    });
  if (!players.length) return null;
  return (
    <div className="flex w-[min(420px,78vw)] flex-col gap-2">
      {players.map(({ provider, url, player }) => (
        <EmbedFrame
          key={url}
          player={player}
          provider={providerNames[provider]}
          url={url}
          title={t("embedTitle", { provider: providerNames[provider] })}
          autoLoad={provider === "youtube" || provider === "vimeo"}
          boxClass={studio ? "border border-th-edge bg-th-card" : "rounded-[20px] border-2 border-ink bg-white"}
          buttonClass="ui-btn ui-filled"
          labels={{ load: t("embedLoad"), open: t("embedOpen", { provider: providerNames[provider] }), notice: t("embedNotice", { company: player.company }) }}
        />
      ))}
    </div>
  );
}

export type MessageHandlers = {
  onReply: (message: ChatMessage) => void;
  onReact: (message: ChatMessage, emoji: string, on: boolean) => void;
  onPin: (message: ChatMessage, pin: boolean) => void;
  onDelete: (message: ChatMessage) => void;
  onOpenAttachment: (path: string) => void;
  onVote: (poll: Poll, optionIds: string[]) => Promise<void>;
  onClosePoll: (poll: Poll) => Promise<void>;
  onJump: (id: string) => void;
};

/** One message: text, file, library file, sticker, GIF, poll or group note, with its reply, reactions and actions. */
export function MessageItem({
  message,
  meId,
  names,
  variant,
  locale,
  group,
  showSender,
  reactions,
  poll,
  resource,
  repliedTo,
  canPin,
  canAct,
  handlers,
}: {
  message: ChatMessage;
  meId: string;
  names: Map<string, string>;
  variant: Theme;
  locale: string;
  group: boolean;
  showSender: boolean;
  reactions: Reaction[];
  poll: Poll | undefined;
  resource: Resource | undefined;
  repliedTo: ChatMessage | undefined;
  canPin: boolean;
  canAct: boolean;
  handlers: MessageHandlers;
}) {
  const t = useTranslations("messages");
  const [picking, setPicking] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const studio = variant !== "color";
  const muted = studio ? "text-th-muted" : "text-muted";
  const mine = message.sender_id === meId;
  const name = (id: string) => (id === meId ? t("you") : names.get(id) ?? t("someone"));

  if (message.kind === "system" && message.system) {
    const s = message.system;
    // In notes, people are named in full (yourself included); "you did it" has its own wording.
    const targets = (s.targets ?? []).map((id) => names.get(id) ?? t("someone")).join(", ");
    const text = t(`${message.sender_id === meId ? "eventsYou" : "events"}.${s.event}`, {
      actor: name(message.sender_id),
      targets,
      title: s.title ?? "",
      value: s.value ?? "",
      send: s.only_admins_send ? t("rules.adminsSend") : t("rules.allSend"),
      edit: s.only_admins_edit ? t("rules.adminsEdit") : t("rules.allEdit"),
    });
    return (
      <div id={`msg-${message.id}`} className={`self-center px-3 py-1 text-center text-xs ${studio ? "bg-th-sunk text-th-muted" : "rounded-full border-[1.5px] border-ink bg-white"}`}>
        {text}
      </div>
    );
  }

  const bubble = studio
    ? mine ? "bg-teal text-ink" : "bg-th-raised text-th-fg"
    : `border-2 border-ink ${mine ? "rounded-[20px_20px_6px_20px] bg-vermilion" : "rounded-[20px_20px_20px_6px] bg-white"}`;
  const card = studio ? "border border-th-edge bg-th-raised" : "rounded-[20px] border-2 border-ink bg-white";
  const grouped = new Map<string, string[]>();
  for (const r of reactions) grouped.set(r.emoji, [...(grouped.get(r.emoji) ?? []), r.profile_id]);
  const myReactions = new Set(reactions.filter((r) => r.profile_id === meId).map((r) => r.emoji));

  let content: ReactNode;
  if (message.deleted_at) {
    content = <div className={`px-4 py-2.5 text-sm italic ${muted}`}>{t("deleted")}</div>;
  } else if (message.kind === "sticker" && message.sticker) {
    content = <Sticker id={message.sticker} size={128} label={t(`stickerNames.${message.sticker}`)} />;
  } else if (message.kind === "gif" && message.gif) {
    content = (
      <figure className="flex flex-col gap-0.5">
        {/* eslint-disable-next-line @next/next/no-img-element -- GIPHY media, animated */}
        <img src={message.gif.url} alt={message.gif.title || "GIF"} width={message.gif.width} height={message.gif.height} loading="lazy"
          className={`h-auto max-w-[min(260px,70vw)] ${studio ? "" : "rounded-[18px] border-2 border-ink"}`} />
        <figcaption className={`text-[10px] font-semibold tracking-wide uppercase ${muted}`}>GIPHY</figcaption>
      </figure>
    );
  } else if (message.kind === "poll" && poll) {
    content = (
      <div className={`px-4 py-3.5 ${bubble}`}>
        <PollView poll={poll} meId={meId} names={names} studio={studio} onColour={mine} canClose={poll.created_by === meId}
          onVote={(ids) => handlers.onVote(poll, ids)} onClose={() => handlers.onClosePoll(poll)} />
      </div>
    );
  } else {
    content = (
      <>
        {message.kind === "resource" && (
          resource ? (
            <a href={resource.external_url ?? `/app/library/file/${resource.id}`} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-3 px-3.5 py-3 text-left hover:underline ${card}`}>
              <span className="w-11 shrink-0 py-[5px] text-center font-display text-[11px] font-bold" style={{ background: badgeOf(resource).bg, color: badgeOf(resource).fg }}>{badgeOf(resource).label.slice(0, 5)}</span>
              <span className="flex min-w-0 flex-col"><span className="text-sm break-words">{resource.name}</span><span className={`text-xs ${muted}`}>{t("fromResourcesShort")} · {t("open")}</span></span>
            </a>
          ) : (
            <div className={`px-3.5 py-3 text-sm italic ${card} ${muted}`}>{t("resourceGone")}</div>
          )
        )}
        {message.attachment_path && (
          <button type="button" onClick={() => handlers.onOpenAttachment(message.attachment_path as string)} className={`flex items-center gap-3 px-3.5 py-3 text-left ${card}`}>
            <span className={`px-1.5 py-[5px] font-display text-[11px] font-bold ${studio ? "" : "rounded-xl border-2 border-ink"} ${message.attachment_name?.toLowerCase().endsWith(".pdf") ? "bg-vermilion text-ink" : "bg-lime text-ink"}`}>
              {message.attachment_name?.split(".").pop()?.toUpperCase().slice(0, 4) ?? "FILE"}
            </span>
            <span className="flex flex-col"><span className="text-sm">{message.attachment_name}</span><span className={`text-xs ${muted}`}>{t("open")}</span></span>
          </button>
        )}
        {message.body && (
          <div className={`px-4 py-3 text-[15px] leading-normal break-words whitespace-pre-wrap ${bubble}`}>
            <Linkified text={message.body} />
          </div>
        )}
        {message.body && <LinkPlayers text={message.body} studio={studio} />}
      </>
    );
  }

  // Hover actions: small round icon buttons; the reaction bar is an iOS-style pop-up menu.
  const toolButton = "ui-btn ui-plain ui-icon ui-sm ui-neutral text-sm font-normal";

  return (
    <div id={`msg-${message.id}`} className={`group flex max-w-[88%] flex-col gap-1 sm:max-w-[70%] ${mine ? "items-end self-end" : "items-start self-start"}`}>
      {group && showSender && !mine && <span className={`px-1 text-xs font-semibold ${muted}`}>{name(message.sender_id)}</span>}
      {message.pinned_at && !message.deleted_at && <span className={`px-1 text-[11px] ${muted}`}>📌 {t("pinned")}</span>}
      {repliedTo && (
        <button type="button" onClick={() => handlers.onJump(repliedTo.id)}
          className={`max-w-full border-l-4 px-3 py-1.5 text-left text-xs ${studio ? "border-teal bg-th-sunk" : "rounded-xl border-ink bg-sand"}`}>
          <span className="block font-semibold">{name(repliedTo.sender_id)}</span>
          <span className="line-clamp-2 opacity-80">{repliedTo.deleted_at ? t("deleted") : repliedTo.body || t(`kinds.${repliedTo.kind}`)}</span>
        </button>
      )}
      {content}
      {grouped.size > 0 && (
        <ul className="flex flex-wrap gap-1" aria-label={t("reactions")}>
          {[...grouped.entries()].map(([emoji, who]) => (
            <li key={emoji}>
              <button type="button" disabled={!canAct} onClick={() => handlers.onReact(message, emoji, !myReactions.has(emoji))}
                title={who.map(name).join(", ")} aria-pressed={myReactions.has(emoji)}
                aria-label={t("reactionCount", { emoji, count: who.length, names: who.map(name).join(", ") })}
                className="ui-chip min-h-7 gap-1 px-2.5 text-sm aria-pressed:bg-th-tint-fill/25 aria-pressed:text-th-fg">
                <span>{emoji}</span><span className="text-xs">{who.length}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <span className={`flex flex-wrap items-center gap-1 text-[11px] ${muted}`}>
        {timeOfDay(message.created_at, locale)}
        {!message.deleted_at && canAct && (
          <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 focus-within:opacity-100">
            <button type="button" onClick={() => handlers.onReply(message)} aria-label={t("reply")} title={t("reply")} className={toolButton}>↩</button>
            <span className="relative">
              <button type="button" onClick={() => setPicking((on) => !on)} aria-expanded={picking} aria-label={t("react")} title={t("react")} className={toolButton}>☺</button>
              {picking && (
                <span role="menu" className={`ui-menu absolute bottom-full z-20 mb-1 flex min-w-0 gap-0.5 rounded-full p-1 ${mine ? "right-0 origin-bottom-right" : "left-0 origin-bottom-left"}`}>
                  {quickReactions.map((emoji) => (
                    <button key={emoji} type="button" role="menuitem" aria-label={emoji} onClick={() => { setPicking(false); handlers.onReact(message, emoji, !myReactions.has(emoji)); }}
                      className={`ui-menu-item size-10 justify-center rounded-full p-0 text-xl ${myReactions.has(emoji) ? "bg-th-tint-fill/25" : ""}`}>
                      {emoji}
                    </button>
                  ))}
                </span>
              )}
            </span>
            {canPin && (
              <button type="button" onClick={() => handlers.onPin(message, !message.pinned_at)} aria-label={message.pinned_at ? t("unpin") : t("pin")} title={message.pinned_at ? t("unpin") : t("pin")} className={toolButton}>📌</button>
            )}
            {mine && (confirm ? (
              <>
                <button type="button" onClick={() => { setConfirm(false); handlers.onDelete(message); }} className="ui-btn ui-filled ui-danger ui-sm">{t("confirmDelete")}</button>
                <button type="button" onClick={() => setConfirm(false)} className="ui-btn ui-plain ui-sm ui-neutral">{t("cancel")}</button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirm(true)} className="ui-btn ui-plain ui-sm ui-danger">{t("delete")}</button>
            ))}
          </span>
        )}
      </span>
    </div>
  );
}
