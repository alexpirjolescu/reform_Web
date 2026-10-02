import "server-only";
import { shortDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

/** Schools and meetings (news panel activities) to pick from in the assessment editor. */
export async function getEditorOptions(locale: string) {
  const supabase = await createClient();
  const [{ data: schools }, { data: activities }] = await Promise.all([
    supabase.from("schools").select("id, name").order("name"),
    supabase.from("activities").select("id, title, starts_at").order("starts_at", { ascending: false }).limit(100),
  ]);
  return {
    schools: schools ?? [],
    activities: (activities ?? []).map((a) => ({ id: a.id, title: a.title, date: shortDate(a.starts_at, locale) })),
  };
}

export function defaultWindow() {
  const now = new Date();
  now.setUTCSeconds(0, 0);
  const closes = new Date(now.getTime() + 7 * 86_400_000);
  closes.setUTCHours(20, 59, 0, 0);
  return { opens_at: now.toISOString(), closes_at: closes.toISOString() };
}
