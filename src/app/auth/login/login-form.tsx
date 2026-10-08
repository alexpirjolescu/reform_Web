"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Field, FormAlert, SubmitButton, buttonClass, type ActionState } from "@/components/form";
import { signIn } from "../actions";

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations();
  const [state, action] = useActionState<ActionState, FormData>(signIn, {});

  return (
    <form action={action} className="flex flex-col gap-5">
      {state.error && <FormAlert tone="error">{t(state.error)}</FormAlert>}
      <Field id="email" name="email" type="email" autoComplete="email" required label={t("auth.login.email")} />
      <Field
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        label={t("auth.login.password")}
      />
      {next && <input type="hidden" name="next" value={next} />}
      <SubmitButton pendingLabel={t("common.sending")} className={`${buttonClass} ui-lg`}>{t("auth.login.submit")}</SubmitButton>
    </form>
  );
}
