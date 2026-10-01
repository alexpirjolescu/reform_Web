"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/form";
import { requireAdmin } from "@/lib/auth";
import { siteUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
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
