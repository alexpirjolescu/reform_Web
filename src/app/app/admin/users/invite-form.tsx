"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Field, FormAlert, SelectField, SubmitButton, type ActionState } from "@/components/form";
import { appRoles, type School } from "@/lib/types";
import { inviteUser } from "./actions";

export function InviteForm({ schools }: { schools: School[] }) {
  const t = useTranslations();
  const [state, action] = useActionState<ActionState, FormData>(inviteUser, {});

  return (
    <form action={action} className="grid gap-5 sm:grid-cols-2">
      {state.error && (
        <div className="sm:col-span-2">
          <FormAlert tone="error">{t(state.error, state.errorValues)}</FormAlert>
        </div>
      )}
      {state.message && (
        <div className="sm:col-span-2">
          <FormAlert tone="success">{t(state.message, state.messageValues)}</FormAlert>
        </div>
      )}
      <Field id="fullName" name="fullName" required minLength={2} label={t("admin.users.fullName")} />
      <Field id="email" name="email" type="email" required label={t("admin.users.email")} />
      <SelectField id="role" name="role" defaultValue="student" label={t("admin.users.role")}>
        {appRoles.map((role) => (
          <option key={role} value={role}>{t(`roles.${role}`)}</option>
        ))}
      </SelectField>
      <SelectField id="schoolId" name="schoolId" defaultValue="" label={t("admin.users.school")}>
        <option value="">{t("admin.users.noSchool")}</option>
        {schools.map((school) => (
          <option key={school.id} value={school.id}>{school.name}</option>
        ))}
      </SelectField>
      <div className="sm:col-span-2">
        <SubmitButton pendingLabel={t("common.sending")}>{t("admin.users.submit")}</SubmitButton>
      </div>
    </form>
  );
}
