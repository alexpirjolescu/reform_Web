"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Poll } from "@/lib/messages";

/** A poll in the chat: tap to vote (again to change), live results, who voted what. */
export function PollView({
  poll,
  meId,
  names,
  canClose,
  onVote,
  onClose,
  studio,
  onColour = false,
}: {
  poll: Poll;
  meId: string;
  names: Map<string, string>;
  canClose: boolean;
  onVote: (optionIds: string[]) => Promise<void>;
  onClose: () => Promise<void>;
  studio: boolean;
  /** The poll sits in a coloured bubble (one's own): marks and links take the bubble's ink. */
  onColour?: boolean;
}) {
  const t = useTranslations("messages");
  const [busy, setBusy] = useState(false);
  const [showVoters, setShowVoters] = useState(false);
  const mine = poll.votes.filter((v) => v.profile_id === meId).map((v) => v.option_id);
  const voters = new Set(poll.votes.map((v) => v.profile_id)).size;
  const closed = Boolean(poll.closed_at);

  async function toggle(optionId: string) {
    if (closed || busy) return;
    const next = poll.multiple ? (mine.includes(optionId) ? mine.filter((id) => id !== optionId) : [...mine, optionId]) : mine.includes(optionId) ? [] : [optionId];
    setBusy(true);
    await onVote(next);
    setBusy(false);
  }

  const bar = studio ? "bg-teal" : "bg-vermilion";
  // iOS-style round marks (ui-radio / ui-check look; the option itself is a button with role radio or
  // checkbox, so the checked state is drawn with utilities). In teal on grey bubbles, in ink on coloured ones.
  const mark = poll.multiple ? "ui-check" : "ui-radio";
  const ring = onColour ? "border-current/45" : "";
  const checked = poll.multiple
    ? onColour ? "border-current bg-current before:bg-white before:[transform:none]" : "border-th-tint-fill bg-th-tint-fill before:[transform:none]"
    : onColour ? "border-[7px] border-current" : "border-[7px] border-th-tint-fill";
  const link = `ui-btn ui-plain ui-sm -ml-2 ${onColour ? "text-current" : ""}`;
  return (
    <div className="flex w-[min(340px,72vw)] flex-col gap-2.5">
      <span className="font-display text-[16px] font-semibold">{poll.question}</span>
      <span className="text-xs opacity-75">{closed ? t("pollClosed") : poll.multiple ? t("pollMultiple") : t("pollSingle")}</span>
      <ul className="flex flex-col gap-2" aria-label={poll.question}>
        {poll.options.map((option) => {
          const count = poll.votes.filter((v) => v.option_id === option.id).length;
          const pct = voters ? Math.round((100 * count) / voters) : 0;
          const chosen = mine.includes(option.id);
          return (
            <li key={option.id}>
              <button
                type="button"
                role={poll.multiple ? "checkbox" : "radio"}
                aria-checked={chosen}
                disabled={closed || busy}
                onClick={() => void toggle(option.id)}
                className="flex w-full flex-col gap-1 text-left disabled:cursor-default"
              >
                <span className="flex items-center gap-2 text-sm">
                  <span aria-hidden="true" className={`${mark} ${chosen ? checked : ring}`} />
                  <span className="flex-1">{option.label}</span>
                  <span className="text-xs tabular-nums opacity-80">{t("votes", { count })}</span>
                </span>
                <span aria-hidden="true" className="ml-[30px] block h-1.5 overflow-hidden rounded-full bg-black/10">
                  <span className={`block h-full ${bar}`} style={{ width: `${pct}%` }} />
                </span>
              </button>
              {showVoters && count > 0 && (
                <span className="ml-[30px] block text-xs opacity-80">
                  {poll.votes.filter((v) => v.option_id === option.id).map((v) => (v.profile_id === meId ? t("you") : names.get(v.profile_id) ?? "—")).join(", ")}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-x-3 text-xs">
        <span>{t("voters", { count: voters })}</span>
        {voters > 0 && (
          <button type="button" onClick={() => setShowVoters((on) => !on)} className={link}>
            {showVoters ? t("hideVoters") : t("showVoters")}
          </button>
        )}
        {canClose && !closed && (
          <button type="button" onClick={() => void onClose()} className={link}>{t("closePoll")}</button>
        )}
      </div>
    </div>
  );
}

/** Writing a poll: a question, 2–12 options, one or several answers. */
export function PollComposer({
  onCreate,
  onCancel,
}: {
  onCreate: (question: string, options: string[], multiple: boolean) => Promise<boolean>;
  onCancel: () => void;
}) {
  const t = useTranslations("messages");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multiple, setMultiple] = useState(false);
  const [busy, setBusy] = useState(false);
  const filled = options.map((o) => o.trim()).filter(Boolean);

  return (
    <form
      aria-label={t("newPoll")}
      className="ui-menu flex origin-bottom-left flex-col gap-3 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!question.trim() || filled.length < 2) return;
        setBusy(true);
        const ok = await onCreate(question.trim(), filled, multiple);
        setBusy(false);
        if (ok) onCancel();
      }}
    >
      <span className="font-display font-semibold">{t("newPoll")}</span>
      <label className="flex flex-col gap-1 text-sm">
        {t("pollQuestion")}
        <input autoFocus value={question} maxLength={300} onChange={(e) => setQuestion(e.target.value)} className="ui-field ui-sm" />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm">{t("pollOptions")}</legend>
        {options.map((option, index) => (
          <div key={index} className="flex items-center gap-1">
            <input
              aria-label={t("pollOption", { n: index + 1 })}
              value={option}
              maxLength={100}
              onChange={(e) => {
                const next = [...options];
                next[index] = e.target.value;
                // A new empty option appears as soon as the last one is used.
                if (index === options.length - 1 && e.target.value && options.length < 12) next.push("");
                setOptions(next);
              }}
              className="ui-field ui-sm flex-1"
            />
            {options.length > 2 && (
              <button type="button" aria-label={t("removeOption", { n: index + 1 })} onClick={() => setOptions(options.filter((_, i) => i !== index))} className="ui-btn ui-plain ui-icon ui-sm ui-neutral shrink-0 text-lg font-normal">×</button>
            )}
          </div>
        ))}
      </fieldset>
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm">
        {t("pollAllowMultiple")}
        <input type="checkbox" role="switch" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} className="ui-switch" />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !question.trim() || filled.length < 2} className="ui-btn ui-filled">{t("sendPoll")}</button>
        <button type="button" onClick={onCancel} className="ui-btn ui-gray ui-neutral">{t("cancel")}</button>
      </div>
    </form>
  );
}
