"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/form";
import { requireStaff } from "@/lib/auth";
import { acceptUrl, canManageInviteFor, findAuthUserByEmail, invitableRoles, isPending } from "@/lib/invites";
import { getSiteUrl } from "@/lib/site-url";
import type { Json } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { appRoles, isStaffRole, type AppRole, type Profile } from "@/lib/types";

const inviteSchema = z
  .object({
    email: z.email().transform((v) => v.trim().toLowerCase()),
    fullName: z.string().trim().min(2).max(120),
    role: z.enum(appRoles),
    schoolId: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
    delivery: z.enum(["email", "link"]),
  })
  // Same rule as the profiles_students_have_a_school constraint in the database.
  .refine((v) => isStaffRole(v.role) || v.schoolId !== null, { path: ["schoolId"] });

const fail = (key: string, detail?: string): ActionState => ({
  error: `admin.invites.errors.${key}`,
  errorValues: detail ? { detail } : undefined,
});

async function audit(actorId: string, action: string, targetId: string, details: { [key: string]: Json | undefined } = {}) {
  await createAdminClient().from("audit_log").insert({ actor_id: actorId, action, target_type: "user", target_id: targetId, details });
}

/**
 * Invite someone by email or by a link to copy. Staff and admins.
 * - new email: creates the account (Supabase auth user + profile);
 * - open invitation for that email: updates the profile and sends a fresh email or link (old links stop working);
 * - account that logs in but has no profile (made in the Supabase dashboard): adds the profile and
 *   sends a "choose a password" link;
 * - active account: refused.
 */
export async function sendInvite(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireStaff();
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("invalidInput");
  const { email, fullName, role, schoolId, delivery } = parsed.data;
  if (!invitableRoles(actor.role).includes(role)) return fail("roleNotAllowed");

  const admin = createAdminClient();
  const siteUrl = await getSiteUrl();
  const profile = { full_name: fullName, role, school_id: isStaffRole(role) ? null : schoolId };
  const existing = await findAuthUserByEmail(email);

  if (existing) {
    const { data: current } = await admin.from("profiles").select("role").eq("id", existing.id).maybeSingle<Pick<Profile, "role">>();
    if (!canManageInviteFor(actor.role, current?.role ?? null)) return fail("roleNotAllowed");
    if (!isPending(existing) && current) return fail("alreadyActive", email);

    const { error: profileError } = await admin.from("profiles").upsert({ id: existing.id, ...profile });
    if (profileError) return fail("profileFailed", profileError.message);

    // Logged in before, so it needs a password reset rather than an invitation.
    const type = isPending(existing) ? "invite" : "recovery";
    const result = await deliver(email, fullName, delivery, type, siteUrl);
    if (!result.ok) return result.state;
    await audit(actor.id, "user.reinvited", existing.id, { role, school_id: schoolId, delivery });
    revalidatePath("/app/admin", "layout");
    return toState(result);
  }

  const created = await deliver(email, fullName, delivery, "invite", siteUrl);
  if (!created.ok) return created.state;
  const userId = created.userId;
  const { error: profileError } = await admin.from("profiles").insert({ id: userId, ...profile });
  if (profileError) {
    // Don't leave an account without a profile behind.
    await admin.auth.admin.deleteUser(userId);
    return fail("profileFailed", profileError.message);
  }

  await audit(actor.id, "user.invited", userId, { role, school_id: schoolId, delivery });
  revalidatePath("/app/admin", "layout");
  return toState(created);
}

function toState(result: Extract<Delivered, { ok: true }>): ActionState {
  return { message: result.message, messageValues: result.messageValues, link: result.link, done: Date.now() };
}

type Delivered =
  | { ok: true; userId: string; link?: string; message: string; messageValues: Record<string, string> }
  | { ok: false; state: ActionState };

async function deliver(
  email: string,
  fullName: string,
  delivery: "email" | "link",
  type: "invite" | "recovery",
  siteUrl: string,
): Promise<Delivered> {
  const admin = createAdminClient();
  const data = { full_name: fullName };

  if (delivery === "link") {
    const { data: link, error } = await admin.auth.admin.generateLink(
      type === "invite" ? { type, email, options: { data } } : { type, email },
    );
    if (error || !link.user) return { ok: false, state: fail("inviteFailed", error?.message ?? "unknown") };
    return {
      ok: true,
      userId: link.user.id,
      link: acceptUrl(siteUrl, link.properties.hashed_token, type),
      message: "admin.invites.linkReady",
      messageValues: { email },
    };
  }

  if (type === "invite") {
    const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data,
      redirectTo: `${siteUrl}/auth/set-password`,
    });
    if (error || !invited.user) return { ok: false, state: fail("inviteFailed", error?.message ?? "unknown") };
    return { ok: true, userId: invited.user.id, message: "admin.invites.emailSent", messageValues: { email } };
  }

  const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl}/auth/confirm?next=/auth/set-password` });
  if (error) return { ok: false, state: fail("inviteFailed", error.message) };
  const user = await findAuthUserByEmail(email);
  return { ok: true, userId: user?.id ?? "", message: "admin.invites.emailSent", messageValues: { email } };
}

/** The open invitation behind one row of the list, if the caller may act on it. */
async function pendingInvite(formData: FormData) {
  const actor = await requireStaff();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { actor, error: fail("invalidInput") };
  const admin = createAdminClient();
  const [{ data: found }, { data: current }] = await Promise.all([
    admin.auth.admin.getUserById(id.data),
    admin.from("profiles").select("full_name, role").eq("id", id.data).maybeSingle<Pick<Profile, "full_name" | "role">>(),
  ]);
  const user = found?.user;
  if (!user?.email || !isPending(user)) return { actor, error: fail("notPending") };
  if (!canManageInviteFor(actor.role, (current?.role as AppRole | undefined) ?? null)) return { actor, error: fail("roleNotAllowed") };
  return { actor, user, fullName: current?.full_name ?? "" };
}

/** A fresh link for an open invitation (the previous link stops working). */
export async function newInviteLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const found = await pendingInvite(formData);
  if (found.error) return found.error;
  const result = await deliver(found.user.email!, found.fullName, "link", "invite", await getSiteUrl());
  if (!result.ok) return result.state;
  await audit(found.actor.id, "user.invite_link", found.user.id);
  return toState(result);
}

/** Send the invitation email again. */
export async function resendInvite(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const found = await pendingInvite(formData);
  if (found.error) return found.error;
  const result = await deliver(found.user.email!, found.fullName, "email", "invite", await getSiteUrl());
  if (!result.ok) return result.state;
  await audit(found.actor.id, "user.invite_resent", found.user.id);
  return toState(result);
}

/** Withdraw an open invitation (typo in the email, wrong person). Only accounts that never logged in. */
export async function cancelInvite(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const found = await pendingInvite(formData);
  if (found.error) return found.error;
  const { error } = await createAdminClient().auth.admin.deleteUser(found.user.id);
  if (error) return fail("inviteFailed", error.message);
  await audit(found.actor.id, "user.invite_cancelled", found.user.id, { email: found.user.email });
  revalidatePath("/app/admin", "layout");
  return { message: "admin.invites.cancelled", messageValues: { email: found.user.email! }, done: Date.now() };
}
