"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Field, FormAlert, SubmitButton, inputClass, type ActionState } from "@/components/form";
import { appRoles, type AppRole, type School } from "@/lib/types";
import { createSchool, removeDemoContent, updateMember } from "./actions";

export function MemberForm({ id, role, schoolId, schools }: { id: string; role: AppRole; schoolId: string | null; schools: School[] }) {
  const t = useTranslations();
  const [state, action] = useActionState<ActionState, FormData>(updateMember, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <label className="flex flex-col gap-1 text-xs text-th-muted">
        {t("admin.users.role")}
        <select name="role" defaultValue={role} className={`${inputClass} min-h-11 text-sm`}>
          {appRoles.map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-th-muted">
        {t("admin.users.school")}
        <select name="schoolId" defaultValue={schoolId ?? ""} className={`${inputClass} min-h-11 text-sm`}>
          <option value="">{t("admin.users.noSchool")}</option>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <SubmitButton pendingLabel="…" className="min-h-11 rounded-th-pill border-th px-3 text-sm">{t("common.save")}</SubmitButton>
      {state.error && <span role="alert" className="text-xs text-vermilion">{t(state.error, state.errorValues)}</span>}
      {state.message && <span role="status" className="text-xs">{t(state.message)}</span>}
    </form>
  );
}

export function SchoolForm() {
  const t = useTranslations();
  const [state, action] = useActionState<ActionState, FormData>(createSchool, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.done) form.current?.reset();
  }, [state.done]);
  return (
    <form ref={form} action={action} className="grid gap-4 sm:grid-cols-[1fr_200px_auto] sm:items-end">
      <Field id="school-name" name="name" required minLength={2} maxLength={160} label={t("admin.schools.name")} />
      <Field id="school-city" name="city" maxLength={80} label={t("admin.schools.city")} />
      <SubmitButton pendingLabel={t("common.sending")}>{t("admin.schools.add")}</SubmitButton>
      {state.error && <div className="sm:col-span-3"><FormAlert tone="error">{t(state.error, state.errorValues)}</FormAlert></div>}
      {state.message && <div className="sm:col-span-3"><FormAlert tone="success">{t(state.message, state.messageValues)}</FormAlert></div>}
    </form>
  );
}

export function DemoCleanupForm() {
  const t = useTranslations();
  const [state, action] = useActionState<ActionState>(removeDemoContent, {});
  return (
    <form action={action} className="flex flex-col items-start gap-3">
      <p className="text-sm">{t("admin.demo.body")}</p>
      <SubmitButton pendingLabel={t("common.sending")}>{t("admin.demo.submit")}</SubmitButton>
      {state.error && <FormAlert tone="error">{t(state.error, state.errorValues)}</FormAlert>}
      {state.message && <FormAlert tone="success">{t(state.message, state.messageValues)}</FormAlert>}
    </form>
  );
}
