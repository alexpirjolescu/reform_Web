import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { ReviewForm } from "@/components/assessments/review-form";
import { PageHeader } from "@/components/page-header";
import { choiceLetter, scoreText } from "@/lib/assessments";
import { getAttemptReview, getRunnerData } from "@/lib/assessments-server";
import { requireStaff } from "@/lib/auth";
import { deadline } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getTheme } from "@/lib/theme";

export default async function ReviewPage({ params }: PageProps<"/app/assessments/[id]/review/[attemptId]">) {
  const { id, attemptId } = await params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(attemptId).success) notFound();
  const profile = await requireStaff();
  const supabase = await createClient();
  const [theme, locale, t, { data: attempt }] = await Promise.all([
    getTheme(profile.theme),
    getLocale(),
    getTranslations("assessments"),
    supabase
      .from("attempts")
      .select("id, assessment_id, attempt_number, status, submitted_at, is_late, auto_score, final_score, max_score, feedback, text_response, link_response, profiles!attempts_student_id_fkey(full_name), assessments(title, kind)")
      .eq("id", attemptId)
      .eq("assessment_id", id)
      .maybeSingle(),
  ]);
  if (!attempt || !attempt.assessments) notFound();

  const [runner, review, { data: queue }] = await Promise.all([
    getRunnerData(id, attemptId),
    getAttemptReview(attemptId),
    supabase.from("attempts").select("id").eq("assessment_id", id).eq("status", "submitted").neq("id", attemptId).order("submitted_at").limit(1),
  ]);
  const isAssignment = attempt.assessments.kind === "assignment";
  const panel = "rounded-th border-th bg-th-card p-5";
  const next = queue?.[0];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader
        variant={theme}
        logo="academy"
        kicker={<Link href={`/app/assessments/${id}/results`} className="hover:underline">← {attempt.assessments.title}</Link>}
        title={attempt.profiles?.full_name ?? t("review.student")}
        actions={next ? <Link href={`/app/assessments/${id}/review/${next.id}`} className="text-sm font-medium underline underline-offset-4">{t("review.next")} →</Link> : undefined}
      />
      <div className="grid gap-6 px-4 py-6 sm:px-8 xl:grid-cols-[1fr_380px] xl:items-start">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-th-muted">
            {t("attemptShort", { n: attempt.attempt_number, max: attempt.attempt_number })} · {t(`attemptState.${attempt.status}`)}
            {attempt.submitted_at && ` · ${t("handedInOn", { date: deadline(attempt.submitted_at, locale) })}`}
            {attempt.is_late && ` · ${t("late")}`}
            {attempt.auto_score !== null && !isAssignment && ` · ${t("review.autoScore", { score: scoreText(Number(attempt.auto_score), attempt.max_score === null ? null : Number(attempt.max_score), locale) })}`}
          </p>

          {isAssignment && (
            <section className={`${panel} flex flex-col gap-3`} aria-labelledby="handin">
              <h2 id="handin" className="font-display text-xl font-bold">{t("yourHandIn")}</h2>
              {runner.files.length === 0 && !attempt.link_response && !attempt.text_response && <p className="text-th-muted">{t("review.nothing")}</p>}
              {runner.files.map((file) => (
                <a key={file.id} href={`/app/assessments/file/${file.id}`} target="_blank" rel="noopener noreferrer" className="text-th-link underline underline-offset-4">{file.name}</a>
              ))}
              {attempt.link_response && <a href={attempt.link_response} target="_blank" rel="noopener noreferrer" className="break-all text-th-link underline underline-offset-4">{attempt.link_response}</a>}
              {attempt.text_response && <p className="whitespace-pre-line">{attempt.text_response}</p>}
            </section>
          )}

          {runner.questions.map((q, i) => {
            const answer = runner.answers[q.id];
            const r = review.get(q.id);
            return (
              <section key={q.id} className={`${panel} flex flex-col gap-2`} aria-label={t("review.questionN", { n: i + 1 })}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-medium"><span className="font-display font-bold">{i + 1}.</span> {q.prompt}</h2>
                  <span className="text-sm text-th-muted">
                    {r?.is_correct === true && <span className="font-medium text-teal-text">{t("correct")} · </span>}
                    {r?.is_correct === false && <span className="font-medium text-vermilion">{t("incorrect")} · </span>}
                    {scoreText(r?.points_awarded ?? null, q.points, locale)}
                  </span>
                </div>
                {q.kind === "open" ? (
                  <p className="rounded-th bg-th-raised p-3 whitespace-pre-line">{answer?.text_answer || "—"}</p>
                ) : (
                  <ul className="flex flex-col gap-1 text-sm">
                    {q.choices.map((choice, ci) => {
                      const picked = answer?.choice_ids.includes(choice.id);
                      const right = r?.correct_choice_ids?.includes(choice.id);
                      return (
                        <li key={choice.id} className={picked ? "font-medium" : "text-th-muted"}>
                          {choiceLetter(ci)}. {choice.label}
                          {picked && ` · ${t("review.picked")}`}
                          {right && <span className="text-teal-text"> · {t("rightChoice")}</span>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
        <div className="xl:sticky xl:top-4">
          <ReviewForm
            attemptId={attemptId}
            assessmentId={id}
            isAssignment={isAssignment}
            maxScore={attempt.max_score === null ? null : Number(attempt.max_score)}
            currentScore={attempt.final_score === null ? null : Number(attempt.final_score)}
            feedback={attempt.feedback}
            openQuestions={runner.questions
              .map((q, i) => ({ q, n: i + 1 }))
              .filter(({ q }) => q.kind === "open")
              .map(({ q, n }) => ({ id: q.id, n, points: q.points, awarded: review.get(q.id)?.points_awarded ?? null }))}
          />
        </div>
      </div>
    </div>
  );
}
