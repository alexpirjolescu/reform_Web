import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ActivityVisual, CategoryChips, SchoolSearchForm } from "@/components/news/shared";
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
  const dark = theme === "dark";
  const color = theme === "color";
  const tab = (active: boolean) =>
    color
      ? `rounded-full border-2 border-ink px-4 py-2 ${active ? "bg-ink text-white" : "bg-white"}`
      : dark
        ? `px-1 py-2 border-b-[3px] ${active ? "border-teal" : "border-transparent text-night-muted"}`
        : `px-1 py-2 border-b-4 ${active ? "border-teal font-medium" : "border-transparent text-muted"}`;

  return (
    <PublicFrame theme={theme} signedIn={session.status === "active"}>
      <div className="flex flex-col gap-8">
        <h1 className={`font-display text-5xl font-extrabold tracking-tight ${dark ? "text-teal" : color ? "" : "text-teal-strong"}`}>
          {t("news.calendarTitle")}
        </h1>
        <div className="flex flex-wrap gap-4 text-[15px]">
          <Link href={`/activities?${new URLSearchParams({ ...(filters.category ? { type: filters.category } : {}) })}`} className={tab(when === "upcoming")}>
            {t("home.upcoming")}
          </Link>
          <Link href={`/activities?when=past${filters.category ? `&type=${filters.category}` : ""}`} className={tab(when === "past")}>
            {t("home.past")}
          </Link>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <CategoryChips
            filters={filters}
            dot={color ? "round" : "square"}
            chip={color ? "rounded-full border-2 border-ink px-4 py-2 text-sm" : dark ? "rounded-full border border-night-edge px-4 py-2 text-sm" : "border border-ink px-3 py-2 text-sm"}
            activeChip={color ? "rounded-full border-2 border-ink bg-ink px-4 py-2 text-sm text-white" : dark ? "rounded-full border border-white bg-white px-4 py-2 text-sm text-night" : "border border-ink bg-ink px-3 py-2 text-sm text-white"}
          />
          <SchoolSearchForm
            filters={filters}
            schools={meta.schools}
            labelClass={dark ? "text-night-muted" : "text-muted"}
            fieldClass={dark ? "min-h-11 border border-night-edge bg-night-3 px-3 text-sm text-white" : color ? "min-h-11 rounded-full border-2 border-ink px-4 text-sm" : "min-h-11 border border-ink px-3 text-sm"}
            buttonClass={dark ? "min-h-11 bg-teal px-4 text-sm text-night" : color ? "min-h-11 rounded-full bg-ink px-5 text-sm text-white" : "min-h-11 bg-ink px-4 text-sm text-white"}
          />
        </div>
        {items.length ? (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((activity) => (
              <li key={activity.id}>
                <Link href={`/activities/${activity.id}`} className={`flex h-full flex-col gap-3 ${color ? "rounded-3xl border-2 border-ink p-3" : dark ? "bg-night-3 p-4" : "border border-line p-3"}`}>
                  <ActivityVisual activity={activity} rounded={color ? "rounded-2xl border-2 border-ink" : ""} />
                  <span className={`inline-flex items-center gap-2 text-[13px] ${dark ? "text-night-muted" : "text-muted"}`}>
                    <span aria-hidden="true" className={`size-2.5 ${color ? "rounded-full" : ""}`} style={{ background: categoryColor[activity.category] }} />
                    {t(`news.categories.${activity.category}`)} · {dateTime(activity.startsAt, locale)}
                  </span>
                  <span className="font-display text-xl leading-tight font-bold">{activity.title}</span>
                  {activity.summary && <span className="text-sm leading-relaxed">{activity.summary}</span>}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className={dark ? "text-night-muted" : "text-muted"}>{t("news.noResults")}</p>
        )}
      </div>
    </PublicFrame>
  );
}
