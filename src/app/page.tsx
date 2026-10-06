import { getLocale } from "next-intl/server";
import { NewsPanel } from "@/components/news/news-panel";
import { getSession } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { getNewsMeta, listActivities, parseFilters } from "@/lib/news";
import { getTheme } from "@/lib/theme";

// Public news panel (PRD module 1): one newspaper layout on the paper of the chosen theme.
export default async function HomePage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const session = await getSession();
  const [locale, theme] = await Promise.all([getLocale(), getTheme("profile" in session ? session.profile.theme : null)]);

  const empty = { stats: { schools: 0, students: 0, activities: 0, thisYear: 0 }, schools: [] };
  const [upcoming, past, meta] = hasSupabaseEnv
    ? await Promise.all([listActivities("upcoming", filters, 4), listActivities("past", filters, 3), getNewsMeta()])
    : [[], [], empty];

  return (
    <NewsPanel
      theme={theme}
      locale={locale}
      upcoming={upcoming}
      past={past}
      stats={meta.stats}
      schools={meta.schools}
      filters={filters}
      signedIn={session.status === "active"}
    />
  );
}
