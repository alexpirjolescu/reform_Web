import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export type Session =
  | { status: "signed-out" }
  | { status: "no-profile"; userId: string }
  | { status: "deactivated"; userId: string; profile: Profile }
  | { status: "active"; userId: string; profile: Profile };

const profileColumns = "id, full_name, role, school_id, graduation_year, avatar_path, locale, deactivated_at";

/** The signed-in user and their profile, read once per request. */
export const getSession = cache(async (): Promise<Session> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return { status: "signed-out" };

  const { data: profile } = await supabase
    .from("profiles")
    .select(profileColumns)
    .eq("id", userId)
    .maybeSingle<Profile>();

  if (!profile) return { status: "no-profile", userId };
  if (profile.deactivated_at) return { status: "deactivated", userId, profile };
  return { status: "active", userId, profile };
});

/** For pages and actions in the private area: an active account, or a redirect to log in. */
export async function requireProfile() {
  const session = await getSession();
  if (session.status === "signed-out") redirect("/auth/login");
  if (session.status !== "active") redirect("/auth/blocked");
  return session.profile;
}

/** For admin-only pages and actions. Always call it before using the service-role client. */
export async function requireAdmin() {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect("/app");
  return profile;
}

/** Only allow redirects to paths on this site (no //evil.com, no absolute URLs). */
export function safeNextPath(next: unknown, fallback = "/app") {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
