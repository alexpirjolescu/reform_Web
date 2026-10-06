import "server-only";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { appRoles, type AppRole, type Profile } from "@/lib/types";

/**
 * Invitations (PRD: no public sign-up; the re_form team creates every account).
 *
 * Who may invite whom: admins invite anyone; staff invite students, core leads and other staff,
 * but never admins, and can't touch an admin's pending invitation.
 *
 * Two ways to deliver an invitation:
 * - "email": Supabase sends its invite email (needs Site URL and redirect URLs set in Supabase
 *   and, for more than a few emails an hour, a custom SMTP server);
 * - "link": we generate the same one-time link without sending anything, and the inviter shares it
 *   (WhatsApp, their own email). It always points to this site, whatever Supabase's settings say.
 */
export function invitableRoles(actorRole: AppRole): readonly AppRole[] {
  return actorRole === "admin" ? appRoles : appRoles.filter((role) => role !== "admin");
}

export function canManageInviteFor(actorRole: AppRole, targetRole: AppRole | null) {
  return actorRole === "admin" || targetRole !== "admin";
}

/**
 * The link people open: a small page with an "accept" button. Verifying on a button press, not on
 * page load, keeps link previews (WhatsApp, Outlook Safe Links) from using up the one-time token.
 */
export function acceptUrl(siteUrl: string, tokenHash: string, type: "invite" | "recovery") {
  const params = new URLSearchParams({ token_hash: tokenHash, type });
  return `${siteUrl}/auth/accept?${params}`;
}

/** Every auth user, page by page (a school academy has hundreds, not millions). */
export async function listAuthUsers() {
  const admin = createAdminClient();
  const users: User[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return users;
}

export async function findAuthUserByEmail(email: string) {
  const wanted = email.trim().toLowerCase();
  return (await listAuthUsers()).find((user) => user.email?.toLowerCase() === wanted) ?? null;
}

/** Invited but never logged in: the invitation is still open. */
export function isPending(user: User) {
  return !user.last_sign_in_at;
}

export type PendingInvite = {
  id: string;
  email: string;
  invitedAt: string | null;
  profile: Pick<Profile, "full_name" | "role" | "school_id"> | null;
  schoolName: string | null;
};

/** Open invitations, newest first, with the profile each one will get (null if made outside the app). */
export async function listPendingInvites(): Promise<PendingInvite[]> {
  const admin = createAdminClient();
  const pending = (await listAuthUsers()).filter(isPending);
  if (!pending.length) return [];

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, role, school_id, school:schools(name)")
    .overrideTypes<{ id: string; full_name: string; role: AppRole; school_id: string | null; school: { name: string } | null }[], { merge: false }>();
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  return pending
    .map((user) => {
      const p = byId.get(user.id);
      return {
        id: user.id,
        email: user.email ?? "",
        invitedAt: user.invited_at ?? user.created_at ?? null,
        profile: p ? { full_name: p.full_name, role: p.role, school_id: p.school_id } : null,
        schoolName: p?.school?.name ?? null,
      };
    })
    .sort((a, b) => (b.invitedAt ?? "").localeCompare(a.invitedAt ?? ""));
}

/** Accounts that can log in but have no profile (e.g. invited from the Supabase dashboard). They see "blocked". */
export async function listAccountsWithoutProfile() {
  const admin = createAdminClient();
  const active = (await listAuthUsers()).filter((user) => !isPending(user));
  if (!active.length) return [];
  const { data } = await admin.from("profiles").select("id");
  const known = new Set((data ?? []).map((p) => p.id));
  return active.filter((user) => !known.has(user.id)).map((user) => ({ id: user.id, email: user.email ?? "" }));
}
