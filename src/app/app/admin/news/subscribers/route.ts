import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Newsletter subscribers as CSV, for admins (RLS: admins read). */
export async function GET() {
  const session = await getSession();
  if (session.status !== "active" || session.profile.role !== "admin") return new NextResponse(null, { status: 403 });
  const supabase = await createClient();
  const { data } = await supabase.from("newsletter_subscribers").select("email, locale, created_at").order("created_at");
  const rows = ["email,locale,subscribed_at", ...(data ?? []).map((r) => `"${r.email.replaceAll('"', '""')}",${r.locale},${r.created_at}`)];
  return new NextResponse(`${rows.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="re_form-newsletter.csv"',
      "Cache-Control": "no-store",
    },
  });
}
