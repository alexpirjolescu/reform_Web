import Link from "next/link";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import { getLocale, getTranslations } from "next-intl/server";
import { paperFor } from "@/components/news/paper";
import { ActivityVisual } from "@/components/news/shared";
import { PublicFrame } from "@/components/public-frame";
import { getSession } from "@/lib/auth";
import { dateTime, timeOfDay } from "@/lib/format";
import { categoryColor, categoryInk, getActivity } from "@/lib/news";
import { getTheme } from "@/lib/theme";

export async function generateMetadata({ params }: PageProps<"/activities/[id]">) {
  const activity = await getActivity((await params).id);
  if (!activity) return {};
  return {
    title: activity.title,
    description: activity.summary,
    openGraph: { title: activity.title, description: activity.summary, images: activity.coverUrl ? [activity.coverUrl] : [] },
  };
}

// Activity detail (NP-2). Staff can preview drafts; everyone else sees only published activities.
export default async function ActivityPage({ params }: PageProps<"/activities/[id]">) {
  const { id } = await params;
  const activity = await getActivity(id);
  if (!activity) notFound();

  const session = await getSession();
  const [t, locale, theme] = await Promise.all([
    getTranslations(),
    getLocale(),
    getTheme("profile" in session ? session.profile.theme : null),
  ]);
  const p = paperFor(theme);

  return (
    <PublicFrame theme={theme} signedIn={session.status === "active"}>
      <article className="mx-auto flex max-w-3xl flex-col gap-6">
        {!activity.isPublic && (
          <p role="status" className={`px-4 py-2 text-sm font-medium ${p.notice}`}>{t("news.draftPreview")}</p>
        )}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className={`${p.tag} font-medium`} style={{ background: categoryColor[activity.category], color: categoryInk[activity.category] }}>
            {t(`news.categories.${activity.category}`)}
          </span>
        </div>
        <h1 className="font-display text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-6xl">{activity.title}</h1>
        <dl className={`grid gap-1 text-[15px] sm:grid-cols-[140px_1fr] ${p.muted}`}>
          <dt>{t("news.when")}</dt>
          <dd className={p.text}>
            {dateTime(activity.startsAt, locale)}
            {activity.endsAt ? ` – ${timeOfDay(activity.endsAt, locale)}` : ""}
          </dd>
          {activity.location && (
            <>
              <dt>{t("news.where")}</dt>
              <dd className={p.text}>{activity.location}</dd>
            </>
          )}
          {activity.schools.length > 0 && (
            <>
              <dt>{t("news.schools")}</dt>
              <dd className={p.text}>{activity.schools.map((s) => s.name).join(", ")}</dd>
            </>
          )}
        </dl>
        <ActivityVisual activity={activity} ratio="16 / 8" rounded={p.media} />
        {activity.summary && <p className="text-xl leading-relaxed font-light">{activity.summary}</p>}
        {activity.body && (
          <div className="prose-reform text-[17px]">
            <Markdown>{activity.body}</Markdown>
          </div>
        )}
        {activity.photos.length > 0 && (
          <section aria-labelledby="gallery-title" className="flex flex-col gap-4">
            <h2 id="gallery-title" className="font-display text-2xl font-bold">{t("news.gallery")}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {activity.photos.map((photo) => (
                <figure key={photo.id} className="flex flex-col gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element -- Supabase Storage images */}
                  <img src={photo.url} alt={photo.caption} className={`aspect-[4/3] w-full object-cover ${p.media}`} />
                  {photo.caption && <figcaption className={`text-xs ${p.muted}`}>{photo.caption}</figcaption>}
                </figure>
              ))}
            </div>
          </section>
        )}
        <div className="flex flex-wrap gap-6 font-display font-semibold">
          {new Date(activity.startsAt) > new Date() && (
            <a href={`/activities/${activity.id}/calendar.ics`} className={p.link}>{t("news.addToCalendar")}</a>
          )}
          <Link href="/" className={p.link}>← {t("news.backToNews")}</Link>
        </div>
      </article>
    </PublicFrame>
  );
}
