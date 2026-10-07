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
}: {
  poll: Poll;
  meId: string;
  names: Map<string, string>;
  canClose: boolean;
  onVote: (optionIds: string[]) => Promise<void>;
  onClose: () => Promise<void>;
  studio: boolean;
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
                  <span aria-hidden="true" className={`grid size-5 shrink-0 place-items-center border-2 border-current text-[11px] ${poll.multiple ? "rounded-md" : "rounded-full"}`}>{chosen ? "✓" : ""}</span>
                  <span className="flex-1">{option.label}</span>
                  <span className="text-xs tabular-nums opacity-80">{t("votes", { count })}</span>
                </span>
                <span aria-hidden="true" className="ml-7 block h-1.5 overflow-hidden rounded-full bg-black/10">
                  <span className={`block h-full ${bar}`} style={{ width: `${pct}%` }} />
                </span>
              </button>
              {showVoters && count > 0 && (
                <span className="ml-7 block text-xs opacity-80">
                  {poll.votes.filter((v) => v.option_id === option.id).map((v) => (v.profile_id === meId ? t("you") : names.get(v.profile_id) ?? "—")).join(", ")}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span>{t("voters", { count: voters })}</span>
        {voters > 0 && (
          <button type="button" onClick={() => setShowVoters((on) => !on)} className="underline underline-offset-2">
            {showVoters ? t("hideVoters") : t("showVoters")}
          </button>
        )}
        {canClose && !closed && (
          <button type="button" onClick={() => void onClose()} className="underline underline-offset-2">{t("closePoll")}</button>
        )}
      </div>
    </div>
  );
}

/** Writing a poll: a question, 2–12 options, one or several answers. */
export function PollComposer({
  onCreate,
  onCancel,
  panelClass,
  inputClass,
  buttonClass,
}: {
  onCreate: (question: string, options: string[], multiple: boolean) => Promise<boolean>;
  onCancel: () => void;
  panelClass: string;
  inputClass: string;
  buttonClass: string;
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
      className={`flex flex-col gap-3 p-4 ${panelClass}`}
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
        <input autoFocus value={question} maxLength={300} onChange={(e) => setQuestion(e.target.value)} className={inputClass} />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm">{t("pollOptions")}</legend>
        {options.map((option, index) => (
          <div key={index} className="flex gap-2">
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
              className={`${inputClass} flex-1`}
            />
            {options.length > 2 && (
              <button type="button" aria-label={t("removeOption", { n: index + 1 })} onClick={() => setOptions(options.filter((_, i) => i !== index))} className="px-2">×</button>
            )}
          </div>
        ))}
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} className="size-4" />
        {t("pollAllowMultiple")}
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !question.trim() || filled.length < 2} className={buttonClass}>{t("sendPoll")}</button>
        <button type="button" onClick={onCancel} className="min-h-11 px-3 text-sm underline">{t("cancel")}</button>
      </div>
    </form>
  );
}
