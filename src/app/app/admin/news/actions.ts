"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/form";
import { requireStaff } from "@/lib/auth";
import { embedPlayer, parseLink } from "@/lib/embeds";
import { kindOfMime, needsConsent } from "@/lib/media";
import { createClient } from "@/lib/supabase/server";

const storagePath = z.string().min(1).max(500).regex(/^activities\/[^/]+$/).refine((p) => !p.includes(".."));

// One item of a news post's media (see src/lib/media.ts). Links are re-read here, so only
// addresses that really belong to the named provider are saved as embeds.
const mediaSchema = z
  .object({
    kind: z.enum(["image", "video", "audio", "file", "embed", "link"]),
    path: storagePath.nullish(),
    url: z.string().max(2000).nullish(),
    provider: z.enum(["instagram", "facebook", "youtube", "vimeo", "tiktok", "spotify", "drive"]).nullish(),
    title: z.string().trim().max(300).default(""),
    caption: z.string().trim().max(300).default(""),
    mime_type: z.string().max(120).nullish(),
    size_bytes: z.number().int().nonnegative().nullish(),
  })
  .transform((item, ctx) => {
    if (item.kind === "embed" || item.kind === "link") {
      const parsed = item.url ? parseLink(item.url) : null;
      if (!parsed) {
        ctx.addIssue({ code: "custom", message: "media" });
        return z.NEVER;
      }
      if (parsed.kind === "embed" && embedPlayer(parsed.provider, parsed.url)) {
        return { kind: "embed" as const, url: parsed.url, provider: parsed.provider, title: item.title, caption: item.caption };
      }
      return { kind: "link" as const, url: parsed.url, title: item.title, caption: item.caption };
    }
    if (!item.path || (item.mime_type && kindOfMime(item.mime_type) !== item.kind)) {
      ctx.addIssue({ code: "custom", message: "media" });
      return z.NEVER;
    }
    return { kind: item.kind, path: item.path, title: item.title, caption: item.caption, mime_type: item.mime_type ?? null, size_bytes: item.size_bytes ?? null };
  });

const activitySchema = z
  .object({
    id: z.uuid().nullable(),
    title: z.string().trim().min(3).max(160),
    summary: z.string().trim().max(400),
    body: z.string().max(50000),
    category: z.enum(["workshop", "meeting", "event", "showcase"]),
    starts_at: z.iso.datetime({ offset: true }),
    ends_at: z.iso.datetime({ offset: true }).nullable(),
    location: z.string().trim().max(200),
    cover_path: storagePath.nullable(),
    status: z.enum(["draft", "published"]),
    publish_at: z.iso.datetime({ offset: true }).nullable(),
    photo_consent_confirmed: z.boolean(),
    school_ids: z.array(z.uuid()).max(100),
    media: z.array(mediaSchema).max(60),
  })
  .refine((a) => !a.ends_at || Date.parse(a.ends_at) >= Date.parse(a.starts_at), { message: "dates" })
  .refine((a) => a.status === "draft" || (!a.cover_path && !needsConsent(a.media)) || a.photo_consent_confirmed, { message: "consent" });

/** Files of an activity in the "media" bucket: its cover and its uploaded media. */
async function storedPaths(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const [{ data: activity }, { data: media }] = await Promise.all([
    supabase.from("activities").select("cover_path").eq("id", id).maybeSingle(),
    supabase.from("activity_media").select("path").eq("activity_id", id),
  ]);
  return [activity?.cover_path, ...(media ?? []).map((m) => m.path)].filter((p): p is string => Boolean(p));
}

/** Staff: create or update a news panel activity (PRD module 1) with schools and media. */
export async function saveActivity(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { error: "adminNews.errors.invalid" };
  }
  const parsed = activitySchema.safeParse(payload);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message;
    return { error: `adminNews.errors.${message === "dates" || message === "consent" || message === "media" ? message : "invalid"}` };
  }
  const supabase = await createClient();
  const before = parsed.data.id ? await storedPaths(supabase, parsed.data.id) : [];
  const { data: id, error } = await supabase.rpc("save_activity", { payload: parsed.data });
  if (error || !id) return { error: "adminNews.errors.saveFailed", errorValues: { detail: error?.message ?? "" } };

  // The database must have stored every media item (it won't if its save_activity is out of date).
  const { count } = await supabase.from("activity_media").select("id", { count: "exact", head: true }).eq("activity_id", id);
  if ((count ?? 0) !== parsed.data.media.length) {
    return { error: "adminNews.errors.saveFailed", errorValues: { detail: `media ${count ?? 0}/${parsed.data.media.length}` } };
  }

  // Files removed in the editor are deleted from storage once the save went through.
  const kept = new Set(await storedPaths(supabase, id));
  const removed = before.filter((path) => !kept.has(path));
  if (removed.length) await supabase.storage.from("media").remove(removed);

  revalidatePath("/", "layout");
  redirect(`/app/admin/news?saved=${id}`);
}

export async function deleteActivity(formData: FormData) {
  await requireStaff();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  const paths = await storedPaths(supabase, id.data);
  await supabase.from("activities").delete().eq("id", id.data);
  if (paths.length) await supabase.storage.from("media").remove(paths);
  revalidatePath("/", "layout");
  redirect("/app/admin/news");
}
