import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ActivityCard, NewsFilters } from "@/lib/news";
import { categoryColor } from "@/lib/news";
import { activityCategories } from "@/lib/types";
import type { Theme } from "@/lib/theme";

export type NewsProps = {
  theme: Theme;
  locale: string;
  upcoming: ActivityCard[];
  past: ActivityCard[];
  stats: { schools: number; students: number; activities: number; thisYear: number };
  schools: { id: string; name: string }[];
  filters: NewsFilters;
  signedIn: boolean;
};

/** Cover photo, or a brand-coloured block with the underscore bar when there is none. */
export function ActivityVisual({
  activity,
  ratio = "3 / 2",
  rounded = "",
  bar = "#221f20",
  className = "",
}: {
  activity: ActivityCard;
  ratio?: string;
  rounded?: string;
  bar?: string;
  className?: string;
}) {
  if (activity.coverUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- covers come from Supabase Storage at any size
      <img
        src={activity.coverUrl}
        alt=""
        className={`block w-full object-cover ${rounded} ${className}`}
        style={{ aspectRatio: ratio }}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className={`relative w-full overflow-hidden ${rounded} ${className}`}
      style={{ aspectRatio: ratio, background: categoryColor[activity.category] }}
    >
      <span className="absolute top-[44%] left-[14%] h-[14%] max-h-7 w-[32%]" style={{ background: bar }} />
    </div>
  );
}

export function filterHref(filters: NewsFilters, patch: Partial<NewsFilters>, base = "/") {
  const next = { ...filters, ...patch };
  const params = new URLSearchParams();
  if (next.category) params.set("type", next.category);
  if (next.schoolId) params.set("school", next.schoolId);
  if (next.q) params.set("q", next.q);
  const query = params.toString();
  return `${base}${query ? `?${query}` : ""}#urmeaza`;
}

export async function CategoryLabel({ category }: { category: ActivityCard["category"] }) {
  const t = await getTranslations("news.categories");
  return <>{t(category)}</>;
}

/** Filter chips as plain links (they work without JavaScript); styles come from the paper (./paper.ts). */
export async function CategoryChips({
  filters,
  chip,
  activeChip,
  dot,
}: {
  filters: NewsFilters;
  chip: string;
  activeChip: string;
  dot?: "square" | "round";
}) {
  const t = await getTranslations("news");
  return (
    <nav aria-label={t("filterByType")} className="flex flex-wrap gap-2">
      <Link href={filterHref(filters, { category: undefined })} aria-current={!filters.category ? "page" : undefined} className={!filters.category ? activeChip : chip}>
        {t("all")}
      </Link>
      {activityCategories.map((category) => (
        <Link
          key={category}
          href={filterHref(filters, { category })}
          aria-current={filters.category === category ? "page" : undefined}
          className={`inline-flex items-center gap-2 ${filters.category === category ? activeChip : chip}`}
        >
          {dot && (
            <span
              aria-hidden="true"
              className={`size-2.5 shrink-0 ${dot === "round" ? "rounded-full" : ""}`}
              style={{ background: categoryColor[category] }}
            />
          )}
          {t(`categoriesPlural.${category}`)}
        </Link>
      ))}
    </nav>
  );
}

/** School filter and keyword search: a GET form, so it works without JavaScript. */
export async function SchoolSearchForm({
  filters,
  schools,
  fieldClass,
  labelClass,
  buttonClass,
}: {
  filters: NewsFilters;
  schools: { id: string; name: string }[];
  fieldClass: string;
  labelClass: string;
  buttonClass: string;
}) {
  const t = await getTranslations("news");
  return (
    <form action="/#urmeaza" method="get" className="flex flex-wrap items-end gap-2">
      {filters.category && <input type="hidden" name="type" value={filters.category} />}
      <label className={`flex flex-col gap-1 text-xs ${labelClass}`}>
        {t("school")}
        <select name="school" defaultValue={filters.schoolId ?? ""} className={fieldClass}>
          <option value="">{t("allSchools")}</option>
          {schools.map((school) => (
            <option key={school.id} value={school.id}>
              {school.name}
            </option>
          ))}
        </select>
      </label>
      <label className={`flex flex-col gap-1 text-xs ${labelClass}`}>
        {t("search")}
        <input type="search" name="q" defaultValue={filters.q ?? ""} placeholder={t("searchPlaceholder")} className={`${fieldClass} w-40`} />
      </label>
      <button type="submit" className={buttonClass}>
        {t("apply")}
      </button>
    </form>
  );
}
