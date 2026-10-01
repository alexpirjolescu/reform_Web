"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Field, FormAlert, SubmitButton, type ActionState } from "@/components/form";
import { requestPasswordReset } from "../actions";

export function ForgotPasswordForm() {
  const t = useTranslations();
  const [state, action] = useActionState<ActionState, FormData>(requestPasswordReset, {});

  return (
    <form action={action} className="flex flex-col gap-5">
      {state.error && <FormAlert tone="error">{t(state.error)}</FormAlert>}
      {state.message && <FormAlert tone="success">{t(state.message)}</FormAlert>}
      <Field id="email" name="email" type="email" autoComplete="email" required label={t("auth.login.email")} />
      <SubmitButton pendingLabel={t("common.sending")}>{t("auth.forgot.submit")}</SubmitButton>
    </form>
  );
}
