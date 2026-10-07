import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { ActivityEditor } from "@/components/news/activity-editor";
import { PageHeader, moduleButtons } from "@/components/page-header";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { MediaItem } from "@/lib/media";
import { getTheme } from "@/lib/theme";
import { deleteActivity } from "../actions";
import { defaultStart, getSchools, mediaBase } from "../editor-data";

export default async function EditActivityPage({ params }: PageProps<"/app/admin/news/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const profile = await requireStaff();
  const supabase = await createClient();
  const [theme, t, schools, { data: activity }] = await Promise.all([
    getTheme(profile.theme),
    getTranslations("adminNews"),
    getSchools(),
    supabase
      .from("activities")
      .select("id, title, summary, body, category, starts_at, ends_at, location, cover_path, status, publish_at, photo_consent_confirmed, activity_schools(school_id), activity_media(kind, path, url, provider, title, caption, mime_type, size_bytes, position)")
      .eq("id", id)
      .maybeSingle(),
  ]);
  if (!activity) notFound();
  const { activity_schools, activity_media, ...rest } = activity;
  const b = moduleButtons[theme];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader variant={theme} kicker={<Link href="/app/admin/news" className="hover:underline">← {t("pageTitle")}</Link>} title={activity.title}
        actions={<Link href={`/activities/${id}`} className={b.ghost}>{t("preview")}</Link>} />
      <div className="flex flex-col gap-8 px-4 py-6 sm:px-8">
        <ActivityEditor
          initial={{
            ...rest,
            status: rest.status as "draft" | "published",
            schoolIds: activity_schools.map((s) => s.school_id),
            media: [...activity_media].sort((a, b) => a.position - b.position).map((item): MediaItem => ({
              kind: item.kind as MediaItem["kind"],
              path: item.path,
              url: item.url,
              provider: item.provider as MediaItem["provider"],
              title: item.title,
              caption: item.caption,
              mime_type: item.mime_type,
              size_bytes: item.size_bytes,
            })),
          }}
          schools={schools}
          defaultStart={defaultStart()}
          mediaBase={mediaBase}
        />
        <details className="self-start">
          <summary className="cursor-pointer text-sm text-th-muted underline underline-offset-4">{t("delete")}</summary>
          <form action={deleteActivity} className="mt-3 flex flex-col items-start gap-2">
            <input type="hidden" name="id" value={id} />
            <p className="text-sm">{t("deleteWarning")}</p>
            <button type="submit" className={b.danger}>{t("deleteConfirm")}</button>
          </form>
        </details>
      </div>
    </div>
  );
}
