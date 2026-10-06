"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/form";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { appRoles, isStaffRole } from "@/lib/types";

// Invitations live in ../invites/actions.ts (staff and admins).

const memberSchema = z
  .object({
    id: z.uuid(),
    role: z.enum(appRoles),
    schoolId: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
  })
  .refine((v) => isStaffRole(v.role) || v.schoolId !== null);

/** Change someone's role or school (e.g. a student becomes core lead, or moves school). Admins only. */
export async function updateMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = memberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "admin.users.errors.invalidInput" };
  const { id, role, schoolId } = parsed.data;
  if (id === admin.id && role !== "admin") return { error: "admin.users.errors.selfDemote" };

  const supabase = createAdminClient();
  const { error } = await supabase.from("profiles").update({ role, school_id: isStaffRole(role) ? null : schoolId }).eq("id", id);
  if (error) return { error: "admin.users.errors.profileFailed", errorValues: { detail: error.message } };
  await supabase.from("audit_log").insert({ actor_id: admin.id, action: "user.updated", target_type: "user", target_id: id, details: { role, school_id: schoolId } });
  revalidatePath("/app/admin/users");
  return { message: "admin.users.updated" };
}

/** Deactivate (graduated, left) or reactivate an account. Deactivated accounts also can't log in. */
export async function setActive(formData: FormData) {
  const admin = await requireAdmin();
  const id = z.uuid().safeParse(formData.get("id"));
  const active = formData.get("active") === "1";
  if (!id.success || id.data === admin.id) return;

  const supabase = createAdminClient();
  await supabase.from("profiles").update({ deactivated_at: active ? null : new Date().toISOString() }).eq("id", id.data);
  await supabase.auth.admin.updateUserById(id.data, { ban_duration: active ? "none" : "876000h" });
  await supabase.from("audit_log").insert({
    actor_id: admin.id,
    action: active ? "user.reactivated" : "user.deactivated",
    target_type: "user",
    target_id: id.data,
  });
  revalidatePath("/app/admin/users");
}

const schoolSchema = z.object({
  name: z.string().trim().min(2).max(160),
  city: z.string().trim().max(80).default(""),
});

/** Partner high schools (they appear on the public panel and in every school picker). */
export async function createSchool(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = schoolSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "admin.schools.errors.invalid" };
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("schools")
    .insert({ name: parsed.data.name, city: parsed.data.city || null })
    .select("id")
    .single();
  if (error) return { error: "admin.schools.errors.failed", errorValues: { detail: error.message } };
  await supabase.from("audit_log").insert({ actor_id: admin.id, action: "school.created", target_type: "school", target_id: data.id });
  revalidatePath("/app/admin/users");
  return { message: "admin.schools.created", messageValues: { name: parsed.data.name }, done: Date.now() };
}

/** Removes everything marked as demo content (supabase/demo.sql). */
export async function removeDemoContent(): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("remove_demo_content");
  if (error) return { error: "admin.demo.failed", errorValues: { detail: error.message } };
  revalidatePath("/", "layout");
  const counts = (data ?? {}) as Record<string, number>;
  return {
    message: "admin.demo.removed",
    messageValues: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, String(v)])),
  };
}
