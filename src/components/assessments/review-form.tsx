"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { reviewAttempt } from "@/app/app/assessments/actions";
import { Field, FormAlert, SubmitButton, TextAreaField, type ActionState } from "@/components/form";

export function ReviewForm({
  attemptId,
  assessmentId,
  openQuestions,
  isAssignment,
  maxScore,
  currentScore,
  feedback,
}: {
  attemptId: string;
  assessmentId: string;
  openQuestions: { id: string; n: number; points: number; awarded: number | null }[];
  isAssignment: boolean;
  maxScore: number | null;
  currentScore: number | null;
  feedback: string;
}) {
  const t = useTranslations();
  const [state, action] = useActionState<ActionState, FormData>(reviewAttempt, {});
  return (
    <form action={action} className="flex flex-col gap-4 rounded-th border-th bg-th-card p-5">
      <h2 className="font-display text-xl font-bold">{t("assessments.review.title")}</h2>
      <input type="hidden" name="attemptId" value={attemptId} />
      <input type="hidden" name="assessmentId" value={assessmentId} />
      {openQuestions.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {openQuestions.map((q) => (
            <Field key={q.id} id={`points-${q.id}`} name={`points:${q.id}`} type="number" min={0} max={q.points} step={0.5}
              defaultValue={q.awarded ?? ""} label={t("assessments.review.pointsFor", { n: q.n, max: q.points })} />
          ))}
        </div>
      )}
      <div className="max-w-xs">
        <Field id="review-score" name="score" type="number" min={0} step={0.5} defaultValue={isAssignment ? currentScore ?? "" : ""}
          label={isAssignment ? t("assessments.review.scoreOutOf", { max: maxScore ?? 10 }) : t("assessments.review.override")}
          hint={isAssignment ? undefined : t("assessments.review.overrideHint")} />
      </div>
      <TextAreaField id="review-feedback" name="feedback" rows={5} maxLength={8000} defaultValue={feedback} label={t("assessments.review.feedback")} />
      {state.error && <FormAlert tone="error">{t(state.error, state.errorValues)}</FormAlert>}
      {state.message && <FormAlert tone="success">{t(state.message)}</FormAlert>}
      <div><SubmitButton pendingLabel={t("common.sending")}>{t("assessments.review.save")}</SubmitButton></div>
    </form>
  );
}
