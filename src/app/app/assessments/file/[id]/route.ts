import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Opens a handed-in file for its owner or staff (RLS on submission_files and storage decides). */
export async function GET(_request: Request, { params }: RouteContext<"/app/assessments/file/[id]">) {
  const { id } = await params;
  if (!uuid.test(id)) return new NextResponse(null, { status: 404 });
  const supabase = await createClient();
  const { data: file } = await supabase.from("submission_files").select("name, storage_path").eq("id", id).maybeSingle();
  if (!file) return new NextResponse(null, { status: 404 });
  const { data } = await supabase.storage.from("submissions").createSignedUrl(file.storage_path, 60, { download: file.name });
  if (!data?.signedUrl) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
