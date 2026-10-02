import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Empties the library trash: files deleted more than 30 days ago are removed for good (LIB-6).
 * Vercel Cron calls it daily (vercel.json) with "Authorization: Bearer <CRON_SECRET>".
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse(null, { status: 401 });
  }

  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: expired, error } = await supabase
    .from("library_files")
    .select("id, storage_path")
    .not("deleted_at", "is", null)
    .lt("deleted_at", cutoff)
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!expired?.length) return NextResponse.json({ purged: 0 });

  const paths = expired.map((file) => file.storage_path).filter((path): path is string => Boolean(path));
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from("library").remove(paths);
    if (storageError) return NextResponse.json({ error: storageError.message }, { status: 500 });
  }
  const ids = expired.map((file) => file.id);
  await supabase.from("library_files").delete().in("id", ids);
  await supabase.from("audit_log").insert({ action: "library.trash_purged", target_type: "library_files", details: { count: ids.length } });
  return NextResponse.json({ purged: ids.length });
}
