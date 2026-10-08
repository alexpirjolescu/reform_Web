"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Field, FormAlert, SubmitButton, buttonClass, type ActionState } from "@/components/form";
import { setPassword } from "../actions";

export function SetPasswordForm() {
  const t = useTranslations();
  const [state, action] = useActionState<ActionState, FormData>(setPassword, {});

  return (
    <form action={action} className="flex flex-col gap-5">
      {state.error && <FormAlert tone="error">{t(state.error)}</FormAlert>}
      <Field
        id="password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={10}
        required
        label={t("auth.setPassword.password")}
      />
      <Field
        id="confirm"
        name="confirm"
        type="password"
        autoComplete="new-password"
        minLength={10}
        required
        label={t("auth.setPassword.confirm")}
      />
      <SubmitButton pendingLabel={t("common.sending")} className={`${buttonClass} ui-lg`}>{t("auth.setPassword.submit")}</SubmitButton>
    </form>
  );
}
