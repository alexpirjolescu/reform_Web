import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { GridIcon, MailIcon, NewsIcon, ShieldIcon, UsersIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { requireStaff } from "@/lib/auth";
import { listPendingInvites } from "@/lib/invites";
import { createClient } from "@/lib/supabase/server";
import { getTheme } from "@/lib/theme";

export async function generateMetadata() {
  const t = await getTranslations("admin.overview");
  return { title: t("title") };
}

// The administration area at a glance (staff and admins): what is waiting, and where to do it.
export default async function AdminOverviewPage() {
  const actor = await requireStaff();
  const isAdmin = actor.role === "admin";
  const supabase = await createClient();
  const [t, theme, pending, drafts, reports, accounts] = await Promise.all([
    getTranslations(),
    getTheme(actor.theme),
    process.env.SUPABASE_SECRET_KEY ? listPendingInvites().then((list) => list.length) : Promise.resolve(null),
    supabase.from("activities").select("id", { count: "exact", head: true }).eq("status", "draft"),
    isAdmin ? supabase.from("message_reports").select("id", { count: "exact", head: true }).eq("status", "open") : Promise.resolve({ count: null }),
    isAdmin ? supabase.from("profiles").select("id", { count: "exact", head: true }).is("deactivated_at", null) : Promise.resolve({ count: null }),
  ]);

  const tiles = [
    { key: "invites", href: "/app/admin/invites", Icon: MailIcon, count: pending, show: true },
    { key: "news", href: "/app/admin/news", Icon: NewsIcon, count: drafts.count, show: true },
    { key: "users", href: "/app/admin/users", Icon: UsersIcon, count: accounts.count, show: isAdmin },
    { key: "reports", href: "/app/admin/reports", Icon: ShieldIcon, count: reports.count, show: isAdmin },
  ].filter((tile) => tile.show);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader variant={theme} kicker={t(`roles.${actor.role}`)} title={t("admin.overview.title")} />
      <div className="flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-8">
        <p className="flex items-center gap-2 text-th-muted">
          <GridIcon size={18} /> {t(isAdmin ? "admin.overview.introAdmin" : "admin.overview.introStaff")}
        </p>
        <ul className="grid gap-4 sm:grid-cols-2">
          {tiles.map(({ key, href, Icon, count }) => (
            <li key={key}>
              <Link href={href} className="flex h-full flex-col gap-3 rounded-th border-th bg-th-card p-5 hover:bg-th-raised">
                <span className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2.5 font-display text-xl font-bold">
                    <Icon size={20} /> {t(`admin.overview.${key}.title`)}
                  </span>
                  {count !== null && count !== undefined && (
                    <span className="font-display text-3xl font-extrabold">{count}</span>
                  )}
                </span>
                <span className="text-sm text-th-muted">{t(`admin.overview.${key}.body`)}</span>
                <span className="mt-auto text-sm font-medium text-th-link">{t(`admin.overview.${key}.cta`)} →</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
