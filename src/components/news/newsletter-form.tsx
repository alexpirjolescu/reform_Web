"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { subscribeNewsletter } from "@/app/actions/newsletter";
import type { ActionState } from "@/components/form";

/** NP-9. Class names come from each theme so the form matches its layout. */
export function NewsletterForm({
  labelClass,
  inputClass,
  buttonClass,
  messageClass = "",
}: {
  labelClass: string;
  inputClass: string;
  buttonClass: string;
  messageClass?: string;
}) {
  const t = useTranslations("news.newsletter");
  const [state, action, pending] = useActionState<ActionState, FormData>(subscribeNewsletter, {});

  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className={`flex flex-col gap-1.5 ${labelClass}`}>
          {t("email")}
          <input type="email" name="email" required autoComplete="email" placeholder="nume@exemplu.ro" className={inputClass} />
        </label>
        <button type="submit" disabled={pending} className={buttonClass}>
          {t("submit")}
        </button>
      </div>
      <p aria-live="polite" className={`text-sm ${messageClass}`}>
        {state.message ? t(state.message) : state.error ? t(state.error) : ""}
      </p>
    </form>
  );
}
