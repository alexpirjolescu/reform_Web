"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { choiceLetter, isAnswered, type RunnerAnswer, type RunnerQuestion } from "@/lib/assessments";
import { createClient } from "@/lib/supabase/client";
import type { Theme } from "@/lib/theme-shared";

type Props = {
  variant: Theme;
  attemptId: string;
  title: string;
  kicker: string | null;
  closesLabel: string;
  attemptLabel: string;
  questions: RunnerQuestion[];
  initialAnswers: Record<string, RunnerAnswer>;
  /** White design: blocks drawn in the left column above and below the question grid. */
};

const empty: RunnerAnswer = { choice_ids: [], text_answer: "" };

/** Takes a quiz one question at a time; every change is saved straight away (save_answer). */
export function QuizRunner({ variant, attemptId, title, kicker, closesLabel, attemptLabel, questions, initialAnswers }: Props) {
  const t = useTranslations("assessments");
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [answers, setAnswers] = useState<Record<string, RunnerAnswer>>(initialAnswers);
  const [index, setIndex] = useState(() => {
    const firstOpen = questions.findIndex((q) => !isAnswered(q, initialAnswers[q.id]));
    return firstOpen === -1 ? questions.length : firstOpen;
  });
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pending = useRef(new Map<string, RunnerAnswer>());
  const headingRef = useRef<HTMLDivElement>(null);

  const total = questions.length;
  const answeredCount = questions.filter((q) => isAnswered(q, answers[q.id])).length;
  const question = questions[index] as RunnerQuestion | undefined;

  const save = useCallback(
    async (questionId: string) => {
      const value = pending.current.get(questionId);
      if (!value) return;
      pending.current.delete(questionId);
      timers.current.delete(questionId);
      setSaving("saving");
      const { error: saveError } = await supabase.rpc("save_answer", {
        target_attempt: attemptId,
        target_question: questionId,
        selected: value.choice_ids,
        answer_text: value.text_answer,
      });
      setSaving(saveError ? "error" : "saved");
    },
    [attemptId, supabase],
  );

  const flush = useCallback(async () => {
    const ids = [...pending.current.keys()];
    for (const id of ids) clearTimeout(timers.current.get(id));
    await Promise.all(ids.map((id) => save(id)));
  }, [save]);

  useEffect(() => {
    const onLeave = () => void flush();
    window.addEventListener("pagehide", onLeave);
    return () => window.removeEventListener("pagehide", onLeave);
  }, [flush]);

  function update(questionId: string, next: RunnerAnswer, delay: number) {
    setAnswers((prev) => ({ ...prev, [questionId]: next }));
    pending.current.set(questionId, next);
    clearTimeout(timers.current.get(questionId));
    timers.current.set(questionId, setTimeout(() => void save(questionId), delay));
  }

  function go(next: number) {
    void flush();
    setConfirming(false);
    setIndex(Math.max(0, Math.min(total, next)));
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    await flush();
    const { error: submitError } = await supabase.rpc("submit_attempt", { target_attempt: attemptId });
    if (submitError) {
      setError(submitError.message === "closed" ? t("errors.closed") : t("errors.submitFailed"));
      setSubmitting(false);
      return;
    }
    router.refresh();
  }

  const savedNote = saving === "saving" ? t("saving") : saving === "error" ? t("saveFailed") : t("autosave");
  const kindNote = (q: RunnerQuestion) => t(`questionKinds.${q.kind}`);

  // --- pieces ---------------------------------------------------------------

  const optionList = (q: RunnerQuestion) => {
    const answer = answers[q.id] ?? empty;
    if (q.kind === "open") {
      return (
        <label className="flex flex-col gap-2">
          <span className="sr-only">{t("yourAnswer")}</span>
          <textarea
            rows={7}
            maxLength={8000}
            value={answer.text_answer}
            onChange={(e) => update(q.id, { ...answer, text_answer: e.target.value }, 800)}
            placeholder={t("openPlaceholder")}
            className="ui-field rounded-2xl px-4 py-3 leading-relaxed"
          />
        </label>
      );
    }
    const multiple = q.kind === "multiple";
    return q.choices.map((choice, i) => {
      const selected = answer.choice_ids.includes(choice.id);
      const toggle = () => {
        const next = multiple
          ? selected
            ? answer.choice_ids.filter((id) => id !== choice.id)
            : [...answer.choice_ids, choice.id]
          : [choice.id];
        update(q.id, { ...answer, choice_ids: next }, 150);
      };
      // iOS-style choice rows: a soft fill, a round radio (one answer) or check (several), teal when picked.
      return (
        <label key={choice.id} className={`flex min-h-14 cursor-pointer items-center gap-4 px-[18px] py-3 text-base leading-snug transition-colors has-focus-visible:outline-3 has-focus-visible:outline-th-link ${variant === "color" ? "rounded-[22px] font-medium" : "rounded-2xl"} ${selected ? "bg-th-tint-fill/15" : "bg-th-fill hover:bg-th-fill-2"}`}>
          <input type={multiple ? "checkbox" : "radio"} name={`q-${q.id}`} checked={selected} onChange={toggle} className={multiple ? "ui-check" : "ui-radio"} />
          <span className={variant === "color" ? "w-[18px] font-fun text-[17px] font-bold" : "w-[18px] font-display font-bold text-th-link"}>{choiceLetter(i)}</span>
          <span>{choice.label}</span>
        </label>
      );
    });
  };

  const legendClass =
    variant === "color"
      ? "mb-3.5 font-display text-[22px] leading-tight font-bold sm:text-[26px]"
      : "mb-[18px] font-display text-[26px] leading-tight font-semibold sm:text-[30px]";

  const questionBlock = question && (
    <fieldset className={`flex max-w-[780px] flex-col ${variant === "color" ? "gap-2.5" : "gap-3"}`}>
      <legend className={legendClass}>
        <span className="whitespace-pre-line">{question.prompt}</span>
      </legend>
      {optionList(question)}
    </fieldset>
  );

  const unanswered = questions.map((q, i) => ({ q, i })).filter(({ q }) => !isAnswered(q, answers[q.id]));

  const summaryBlock = (
    <div className="flex max-w-[780px] flex-col gap-4">
      <p className="font-display text-[26px] font-bold">{t("readyTitle")}</p>
      <p className="text-base leading-relaxed">{t("answeredOf", { answered: answeredCount, total })}</p>
      {unanswered.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm">{t("unansweredList")}</p>
          <div className="flex flex-wrap gap-2">
            {unanswered.map(({ i }) => (
              <button key={i} type="button" onClick={() => go(i)} className="ui-btn ui-gray ui-neutral ui-icon">
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}
      {error && <p role="alert" className="bg-vermilion/20 px-3 py-2 text-sm">{error}</p>}
    </div>
  );

  // The big footer buttons are the same iOS capsules in every theme.
  const buttons = {
    back: "ui-btn ui-gray ui-neutral ui-lg",
    next: "ui-btn ui-filled ui-lg ml-auto",
    note: `flex-[1_1_160px] text-[13px] ${variant === "color" ? "text-muted" : "text-th-muted"}`,
  };

  const footer = (
    <div className="flex max-w-[780px] flex-wrap items-center gap-3 pt-2">
      <button type="button" onClick={() => go(index - 1)} disabled={index === 0} className={buttons.back}>← {t("back")}</button>
      <span className={buttons.note} aria-live="polite">{variant === "color" ? `${closesLabel} · ${attemptLabel}` : savedNote}</span>
      {index < total ? (
        <button type="button" onClick={() => go(index + 1)} className={buttons.next}>
          {index === total - 1 ? t("toSummary") : variant === "color" ? t("next") : t("nextQuestion")} →
        </button>
      ) : confirming ? (
        <button type="button" onClick={() => void submit()} disabled={submitting} className={buttons.next}>
          {submitting ? t("submitting") : t("confirmSubmit")}
        </button>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className={buttons.next}>{t("submit")}</button>
      )}
    </div>
  );

  const stepLabel = question
    ? t("questionOf", { current: index + 1, total }) + ` · ${kindNote(question)}`
    : t("summaryStep", { total });

  // --- layouts --------------------------------------------------------------

  if (variant !== "color") {
    // Studio (dark and white)
    return (
      <div className="flex flex-col gap-[26px]">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0 flex-[1_1_320px]">
            {kicker && <p className="mb-2 text-[13px] text-th-link">_ {kicker}</p>}
            <h2 className="font-display text-[30px] font-bold">{title}</h2>
          </div>
          <div className="shrink-0 text-[13px] leading-relaxed text-th-soft sm:text-right">
            {closesLabel}
            <br />
            {attemptLabel} · {t("noTimeLimit")}
          </div>
        </div>
        <div>
          <div role="progressbar" aria-label={t("progress")} aria-valuemin={0} aria-valuemax={total} aria-valuenow={answeredCount} className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.max(total, 1)}, minmax(0, 1fr))` }}>
            {questions.map((q, i) => (
              <button key={q.id} type="button" onClick={() => go(i)} aria-label={t("goTo", { n: i + 1 })}
                className={`h-1.5 rounded-full ${i === index ? "bg-th-fg" : isAnswered(q, answers[q.id]) ? "bg-teal" : "bg-th-line"}`} />
            ))}
          </div>
          <div ref={headingRef} tabIndex={-1} className="mt-2.5 text-[13px] text-th-muted outline-none">{stepLabel}</div>
        </div>
        {question ? questionBlock : summaryBlock}
        {footer}
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-[28px] border-2 border-ink">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-ink bg-lavender px-[26px] py-5 text-white">
        <div>
          {kicker && <div className="text-[13px]">{t("kinds.quiz")} · {kicker}</div>}
          <h2 className="mt-1 font-display text-[26px] font-extrabold">{title}</h2>
        </div>
        <span className="font-fun text-[44px] leading-none font-bold">
          {Math.min(index + 1, total)}<span className="text-2xl">/{total}</span>
        </span>
      </div>
      <div className="flex flex-col gap-[18px] px-[26px] pt-6 pb-[26px]">
        <div role="progressbar" aria-label={t("progress")} aria-valuemin={0} aria-valuemax={total} aria-valuenow={answeredCount} className="flex flex-wrap gap-2">
          {questions.map((q, i) => (
            <button key={q.id} type="button" onClick={() => go(i)} aria-label={t("goTo", { n: i + 1 })}
              className={`size-[22px] rounded-full transition-colors ${i === index ? "bg-honey" : isAnswered(q, answers[q.id]) ? "bg-lime" : "bg-th-fill-2"}`} />
          ))}
        </div>
        <div ref={headingRef} tabIndex={-1} className="text-[13px] font-medium outline-none">{stepLabel}</div>
        {question ? questionBlock : summaryBlock}
        {footer}
        <span className="text-xs text-muted" aria-live="polite">{savedNote}</span>
      </div>
    </section>
  );
}
