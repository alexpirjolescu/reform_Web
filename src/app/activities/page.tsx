import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ActivityVisual, CategoryChips, SchoolSearchForm } from "@/components/news/shared";
import { paperFor } from "@/components/news/paper";
import { PublicFrame } from "@/components/public-frame";
import { getSession } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { categoryColor, getNewsMeta, listActivities, parseFilters } from "@/lib/news";
import { getTheme } from "@/lib/theme";

export async function generateMetadata() {
  const t = await getTranslations("news");
  return { title: t("calendarTitle") };
}

// Full calendar and archive (NP-3): filter by type, school and keyword.
export default async function ActivitiesPage({ searchParams }: PageProps<"/activities">) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const when = params.when === "past" ? "past" : "upcoming";
  const session = await getSession();
  const [t, locale, theme, items, meta] = await Promise.all([
    getTranslations(),
    getLocale(),
    getTheme("profile" in session ? session.profile.theme : null),
    listActivities(when, filters, 60),
    getNewsMeta(),
  ]);
  const p = paperFor(theme);

  return (
    <PublicFrame theme={theme} signedIn={session.status === "active"}>
      <div className="flex flex-col gap-8">
        <h1 className={`font-display text-5xl font-extrabold tracking-tight ${p.heading}`}>
          {t("news.calendarTitle")}
        </h1>
        <div className="flex flex-wrap gap-4 text-[15px]">
          <Link href={`/activities?${new URLSearchParams({ ...(filters.category ? { type: filters.category } : {}) })}`} className={when === "upcoming" ? p.activeTab : p.tab}>
            {t("home.upcoming")}
          </Link>
          <Link href={`/activities?when=past${filters.category ? `&type=${filters.category}` : ""}`} className={when === "past" ? p.activeTab : p.tab}>
            {t("home.past")}
          </Link>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <CategoryChips filters={filters} dot={p.dot ?? "square"} chip={p.filter} activeChip={p.activeFilter} />
          <SchoolSearchForm filters={filters} schools={meta.schools} labelClass={p.muted} fieldClass={p.field} buttonClass={p.fieldButton} />
        </div>
        {items.length ? (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((activity) => (
              <li key={activity.id}>
                <Link href={`/activities/${activity.id}`} className={`flex h-full flex-col gap-3 ${p.card}`}>
                  <ActivityVisual activity={activity} rounded={p.media} />
                  <span className={`inline-flex items-center gap-2 text-[13px] ${p.muted}`}>
                    <span aria-hidden="true" className={`size-2.5 ${p.dot === "round" ? "rounded-full" : ""}`} style={{ background: categoryColor[activity.category] }} />
                    {t(`news.categories.${activity.category}`)} · {dateTime(activity.startsAt, locale)}
                  </span>
                  <span className="font-display text-xl leading-tight font-bold">{activity.title}</span>
                  {activity.summary && <span className="text-sm leading-relaxed">{activity.summary}</span>}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className={p.muted}>{t("news.noResults")}</p>
        )}
      </div>
    </PublicFrame>
  );
}
