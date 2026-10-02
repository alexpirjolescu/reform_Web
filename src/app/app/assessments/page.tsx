import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader, moduleButtons } from "@/components/page-header";
import { listStaffAssessments } from "@/lib/assessments-server";
import { requireProfile } from "@/lib/auth";
import { shortDate } from "@/lib/format";
import { getTheme } from "@/lib/theme";
import { isStaffRole } from "@/lib/types";
import { StudentScreen } from "./student-screen";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("assessments") };
}

export default async function AssessmentsPage({ searchParams }: PageProps<"/app/assessments">) {
  const profile = await requireProfile();
  const [theme, locale, { tab }] = await Promise.all([getTheme(profile.theme), getLocale(), searchParams]);
  if (!isStaffRole(profile.role)) {
    return <StudentScreen selectedId={null} tab={typeof tab === "string" ? tab : undefined} theme={theme} locale={locale} />;
  }

  const [t, rows] = await Promise.all([getTranslations("assessments"), listStaffAssessments()]);
  const b = moduleButtons[theme];
  // eslint-disable-next-line react-hooks/purity -- server component, rendered once per request
  const now = Date.now();
  const stateOf = (row: (typeof rows)[number]) =>
    row.status === "draft" ? "draft" : Date.parse(row.opens_at) > now ? "scheduled" : Date.parse(row.closes_at) < now ? "closed" : "open";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader variant={theme} logo="academy" kicker={t("staffKicker")} title={t("title")}
        actions={<Link href="/app/assessments/new" className={b.primary}>+ {t("new")}</Link>} />
      <div className="px-4 py-6 sm:px-8">
        {rows.length === 0 ? (
          <p className="text-th-muted">{t("emptyStaff")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-2 border-th-edge">
                  <th scope="col" className="py-2 pr-4 font-medium">{t("colTitle")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("colState")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("colWindow")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("colSchools")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("colSubmitted")}</th>
                  <th scope="col" className="py-2 font-medium">{t("colToReview")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-th-line">
                    <td className="py-3 pr-4">
                      <Link href={`/app/assessments/${row.id}/results`} className="font-medium underline-offset-4 hover:underline">{row.title}</Link>
                      <div className="text-xs text-th-muted">{t(`kinds.${row.kind}`)}</div>
                    </td>
                    <td className="py-3 pr-4">{t(`staffState.${stateOf(row)}`)}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">{shortDate(row.opens_at, locale)} – {shortDate(row.closes_at, locale)}</td>
                    <td className="py-3 pr-4">{row.schools.join(", ") || "—"}</td>
                    <td className="py-3 pr-4">{row.submitted}</td>
                    <td className="py-3">{row.toReview > 0 ? <span className="rounded-th-pill bg-honey px-2 py-0.5 font-medium text-ink">{row.toReview}</span> : "0"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
