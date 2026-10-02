"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Field, FormAlert, SelectField, SubmitButton, TextAreaField, type ActionState } from "@/components/form";
import type { School } from "@/lib/types";
import { createBoard } from "./actions";

export function NewBoardForm({ schools }: { schools: School[] | null }) {
  const t = useTranslations();
  const [state, action] = useActionState<ActionState, FormData>(createBoard, {});

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field id="board-name" name="name" label={t("workspace.boardName")} required minLength={2} maxLength={120} placeholder={t("workspace.boardNamePlaceholder")} />
      </div>
      <div className="sm:col-span-2">
        <TextAreaField id="board-description" name="description" label={t("workspace.boardDescription")} rows={3} maxLength={2000} />
      </div>
      <Field id="board-due" name="dueDate" type="date" label={t("workspace.boardDue")} />
      {schools && (
        <SelectField id="board-school" name="schoolId" label={t("workspace.school")} required defaultValue="">
          <option value="" disabled>{t("workspace.pickSchool")}</option>
          {schools.map((school) => (
            <option key={school.id} value={school.id}>{school.name}</option>
          ))}
        </SelectField>
      )}
      {state.error && (
        <div className="sm:col-span-2">
          <FormAlert tone="error">{t(state.error)}</FormAlert>
        </div>
      )}
      <div className="sm:col-span-2">
        <SubmitButton pendingLabel={t("common.sending")}>{t("workspace.createBoard")}</SubmitButton>
      </div>
    </form>
  );
}
