import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Opens or downloads a library file through a short-lived signed URL, so links that people
 * copy (LIB-4) keep working only for accounts that can read the folder (RLS decides).
 */
export async function GET(request: Request, { params }: RouteContext<"/app/library/file/[id]">) {
  const { id } = await params;
  if (!uuid.test(id)) return new NextResponse(null, { status: 404 });

  const supabase = await createClient();
  const { data: file } = await supabase
    .from("library_files")
    .select("name, storage_path, external_url")
    .eq("id", id)
    .maybeSingle();
  if (!file) return new NextResponse(null, { status: 404 });
  if (file.external_url) return NextResponse.redirect(file.external_url);
  if (!file.storage_path) return new NextResponse(null, { status: 404 });

  const download = new URL(request.url).searchParams.get("download") === "1";
  const { data } = await supabase.storage
    .from("library")
    .createSignedUrl(file.storage_path, 60, download ? { download: file.name } : undefined);
  if (!data?.signedUrl) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
