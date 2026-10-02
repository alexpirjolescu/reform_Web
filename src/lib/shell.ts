import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isStaffRole, type Profile } from "@/lib/types";

export type ShellData = {
  profile: Profile;
  schoolName: string | null;
  isStaff: boolean;
  isAdmin: boolean;
  unreadMessages: number;
  assessmentsBadge: number;
  openReports: number;
};

/** What every private page's shell shows: school, badges for messages and assessments. */
export async function getShellData(profile: Profile): Promise<ShellData> {
  const supabase = await createClient();
  const isStaff = isStaffRole(profile.role);
  const now = new Date().toISOString();

  const studentBadge = async () => {
    const [{ data: open }, { data: mine }] = await Promise.all([
      supabase.from("assessments").select("id").eq("status", "published").lte("opens_at", now).gt("closes_at", now),
      supabase.from("attempts").select("assessment_id, status").eq("student_id", profile.id),
    ]);
    const finished = new Set((mine ?? []).filter((a) => a.status !== "in_progress").map((a) => a.assessment_id));
    return (open ?? []).filter((a) => !finished.has(a.id)).length;
  };
  // Staff see how many submissions wait for review; students how many open assessments they haven't handed in.
  const staffBadge = async () => {
    const { count } = await supabase.from("attempts").select("id", { count: "exact", head: true }).eq("status", "submitted");
    return count ?? 0;
  };

  const [school, unread, assessmentsBadge, reports] = await Promise.all([
    profile.school_id
      ? supabase.from("schools").select("name").eq("id", profile.school_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.rpc("unread_counts"),
    isStaff ? staffBadge() : studentBadge(),
    profile.role === "admin"
      ? supabase.from("message_reports").select("id", { count: "exact", head: true }).eq("status", "open")
      : Promise.resolve({ count: 0 }),
  ]);

  const unreadMessages = (unread.data ?? []).reduce((sum, row) => sum + Number(row.unread), 0);

  return {
    profile,
    schoolName: school.data?.name ?? null,
    isStaff,
    isAdmin: profile.role === "admin",
    unreadMessages,
    assessmentsBadge,
    openReports: ("count" in reports && reports.count) || 0,
  };
}
