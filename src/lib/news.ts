import "server-only";
import { isStoredLayout } from "@/lib/article";
import type { EmbedProvider, MediaKind } from "@/lib/media";
import { createClient } from "@/lib/supabase/server";
import { activityCategories, type ActivityCategory } from "@/lib/types";

export const categoryColor: Record<ActivityCategory, string> = {
  workshop: "#79569a",
  meeting: "#e28ba3",
  event: "#dd6937",
  showcase: "#abca54",
};

/** Text colour that reads on each category fill. */
export const categoryInk: Record<ActivityCategory, string> = {
  workshop: "#ffffff",
  meeting: "#221f20",
  event: "#221f20",
  showcase: "#221f20",
};

export type ActivityCard = {
  id: string;
  title: string;
  summary: string;
  category: ActivityCategory;
  startsAt: string;
  endsAt: string | null;
  location: string;
  coverUrl: string | null;
  schools: { id: string; name: string }[];
  isDemo: boolean;
};

export type NewsFilters = { category?: ActivityCategory; schoolId?: string; q?: string };

export function parseFilters(params: Record<string, string | string[] | undefined>): NewsFilters {
  const pick = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);
  const category = pick("type");
  return {
    category: activityCategories.includes(category as ActivityCategory) ? (category as ActivityCategory) : undefined,
    schoolId: pick("school") || undefined,
    q: pick("q")?.trim().slice(0, 80) || undefined,
  };
}

const selectColumns =
  "id, title, summary, category, starts_at, ends_at, location, cover_path, is_demo, activity_schools(school_id, schools(id, name))";

type Raw = {
  id: string;
  title: string;
  summary: string;
  category: ActivityCategory;
  starts_at: string;
  ends_at: string | null;
  location: string;
  cover_path: string | null;
  is_demo: boolean;
  activity_schools: { school_id: string; schools: { id: string; name: string } | null }[];
};

export async function listActivities(when: "upcoming" | "past", filters: NewsFilters, limit: number) {
  const supabase = await createClient();
  const now = new Date().toISOString();

  // Only what the public sees, even for staff (who can also read drafts).
  let query = supabase
    .from("activities")
    .select(filters.schoolId ? selectColumns.replace("activity_schools(", "activity_schools!inner(") : selectColumns)
    .eq("status", "published")
    .lte("publish_at", now)
    .limit(limit);

  query = when === "upcoming" ? query.gte("starts_at", now).order("starts_at") : query.lt("starts_at", now).order("starts_at", { ascending: false });
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.schoolId) query = query.eq("activity_schools.school_id", filters.schoolId);
  if (filters.q) {
    const term = filters.q.replace(/[%,()]/g, " ");
    query = query.or(`title.ilike.%${term}%,summary.ilike.%${term}%`);
  }

  const { data } = await query.overrideTypes<Raw[], { merge: false }>();
  return (data ?? []).map((row) => toCard(row, supabase));
}

function toCard(row: Raw, supabase: Awaited<ReturnType<typeof createClient>>): ActivityCard {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    category: row.category,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    location: row.location,
    coverUrl: row.cover_path ? supabase.storage.from("media").getPublicUrl(row.cover_path).data.publicUrl : null,
    schools: row.activity_schools.flatMap((link) => (link.schools ? [link.schools] : [])),
    isDemo: row.is_demo,
  };
}

export async function getActivity(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activities")
    .select(`${selectColumns}, body, layout, status, publish_at, activity_media(id, kind, path, url, provider, title, caption, mime_type, size_bytes, position)`)
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<
      | (Raw & {
          body: string;
          layout: unknown;
          status: string;
          publish_at: string;
          activity_media: RawMedia[];
        })
      | null,
      { merge: false }
    >();
  if (!data) return null;
  const isPublic = data.status === "published" && data.publish_at <= new Date().toISOString();
  return {
    ...toCard(data, supabase),
    body: data.body,
    layout: isStoredLayout(data.layout) ? data.layout : null,
    isPublic,
    media: [...data.activity_media]
      .sort((a, b) => a.position - b.position)
      .map((item): ActivityMedia => ({
        id: item.id,
        kind: item.kind,
        // Uploaded files: their public address in the "media" bucket. Embeds and links: the original address.
        url: item.path ? supabase.storage.from("media").getPublicUrl(item.path).data.publicUrl : item.url ?? "",
        provider: item.provider,
        title: item.title,
        caption: item.caption,
        mimeType: item.mime_type,
        sizeBytes: item.size_bytes,
      })),
  };
}

type RawMedia = {
  id: string;
  kind: MediaKind;
  path: string | null;
  url: string | null;
  provider: EmbedProvider | null;
  title: string;
  caption: string;
  mime_type: string | null;
  size_bytes: number | null;
  position: number;
};

export type ActivityMedia = {
  id: string;
  kind: MediaKind;
  url: string;
  provider: EmbedProvider | null;
  title: string;
  caption: string;
  mimeType: string | null;
  sizeBytes: number | null;
};

export async function getNewsMeta() {
  const supabase = await createClient();
  const [{ data: stats }, { data: schools }] = await Promise.all([
    supabase.rpc("public_stats"),
    supabase.from("schools").select("id, name, city").order("name"),
  ]);
  const s = (stats ?? {}) as { schools?: number; students?: number; activities?: number; this_year?: number };
  return {
    stats: { schools: s.schools ?? 0, students: s.students ?? 0, activities: s.activities ?? 0, thisYear: s.this_year ?? 0 },
    schools: schools ?? [],
  };
}
