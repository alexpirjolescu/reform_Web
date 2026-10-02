import { getLocale } from "next-intl/server";
import { NewsColor } from "@/components/news/news-color";
import { NewsDark } from "@/components/news/news-dark";
import { NewsWhite } from "@/components/news/news-white";
import { getSession } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { getNewsMeta, listActivities, parseFilters } from "@/lib/news";
import { getTheme } from "@/lib/theme";

// Public news panel (PRD module 1): one page, three layouts.
export default async function HomePage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const session = await getSession();
  const [locale, theme] = await Promise.all([getLocale(), getTheme("profile" in session ? session.profile.theme : null)]);

  const empty = { stats: { schools: 0, students: 0, activities: 0, thisYear: 0 }, schools: [] };
  const [upcoming, past, meta] = hasSupabaseEnv
    ? await Promise.all([listActivities("upcoming", filters, 4), listActivities("past", filters, 3), getNewsMeta()])
    : [[], [], empty];

  const props = { theme, locale, upcoming, past, stats: meta.stats, schools: meta.schools, filters, signedIn: session.status === "active" };

  if (theme === "dark") return <NewsDark {...props} />;
  if (theme === "color") return <NewsColor {...props} />;
  return <NewsWhite {...props} />;
}
