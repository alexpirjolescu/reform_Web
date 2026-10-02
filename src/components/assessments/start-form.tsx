"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { startAttempt } from "@/app/app/assessments/actions";
import { SubmitButton, type ActionState } from "@/components/form";

export function StartForm({ assessmentId, label, className }: { assessmentId: string; label: string; className: string }) {
  const t = useTranslations();
  const [state, action] = useActionState<ActionState, FormData>(startAttempt, {});
  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <input type="hidden" name="assessmentId" value={assessmentId} />
      <SubmitButton pendingLabel={t("assessments.starting")} className={className}>{label}</SubmitButton>
      {state.error && <p role="alert" className="text-sm text-vermilion">{t(state.error)}</p>}
    </form>
  );
}
