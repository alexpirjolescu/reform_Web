import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader, moduleButtons } from "@/components/page-header";
import { requireStaff } from "@/lib/auth";
import { shortDate, timeOfDay } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getTheme } from "@/lib/theme";

export async function generateMetadata() {
  const t = await getTranslations("adminNews");
  return { title: t("pageTitle") };
}

export default async function AdminNewsPage({ searchParams }: PageProps<"/app/admin/news">) {
  const profile = await requireStaff();
  const supabase = await createClient();
  const [theme, locale, t, { saved }, { data: activities }, { count: subscribers }] = await Promise.all([
    getTheme(profile.theme),
    getLocale(),
    getTranslations("adminNews"),
    searchParams,
    supabase.from("activities").select("id, title, category, starts_at, status, publish_at, is_demo").order("starts_at", { ascending: false }),
    profile.role === "admin"
      ? supabase.from("newsletter_subscribers").select("id", { count: "exact", head: true })
      : Promise.resolve({ count: null }),
  ]);
  const b = moduleButtons[theme];
  // eslint-disable-next-line react-hooks/purity -- server component, rendered once per request
  const now = Date.now();
  const stateOf = (a: { status: string; publish_at: string }) =>
    a.status === "draft" ? "draft" : Date.parse(a.publish_at) > now ? "scheduled" : "live";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader
        variant={theme}
        kicker={t("kicker")}
        title={t("pageTitle")}
        actions={
          <>
            {subscribers !== null && (
              // eslint-disable-next-line @next/next/no-html-link-for-pages -- a CSV download from a route handler, not a page
              <a href="/app/admin/news/subscribers" className={b.ghost}>{t("subscribers", { count: subscribers ?? 0 })}</a>
            )}
            <Link href="/app/admin/news/new" className={b.primary}>+ {t("new")}</Link>
          </>
        }
      />
      <div className="flex flex-col gap-4 px-4 py-6 sm:px-8">
        {typeof saved === "string" && <p role="status" className="self-start rounded-th bg-teal/30 px-3 py-2 text-sm">{t("saved")}</p>}
        {!activities?.length ? (
          <p className="text-th-muted">{t("empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-2 border-th-edge">
                  <th scope="col" className="py-2 pr-4 font-medium">{t("colTitle")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("colDate")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("colCategory")}</th>
                  <th scope="col" className="py-2 font-medium">{t("colState")}</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((a) => {
                  const state = stateOf(a);
                  return (
                    <tr key={a.id} className="border-b border-th-line">
                      <td className="py-3 pr-4">
                        <Link href={`/app/admin/news/${a.id}`} className="font-medium underline-offset-4 hover:underline">{a.title}</Link>
                        {" · "}
                        <Link href={`/activities/${a.id}`} className="text-xs text-th-link underline underline-offset-4">{state === "live" ? t("view") : t("preview")}</Link>
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap">{shortDate(a.starts_at, locale)}, {timeOfDay(a.starts_at, locale)}</td>
                      <td className="py-3 pr-4">{t(`categories.${a.category}`)}</td>
                      <td className="py-3">
                        <span className={`rounded-th-pill px-2 py-0.5 text-xs ${state === "live" ? "bg-teal text-ink" : state === "scheduled" ? "bg-honey text-ink" : "border-th"}`}>
                          {state === "scheduled" ? t("state.scheduled", { date: shortDate(a.publish_at, locale) }) : t(`state.${state}`)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
