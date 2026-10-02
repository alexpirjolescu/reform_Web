import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { PageHeader, moduleButtons } from "@/components/page-header";
import { deleteAssessment } from "@/app/app/assessments/actions";
import { getResults } from "@/lib/assessment-results";
import { scoreText } from "@/lib/assessments";
import { requireStaff } from "@/lib/auth";
import { deadline, shortDate } from "@/lib/format";
import { getTheme } from "@/lib/theme";

export async function generateMetadata({ params }: PageProps<"/app/assessments/[id]/results">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return {};
  const data = await getResults(id);
  return { title: data?.assessment.title };
}

export default async function ResultsPage({ params }: PageProps<"/app/assessments/[id]/results">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const profile = await requireStaff();
  const [theme, locale, t, data] = await Promise.all([getTheme(profile.theme), getLocale(), getTranslations("assessments"), getResults(id)]);
  if (!data) notFound();
  const { assessment, rows, questionStats } = data;
  const b = moduleButtons[theme];

  const submitted = rows.filter((r) => r.latest && r.latest.status !== "in_progress");
  const reviewed = submitted.filter((r) => r.latest?.status === "reviewed");
  const average = reviewed.length
    ? reviewed.reduce((sum, r) => sum + Number(r.latest?.final_score ?? 0), 0) / reviewed.length
    : null;
  const maxScore = reviewed[0]?.latest?.max_score ?? null;
  const toReview = rows.filter((r) => r.latest?.status === "submitted");

  const bySchool = [...new Set(rows.map((r) => r.schoolName))].map((school) => {
    const list = rows.filter((r) => r.schoolName === school);
    return { school, total: list.length, submitted: list.filter((r) => r.latest && r.latest.status !== "in_progress").length };
  });

  const card = "rounded-th border-th bg-th-card p-5";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader
        variant={theme}
        logo="academy"
        kicker={<Link href="/app/assessments" className="hover:underline">← {t("title")}</Link>}
        title={assessment.title}
        actions={
          <>
            <Link href={`/app/assessments/${id}/edit`} className={b.ghost}>{t("edit")}</Link>
            <a href={`/app/assessments/${id}/export`} className={b.ghost}>{t("exportCsv")}</a>
            {toReview[0]?.latest && (
              <Link href={`/app/assessments/${id}/review/${toReview[0].latest.id}`} className={b.primary}>{t("reviewNext", { count: toReview.length })}</Link>
            )}
          </>
        }
      />
      <div className="flex flex-col gap-6 px-4 py-6 sm:px-8">
        <p className="text-sm text-th-muted">
          {t(`kinds.${assessment.kind}`)} · {assessment.status === "draft" ? t("editor.draft") : t("editor.published")} · {deadline(assessment.opens_at, locale)} → {deadline(assessment.closes_at, locale)}
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className={card}><div className="text-sm text-th-muted">{t("stats.submitted")}</div><div className="font-display text-4xl font-extrabold">{submitted.length}/{rows.length}</div></div>
          <div className={card}><div className="text-sm text-th-muted">{t("stats.toReview")}</div><div className="font-display text-4xl font-extrabold">{toReview.length}</div></div>
          <div className={card}><div className="text-sm text-th-muted">{t("stats.average")}</div><div className="font-display text-4xl font-extrabold">{average === null ? "—" : scoreText(Math.round(average * 10) / 10, maxScore === null ? null : Number(maxScore), locale)}</div></div>
        </div>

        {bySchool.length > 1 && (
          <section aria-labelledby="by-school" className="flex flex-col gap-2">
            <h2 id="by-school" className="font-display text-xl font-bold">{t("stats.bySchool")}</h2>
            <ul className="flex flex-wrap gap-2 text-sm">
              {bySchool.map((s) => <li key={s.school} className="rounded-th-pill border-th px-3 py-1">{s.school || "—"}: {s.submitted}/{s.total}</li>)}
            </ul>
          </section>
        )}

        <section aria-labelledby="by-student" className="flex flex-col gap-2">
          <h2 id="by-student" className="font-display text-xl font-bold">{t("stats.byStudent")}</h2>
          {rows.length === 0 ? (
            <p className="text-th-muted">{t("noStudents")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-th-edge">
                    <th scope="col" className="py-2 pr-4 font-medium">{t("colStudent")}</th>
                    <th scope="col" className="py-2 pr-4 font-medium">{t("colSchool")}</th>
                    <th scope="col" className="py-2 pr-4 font-medium">{t("colState")}</th>
                    <th scope="col" className="py-2 pr-4 font-medium">{t("colHandedIn")}</th>
                    <th scope="col" className="py-2 pr-4 font-medium">{t("colScore")}</th>
                    <th scope="col" className="py-2 font-medium"><span className="sr-only">{t("colActions")}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ student, schoolName, latest, attempts }) => (
                    <tr key={student.id} className="border-b border-th-line">
                      <td className="py-3 pr-4 font-medium">{student.full_name}</td>
                      <td className="py-3 pr-4">{schoolName}</td>
                      <td className="py-3 pr-4">
                        {latest ? t(`attemptState.${latest.status}`) : t("attemptState.not_started")}
                        {attempts.length > 1 && <span className="text-th-muted"> · {t("attemptsCount", { count: attempts.length })}</span>}
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        {latest?.submitted_at ? shortDate(latest.submitted_at, locale) : "—"}
                        {latest?.is_late && <span className="ml-1 rounded-th-pill bg-vermilion px-1.5 text-xs text-ink">{t("late")}</span>}
                      </td>
                      <td className="py-3 pr-4">
                        {latest?.status === "reviewed" ? scoreText(Number(latest.final_score), latest.max_score === null ? null : Number(latest.max_score), locale) : "—"}
                      </td>
                      <td className="py-3">
                        {latest && latest.status !== "in_progress" && (
                          <Link href={`/app/assessments/${id}/review/${latest.id}`} className="font-medium text-th-link underline underline-offset-4">
                            {latest.status === "submitted" ? t("review.open") : t("review.see")}
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {assessment.kind === "quiz" && questionStats.length > 0 && (
          <section aria-labelledby="by-question" className="flex flex-col gap-2">
            <h2 id="by-question" className="font-display text-xl font-bold">{t("stats.byQuestion")}</h2>
            <ol className="flex flex-col gap-2">
              {questionStats.map(({ question, answered, correct, average: avg }, i) => (
                <li key={question.id} className={`${card} flex flex-wrap items-baseline justify-between gap-3 py-3`}>
                  <span className="min-w-0 flex-1"><span className="font-display font-bold">{i + 1}.</span> {question.prompt}</span>
                  <span className="text-sm text-th-muted">
                    {question.kind === "open"
                      ? t("stats.openAverage", { avg: avg === null ? "—" : (Math.round(avg * 10) / 10).toString(), max: question.points })
                      : t("stats.correctShare", { pct: answered ? Math.round((100 * correct) / answered) : 0, correct, answered })}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <details className="self-start">
          <summary className="cursor-pointer text-sm text-th-muted underline underline-offset-4">{t("deleteAssessment")}</summary>
          <form action={deleteAssessment} className="mt-3 flex flex-col items-start gap-2">
            <input type="hidden" name="id" value={id} />
            <p className="text-sm">{t("deleteWarning")}</p>
            <button type="submit" className={b.danger}>{t("deleteConfirm")}</button>
          </form>
        </details>
      </div>
    </div>
  );
}
