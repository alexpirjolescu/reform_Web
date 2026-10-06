"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Field, FormAlert, SelectField, buttonClass, ghostButtonClass, type ActionState } from "@/components/form";
import type { AppRole, School } from "@/lib/types";
import { cancelInvite, newInviteLink, resendInvite, sendInvite } from "./actions";

/** A one-time link with a copy button (the link is also selectable, for phones without clipboard access). */
export function CopyLink({ link }: { link: string }) {
  const t = useTranslations("admin.invites");
  const [copied, setCopied] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      input.current?.select();
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-th border-th bg-th-raised p-3">
      <label htmlFor={id} className="text-sm font-medium">{t("linkLabel")}</label>
      <div className="flex flex-wrap gap-2">
        <input
          ref={input}
          id={id}
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="min-h-11 min-w-0 flex-1 rounded-th border-th bg-th-card px-3 font-mono text-xs text-th-fg"
        />
        <button type="button" onClick={copy} className={ghostButtonClass}>
          {copied ? t("copied") : t("copy")}
        </button>
      </div>
      <p className="text-xs text-th-muted">{t("linkHint")}</p>
    </div>
  );
}

function Result({ state }: { state: ActionState }) {
  const t = useTranslations();
  if (state.error) return <FormAlert tone="error">{t(state.error, state.errorValues)}</FormAlert>;
  if (!state.message) return null;
  return (
    <div className="flex flex-col gap-3">
      <FormAlert tone="success">{t(state.message, state.messageValues)}</FormAlert>
      {state.link && <CopyLink link={state.link} />}
    </div>
  );
}

export function InviteForm({ schools, roles }: { schools: School[]; roles: readonly AppRole[] }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState<ActionState, FormData>(sendInvite, {});
  const [role, setRole] = useState<AppRole>("student");
  const form = useRef<HTMLFormElement>(null);
  const needsSchool = role === "student" || role === "core_lead";

  useEffect(() => {
    if (state.done) form.current?.reset();
  }, [state.done]);

  return (
    <form ref={form} action={action} className="grid gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Result state={state} />
      </div>
      <Field id="fullName" name="fullName" required minLength={2} maxLength={120} autoComplete="off" label={t("admin.users.fullName")} />
      <Field id="email" name="email" type="email" required autoComplete="off" label={t("admin.users.email")} />
      <SelectField id="role" name="role" value={role} onChange={(e) => setRole(e.target.value as AppRole)} label={t("admin.users.role")}>
        {roles.map((r) => (
          <option key={r} value={r}>{t(`roles.${r}`)}</option>
        ))}
      </SelectField>
      <SelectField id="schoolId" name="schoolId" defaultValue="" required={needsSchool} label={t("admin.users.school")}>
        <option value="">{needsSchool ? t("admin.invites.pickSchool") : t("admin.users.noSchool")}</option>
        {schools.map((school) => (
          <option key={school.id} value={school.id}>{school.name}</option>
        ))}
      </SelectField>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" name="delivery" value="link" disabled={pending} className={buttonClass}>
          {pending ? t("common.sending") : t("admin.invites.createLink")}
        </button>
        <button type="submit" name="delivery" value="email" disabled={pending} className={ghostButtonClass}>
          {t("admin.invites.sendEmail")}
        </button>
      </div>
      <p className="text-xs text-th-muted sm:col-span-2">{t("admin.invites.deliveryHint")}</p>
    </form>
  );
}

/** Actions on one open invitation: a fresh link, the email again, or withdraw it. */
export function PendingActions({ id, email }: { id: string; email: string }) {
  const t = useTranslations();
  const [linkState, linkAction, linkPending] = useActionState<ActionState, FormData>(newInviteLink, {});
  const [mailState, mailAction, mailPending] = useActionState<ActionState, FormData>(resendInvite, {});
  const [cancelState, cancelAction, cancelPending] = useActionState<ActionState, FormData>(cancelInvite, {});
  const [confirming, setConfirming] = useState(false);
  const small = "min-h-11 text-sm text-th-link underline underline-offset-4 disabled:opacity-60";
  const latest = [linkState, mailState, cancelState].sort((a, b) => (b.done ?? 0) - (a.done ?? 0))[0];
  const error = linkState.error ?? mailState.error ?? cancelState.error;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-4">
        <form action={linkAction}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" disabled={linkPending} className={small}>{t("admin.invites.newLink")}</button>
        </form>
        <form action={mailAction}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" disabled={mailPending} className={small}>{t("admin.invites.resend")}</button>
        </form>
        {confirming ? (
          <form action={cancelAction} className="flex items-center gap-2">
            <input type="hidden" name="id" value={id} />
            <button type="submit" disabled={cancelPending} className="min-h-11 text-sm font-medium text-vermilion underline underline-offset-4">
              {t("admin.invites.cancelConfirm", { email })}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="min-h-11 text-sm text-th-muted">{t("admin.invites.keep")}</button>
          </form>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className="min-h-11 text-sm text-th-muted underline underline-offset-4">
            {t("admin.invites.cancel")}
          </button>
        )}
      </div>
      {error && <FormAlert tone="error">{t(error, (linkState.errorValues ?? mailState.errorValues ?? cancelState.errorValues))}</FormAlert>}
      {!error && latest.message && latest !== cancelState && <FormAlert tone="success">{t(latest.message, latest.messageValues)}</FormAlert>}
      {!error && latest === linkState && linkState.link && <CopyLink link={linkState.link} />}
    </div>
  );
}
