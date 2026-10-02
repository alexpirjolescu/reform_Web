"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/form";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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
    cover_path: z.string().max(500).nullable(),
    status: z.enum(["draft", "published"]),
    publish_at: z.iso.datetime({ offset: true }).nullable(),
    photo_consent_confirmed: z.boolean(),
    school_ids: z.array(z.uuid()).max(100),
    photos: z.array(z.object({ path: z.string().min(1).max(500), caption: z.string().max(300) })).max(60),
  })
  .refine((a) => !a.ends_at || Date.parse(a.ends_at) >= Date.parse(a.starts_at), { message: "dates" })
  .refine((a) => a.status === "draft" || (!a.cover_path && a.photos.length === 0) || a.photo_consent_confirmed, { message: "consent" });

/** Staff: create or update a news panel activity (PRD module 1) with schools and photos. */
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
    return { error: `adminNews.errors.${message === "dates" || message === "consent" ? message : "invalid"}` };
  }
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("save_activity", { payload: parsed.data });
  if (error || !id) return { error: "adminNews.errors.saveFailed", errorValues: { detail: error?.message ?? "" } };

  revalidatePath("/", "layout");
  redirect(`/app/admin/news?saved=${id}`);
}

export async function deleteActivity(formData: FormData) {
  await requireStaff();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  const [{ data: activity }, { data: photos }] = await Promise.all([
    supabase.from("activities").select("cover_path").eq("id", id.data).maybeSingle(),
    supabase.from("activity_photos").select("path").eq("activity_id", id.data),
  ]);
  const paths = [activity?.cover_path, ...(photos ?? []).map((p) => p.path)].filter((p): p is string => Boolean(p));
  await supabase.from("activities").delete().eq("id", id.data);
  if (paths.length) await supabase.storage.from("media").remove(paths);
  revalidatePath("/", "layout");
  redirect("/app/admin/news");
}
