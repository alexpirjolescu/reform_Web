"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/form";
import { requireAdmin } from "@/lib/auth";
import { siteUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { appRoles, isStaffRole } from "@/lib/types";

const inviteSchema = z
  .object({
    email: z.email().transform((v) => v.trim().toLowerCase()),
    fullName: z.string().trim().min(2).max(120),
    role: z.enum(appRoles),
    schoolId: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
  })
  // Same rule as the profiles_students_have_a_school constraint in the database.
  .refine((v) => isStaffRole(v.role) || v.schoolId !== null, { path: ["schoolId"] });

/** Invite one person (PRD: staff create every account; no public sign-up). Admins only. */
export async function inviteUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "admin.users.errors.invalidInput" };
  const { email, fullName, role, schoolId } = parsed.data;

  const supabase = createAdminClient();

  // The invite email links to /auth/confirm (supabase/templates/invite.html), then to /auth/set-password.
  const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${siteUrl}/auth/set-password`,
  });
  if (inviteError || !invited.user) {
    return { error: "admin.users.errors.inviteFailed", errorValues: { detail: inviteError?.message ?? "unknown" } };
  }

  const userId = invited.user.id;
  const { error: profileError } = await supabase
    .from("profiles")
    .insert({ id: userId, full_name: fullName, role, school_id: isStaffRole(role) ? null : schoolId });

  if (profileError) {
    // Don't leave an account without a profile behind.
    await supabase.auth.admin.deleteUser(userId);
    return { error: "admin.users.errors.profileFailed", errorValues: { detail: profileError.message } };
  }

  await supabase.from("audit_log").insert({
    actor_id: admin.id,
    action: "user.invited",
    target_type: "user",
    target_id: userId,
    details: { role, school_id: schoolId },
  });

  revalidatePath("/app/admin/users");
  return { message: "admin.users.sent", messageValues: { email } };
}

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
