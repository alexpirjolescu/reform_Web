import "server-only";
import { supabaseUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const mediaBase = `${supabaseUrl}/storage/v1/object/public/media`;

export async function getSchools() {
  const supabase = await createClient();
  const { data } = await supabase.from("schools").select("id, name").order("name");
  return data ?? [];
}

/** Next Saturday at 10:00 (Romanian time), a sensible default for a new activity. */
export function defaultStart() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + ((6 - date.getUTCDay() + 7) % 7 || 7));
  date.setUTCHours(7, 0, 0, 0);
  return date.toISOString();
}
