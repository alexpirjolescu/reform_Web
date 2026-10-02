"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import type { ActionState } from "@/components/form";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isStaffRole } from "@/lib/types";

const boardSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).default(""),
  dueDate: z.union([z.iso.date(), z.literal("")]).transform((v) => v || null),
  schoolId: z.union([z.uuid(), z.literal("")]).optional(),
});

/** New project board with the four default columns (PRD WS-1). Core leads for their school, staff for any. */
export async function createBoard(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireProfile();
  const parsed = boardSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "workspace.errors.invalidBoard" };

  const schoolId = isStaffRole(profile.role) ? parsed.data.schoolId || null : profile.school_id;
  if (!schoolId) return { error: "workspace.errors.pickSchool" };

  const supabase = await createClient();
  const { data: board, error } = await supabase
    .from("boards")
    .insert({
      name: parsed.data.name,
      description: parsed.data.description,
      due_date: parsed.data.dueDate,
      school_id: schoolId,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error || !board) return { error: "workspace.errors.createFailed" };

  const t = await getTranslations("workspace.defaultColumns");
  // Every row lists every column: in a bulk insert, a missing key would be sent as null.
  const { error: columnsError } = await supabase.from("board_columns").insert([
    { board_id: board.id, name: t("todo"), position: 1, is_done: false },
    { board_id: board.id, name: t("doing"), position: 2, is_done: false },
    { board_id: board.id, name: t("review"), position: 3, is_done: false },
    { board_id: board.id, name: t("done"), position: 4, is_done: true },
  ]);
  if (columnsError) console.error("default columns", columnsError.message);

  revalidatePath("/app/workspace");
  redirect(`/app/workspace/${board.id}`);
}

/** Archive a finished project; it disappears from the list but nothing is deleted. */
export async function archiveBoard(formData: FormData) {
  await requireProfile();
  const id = z.uuid().safeParse(formData.get("boardId"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from("boards").update({ archived_at: new Date().toISOString() }).eq("id", id.data);
  revalidatePath("/app/workspace");
}
