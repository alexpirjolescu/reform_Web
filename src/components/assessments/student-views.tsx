import Link from "next/link";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/logo";
import {
  canStartAgain,
  choiceLetter,
  isAnswered,
  scoreText,
  studentGroup,
  type StudentAssessment,
} from "@/lib/assessments";
import type { ReviewRow, RunnerData } from "@/lib/assessments-server";
import { deadline, fullDate, shortDate } from "@/lib/format";
import type { Theme } from "@/lib/theme-shared";
import { AssignmentRunner } from "./assignment-runner";
import { QuizRunner } from "./quiz-runner";
import { StartForm } from "./start-form";

type T = Awaited<ReturnType<typeof getTranslations>>;
export type Tab = "todo" | "submitted" | "reviewed";

export type StudentScreenData = {
  list: StudentAssessment[];
  selected: StudentAssessment | null;
  runner: RunnerData | null;
  review: Map<string, ReviewRow> | null;
  tab: Tab;
  locale: string;
};

const groups: Tab[] = ["todo", "submitted", "reviewed"];

function grouped(list: StudentAssessment[]) {
  const map: Record<Tab, StudentAssessment[]> = { todo: [], submitted: [], reviewed: [] };
  for (const a of list) map[studentGroup(a.state)].push(a);
  return map;
}

function kicker(a: StudentAssessment, t: T, locale: string) {
  return a.activity ? t("assessments.afterMeeting", { date: fullDate(a.activity.starts_at, locale) }) : null;
}

function attemptLabel(a: StudentAssessment, t: T) {
  const n = a.latest?.status === "in_progress" ? a.latest.attempt_number : Math.min((a.latest?.attempt_number ?? 0) + 1, a.max_attempts);
  return t("assessments.attemptOf", { n, max: a.max_attempts });
}

function statusLine(a: StudentAssessment, t: T) {
  const kind = t(`assessments.kinds.${a.kind}`);
  switch (a.state) {
    case "in_progress":
      return `${kind} · ${t("assessments.state.in_progress")}`;
    case "upcoming":
      return `${kind} · ${t("assessments.state.upcoming")}`;
    case "submitted":
      return `${kind} · ${a.kind === "quiz" ? t("assessments.state.grading") : t("assessments.state.submitted")}`;
    case "reviewed":
      return isNewFeedback(a) ? t("assessments.newFeedback") : kind;
    case "missed":
      return `${kind} · ${t("assessments.state.missed")}`;
    default:
      return `${kind} · ${a.kind === "quiz" ? t("assessments.questionsCount", { count: a.questionCount }) : t("assessments.uploadTask")}`;
  }
}

function hasPassed(iso: string) {
  return Date.parse(iso) <= Date.now();
}

function isNewFeedback(a: StudentAssessment) {
  return Boolean(a.latest?.feedback && a.latest.reviewed_at && Date.now() - Date.parse(a.latest.reviewed_at) < 7 * 86_400_000);
}

function dueLine(a: StudentAssessment, t: T, locale: string) {
  if (a.state === "upcoming") return t("assessments.opensOn", { date: deadline(a.opens_at, locale) });
  if (a.state === "todo" || a.state === "in_progress") return t("assessments.closesOn", { date: deadline(a.closes_at, locale) });
  if (a.state === "submitted" && a.latest?.submitted_at) return t("assessments.handedInOn", { date: shortDate(a.latest.submitted_at, locale) });
  return null;
}

function Markdown({ children, dark }: { children: string; dark?: boolean }) {
  return (
    <div className={`prose-reform max-w-[70ch] text-base ${dark ? "text-night-body" : ""}`}>
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}

const startClass: Record<Theme, string> = {
  dark: "min-h-12 rounded-[2px] bg-teal px-6 font-display text-base font-semibold text-night disabled:opacity-60",
  white: "min-h-12 bg-ink px-6 font-display text-base font-semibold text-white disabled:opacity-60",
  color: "min-h-12 rounded-full border-2 border-ink bg-lavender px-6 font-display text-base font-bold text-white disabled:opacity-60",
};

/** Everything except the runner: intro before starting, hand-in receipt, results with feedback. */
async function DetailBody({ data, variant }: { data: StudentScreenData; variant: Theme }) {
  const t = await getTranslations();
  const a = data.selected;
  if (!a) return null;
  const { locale } = data;
  const muted = variant === "dark" ? "text-night-muted" : "text-muted";
  const panel = variant === "dark" ? "bg-night-2 p-5" : variant === "color" ? "rounded-[22px] border-2 border-ink p-5" : "border border-ink p-5";
  const latest = a.latest;
  const startLabel = a.state === "in_progress" ? t("assessments.resume") : latest ? t("assessments.tryAgain") : a.kind === "quiz" ? t("assessments.startQuiz") : t("assessments.startAssignment");

  const meta = (
    <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
      <dt className={muted}>{t("assessments.opens")}</dt>
      <dd>{deadline(a.opens_at, locale)}</dd>
      <dt className={muted}>{t("assessments.closes")}</dt>
      <dd>{deadline(a.closes_at, locale)}{a.allow_late ? ` · ${t("assessments.lateAllowed")}` : ""}</dd>
      <dt className={muted}>{t("assessments.attempts")}</dt>
      <dd>{t("assessments.attemptsUsed", { used: a.attempts.length, max: a.max_attempts })}</dd>
      {a.kind === "quiz" && a.questionCount > 0 && (
        <>
          <dt className={muted}>{t("assessments.questions")}</dt>
          <dd>{a.questionCount}</dd>
        </>
      )}
    </dl>
  );

  const startButton = canStartAgain(a) && (a.state === "todo" || a.state === "reviewed" || a.state === "submitted") && (
    <StartForm assessmentId={a.id} label={startLabel} className={startClass[variant]} />
  );

  // Results and receipts --------------------------------------------------
  let outcome: ReactNode = null;
  if (latest && latest.status !== "in_progress") {
    const reviewed = latest.status === "reviewed";
    outcome = (
      <div className={`flex flex-col gap-4 ${panel}`}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className={`text-[13px] ${muted}`}>
              {t("assessments.handedInOn", { date: latest.submitted_at ? deadline(latest.submitted_at, locale) : "—" })}
              {latest.is_late && ` · ${t("assessments.late")}`}
            </p>
            <p className="mt-1 font-display text-xl font-bold">{reviewed ? t("assessments.reviewedTitle") : t("assessments.waitingTitle")}</p>
          </div>
          {reviewed && (
            <span className={variant === "color" ? "font-fun text-[56px] leading-none font-bold" : "font-display text-[44px] leading-none font-extrabold"}>
              {scoreText(latest.final_score, latest.max_score, locale)}
            </span>
          )}
        </div>
        {latest.feedback && (
          <blockquote className={`border-l-4 pl-4 text-base leading-relaxed ${variant === "dark" ? "border-teal" : variant === "color" ? "border-lime" : "border-teal"}`}>
            „{latest.feedback}”
          </blockquote>
        )}
        {!reviewed && <p className="text-sm">{t("assessments.waitingBody")}</p>}
      </div>
    );
  }

  const answersReview =
    a.kind === "quiz" && latest && latest.status !== "in_progress" && data.runner && data.runner.questions.length > 0 ? (
      <section aria-labelledby="your-answers" className="flex flex-col gap-3">
        <h3 id="your-answers" className="font-display text-lg font-bold">{t("assessments.yourAnswers")}</h3>
        <ol className="flex flex-col gap-3">
          {data.runner.questions.map((q, i) => {
            const answer = data.runner?.answers[q.id];
            const review = data.review?.get(q.id);
            const verdict =
              review?.is_correct === true ? t("assessments.correct") : review?.is_correct === false ? t("assessments.incorrect") : null;
            return (
              <li key={q.id} className={`flex flex-col gap-2 ${panel}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <span className="font-medium">{i + 1}. {q.prompt}</span>
                  <span className={`text-[13px] ${muted}`}>
                    {verdict && <span className={review?.is_correct ? "font-medium text-teal-text" : "font-medium text-vermilion"}>{verdict}</span>}
                    {review?.points_awarded !== null && review?.points_awarded !== undefined && ` · ${scoreText(review.points_awarded, q.points, locale)}`}
                  </span>
                </div>
                {q.kind === "open" ? (
                  <p className="text-sm whitespace-pre-line">{answer?.text_answer || "—"}</p>
                ) : (
                  <ul className="flex flex-col gap-1 text-sm">
                    {q.choices.map((choice, ci) => {
                      const picked = answer?.choice_ids.includes(choice.id);
                      const right = review?.correct_choice_ids?.includes(choice.id);
                      return (
                        <li key={choice.id} className={`flex gap-2 ${picked ? "font-medium" : muted}`}>
                          <span className="w-4 font-display font-bold">{choiceLetter(ci)}</span>
                          <span>{choice.label}</span>
                          {picked && <span>· {t("assessments.yourChoice")}</span>}
                          {right && <span className="text-teal-text">· {t("assessments.rightChoice")}</span>}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {!isAnswered(q, answer) && <span className={`text-xs ${muted}`}>{t("assessments.notAnswered")}</span>}
              </li>
            );
          })}
        </ol>
        {a.show_answers === "after_close" && !hasPassed(a.closes_at) && (
          <p className={`text-[13px] ${muted}`}>{t("assessments.answersAfterClose", { date: deadline(a.closes_at, locale) })}</p>
        )}
      </section>
    ) : null;

  const handIn =
    a.kind === "assignment" && latest && latest.status !== "in_progress" && data.runner ? (
      <section aria-labelledby="your-handin" className="flex flex-col gap-2 text-sm">
        <h3 id="your-handin" className="font-display text-lg font-bold">{t("assessments.yourHandIn")}</h3>
        {data.runner.files.map((file) => (
          <a key={file.id} href={`/app/assessments/file/${file.id}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{file.name}</a>
        ))}
        {latest.link_response && <a href={latest.link_response} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 break-all">{latest.link_response}</a>}
        {latest.text_response && <p className="whitespace-pre-line">{latest.text_response}</p>}
      </section>
    ) : null;

  return (
    <div className="flex max-w-[780px] flex-col gap-6">
      {outcome}
      {a.state === "upcoming" && <p className={`${panel} text-base`}>{t("assessments.upcomingBody", { date: deadline(a.opens_at, locale) })}</p>}
      {a.state === "missed" && <p className={`${panel} text-base`}>{t("assessments.missedBody")}</p>}
      {a.instructions && (!latest || a.state === "todo") && <Markdown dark={variant === "dark"}>{a.instructions}</Markdown>}
      {(!latest || a.state === "todo" || a.state === "upcoming") && meta}
      {startButton}
      {answersReview}
      {handIn}
    </div>
  );
}

/** The runner for an attempt in progress, drawn for the given design. */
function Runner({ data, variant, t, asideTop, asideBottom }: { data: StudentScreenData; variant: Theme; t: T; asideTop?: ReactNode; asideBottom?: ReactNode }) {
  const a = data.selected;
  if (!a || a.state !== "in_progress" || !a.latest || !data.runner) return null;
  const { locale } = data;
  if (a.kind === "assignment") {
    return (
      <AssignmentRunner
        variant={variant}
        attemptId={a.latest.id}
        initialText={a.latest.text_response}
        initialLink={a.latest.link_response}
        initialFiles={data.runner.files}
        header={a.instructions ? <Markdown dark={variant === "dark"}>{a.instructions}</Markdown> : undefined}
      />
    );
  }
  return (
    <QuizRunner
      variant={variant}
      attemptId={a.latest.id}
      title={a.title}
      kicker={kicker(a, t, locale)}
      closesLabel={t("assessments.closesOn", { date: deadline(a.closes_at, locale) })}
      attemptLabel={attemptLabel(a, t)}
      questions={data.runner.questions}
      initialAnswers={data.runner.answers}
      asideTop={asideTop}
      asideBottom={asideBottom}
    />
  );
}

const href = (a: StudentAssessment) => `/app/assessments/${a.id}`;

// ---------------------------------------------------------------------------
// A · Dark studio: list column + runner
// ---------------------------------------------------------------------------
export async function StudentDark({ data }: { data: StudentScreenData }) {
  const t = await getTranslations();
  const g = grouped(data.list);
  const a = data.selected;
  const quizRunning = a?.state === "in_progress" && a.kind === "quiz";

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <nav aria-label={t("assessments.mine")} className="flex shrink-0 flex-col gap-[22px] overflow-auto border-b border-night-line px-[18px] py-[26px] md:w-[300px] md:border-r md:border-b-0">
        <h1 className="font-display text-[36px] font-bold text-teal">{t("assessments.title")}</h1>
        {data.list.length === 0 && <p className="text-sm text-night-muted">{t("assessments.emptyStudent")}</p>}
        {groups.map((group) =>
          g[group].length ? (
            <div key={group} className="flex flex-col gap-2">
              <h2 className="text-xs text-night-muted">{t(`assessments.groups.${group}`)} · {g[group].length}</h2>
              {g[group].map((item) => {
                const active = item.id === a?.id;
                const reviewed = item.state === "reviewed";
                return (
                  <Link key={item.id} href={href(item)} aria-current={active ? "true" : undefined}
                    className={`flex items-center gap-3 p-3.5 ${active ? "border-t-[3px] border-teal bg-night-4" : "bg-night-2 hover:bg-night-4"}`}>
                    <span className="flex flex-1 flex-col gap-1.5">
                      <span className={`text-xs ${active ? "text-teal" : isNewFeedback(item) ? "text-honey" : "text-night-muted"}`}>{statusLine(item, t)}</span>
                      <span className="font-display text-base font-semibold">{item.title}</span>
                      {dueLine(item, t, data.locale) && <span className="text-xs text-night-soft">{dueLine(item, t, data.locale)}</span>}
                    </span>
                    {reviewed && <span className="font-display text-[22px] font-bold">{scoreText(item.latest?.final_score ?? null, item.latest?.max_score ?? null, data.locale)}</span>}
                  </Link>
                );
              })}
            </div>
          ) : null,
        )}
      </nav>
      <div className="flex min-w-0 flex-1 flex-col gap-[26px] overflow-auto px-4 py-8 sm:px-12">
        {!a && <p className="text-night-muted">{t("assessments.pickOne")}</p>}
        {a && !quizRunning && (
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0 flex-[1_1_320px]">
              {kicker(a, t, data.locale) && <p className="mb-2 text-[13px] text-teal">_ {kicker(a, t, data.locale)}</p>}
              <h2 className="font-display text-[30px] font-bold">{a.title}</h2>
            </div>
            {(a.state === "todo" || a.state === "in_progress") && (
              <div className="shrink-0 text-[13px] leading-relaxed text-night-soft sm:text-right">
                {t("assessments.closesOn", { date: deadline(a.closes_at, data.locale) })}
                <br />
                {attemptLabel(a, t)} · {t("assessments.noTimeLimit")}
              </div>
            )}
          </div>
        )}
        {a?.state === "in_progress" ? <Runner data={data} variant="dark" t={t} /> : <DetailBody data={data} variant="dark" />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// B · White paper: assessment sheet on the left, one big question on the right
// ---------------------------------------------------------------------------
export async function StudentWhite({ data }: { data: StudentScreenData }) {
  const t = await getTranslations();
  const a = data.selected;
  const others = data.list.filter((item) => item.id !== a?.id);

  const asideTop = a ? (
    <>
      <div>
        <p className="mb-1.5 text-[13px] font-medium text-teal-text">_ {t(`assessments.kinds.${a.kind}`)}{a.activity ? ` · ${t("assessments.afterMeetingShort", { date: shortDate(a.activity.starts_at, data.locale) })}` : ""}</p>
        <h1 className="font-display text-[28px] leading-[1.1] font-extrabold">{a.title}</h1>
      </div>
      <dl className="flex flex-col text-sm">
        <div className="flex justify-between gap-3 border-t border-line py-2"><dt className="text-muted">{t("assessments.closes")}</dt><dd className="text-right">{deadline(a.closes_at, data.locale)}</dd></div>
        <div className="flex justify-between gap-3 border-t border-line py-2"><dt className="text-muted">{t("assessments.attempt")}</dt><dd>{t("assessments.attemptShort", { n: Math.max(1, a.latest?.attempt_number ?? 1), max: a.max_attempts })}</dd></div>
        <div className="flex justify-between gap-3 border-y border-line py-2"><dt className="text-muted">{t("assessments.time")}</dt><dd>{t("assessments.noLimit")}</dd></div>
      </dl>
    </>
  ) : (
    <h1 className="font-display text-[36px] font-extrabold">{t("assessments.title")}</h1>
  );

  const asideBottom = (
    <div>
      <h2 className="mb-1 font-display text-base font-bold">{a ? t("assessments.others") : t("assessments.mine")}</h2>
      {(a ? others : data.list).map((item) => (
        <Link key={item.id} href={href(item)} className="flex justify-between gap-2.5 border-b border-line py-2.5 text-sm hover:underline">
          <span>{t(`assessments.kindPrefix.${item.kind}`)}: {item.title}</span>
          <span className={`whitespace-nowrap ${item.state === "reviewed" ? "font-semibold" : "text-muted"}`}>
            {item.state === "reviewed"
              ? `${scoreText(item.latest?.final_score ?? null, item.latest?.max_score ?? null, data.locale)}${item.latest?.feedback ? ` · ${t("assessments.feedback")}` : ""}`
              : item.state === "submitted"
                ? t("assessments.state.submitted")
                : shortDate(item.closes_at, data.locale)}
          </span>
        </Link>
      ))}
      {data.list.length === 0 && <p className="text-sm text-muted">{t("assessments.emptyStudent")}</p>}
    </div>
  );

  if (a?.state === "in_progress" && a.kind === "quiz") {
    return <Runner data={data} variant="white" t={t} asideTop={asideTop} asideBottom={asideBottom} />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col gap-[26px] overflow-auto border-b border-ink p-[26px] md:w-[300px] md:border-r md:border-b-0">
        {asideTop}
        {asideBottom}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-7 overflow-auto px-4 py-10 sm:px-16">
        {!a ? (
          <p className="text-muted">{t("assessments.pickOne")}</p>
        ) : (
          <>
            <div className="flex items-baseline gap-[18px] border-b-2 border-ink pb-3.5">
              <span className="font-display text-[40px] leading-[0.9] font-extrabold text-teal-strong">{t(`assessments.groups.${studentGroup(a.state)}`)}</span>
              {dueLine(a, t, data.locale) && <span className="text-sm text-muted">{dueLine(a, t, data.locale)}</span>}
            </div>
            {a.state === "in_progress" ? <Runner data={data} variant="white" t={t} /> : <DetailBody data={data} variant="white" />}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// C · Colour system: lavender assessment card + feedback sticker and "next up" list
// ---------------------------------------------------------------------------
export async function StudentColor({ data }: { data: StudentScreenData }) {
  const t = await getTranslations();
  const g = grouped(data.list);
  const a = data.selected;
  const feedback = data.list
    .filter((item) => item.state === "reviewed" && item.latest?.feedback)
    .sort((x, y) => Date.parse(y.latest?.reviewed_at ?? "") - Date.parse(x.latest?.reviewed_at ?? ""))[0];
  const tabItems = g[data.tab].filter((item) => item.id !== a?.id);
  const selectedHref = a ? href(a) : "/app/assessments";

  const card = a && (a.state !== "in_progress" || a.kind === "assignment") && (
    <section className="overflow-hidden rounded-[28px] border-2 border-ink">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-ink bg-lavender px-[26px] py-5 text-white">
        <div>
          <div className="text-[13px]">{t(`assessments.kinds.${a.kind}`)}{kicker(a, t, data.locale) ? ` · ${kicker(a, t, data.locale)}` : ""}</div>
          <h2 className="mt-1 font-display text-[26px] font-extrabold">{a.title}</h2>
        </div>
        {a.state === "reviewed" ? (
          <span className="font-fun text-[44px] leading-none font-bold">{scoreText(a.latest?.final_score ?? null, a.latest?.max_score ?? null, data.locale)}</span>
        ) : (
          dueLine(a, t, data.locale) && <span className="rounded-full border-2 border-ink bg-white px-3 py-1 text-[13px] font-medium text-ink">{dueLine(a, t, data.locale)}</span>
        )}
      </div>
      <div className="px-[26px] pt-6 pb-[26px]">
        {a.state === "in_progress" ? <Runner data={data} variant="color" t={t} /> : <DetailBody data={data} variant="color" />}
      </div>
    </section>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-4 pt-6 pb-7 sm:px-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <Logo name="academy" height={30} />
          <h1 className="font-display text-[36px] font-extrabold tracking-[-0.02em]">{t("assessments.title")}</h1>
        </div>
        <nav aria-label={t("assessments.filter")} className="flex flex-wrap gap-1.5">
          {groups.map((group) => (
            <Link key={group} href={`${selectedHref}?tab=${group}`} aria-current={data.tab === group ? "true" : undefined}
              className={`flex h-10 items-center rounded-full border-2 border-ink px-4 text-sm ${data.tab === group ? "bg-ink text-white" : "bg-white"}`}>
              {t(`assessments.groups.${group}`)} · {g[group].length}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex flex-wrap items-start gap-5">
        <div className="min-w-0 flex-[1_1_520px]">
          {!a && <p className="rounded-[28px] border-2 border-dashed border-ink p-8 text-muted">{data.list.length ? t("assessments.pickOne") : t("assessments.emptyStudent")}</p>}
          {a?.state === "in_progress" && a.kind === "quiz" ? <Runner data={data} variant="color" t={t} /> : card}
        </div>
        <div className="flex flex-[0_1_300px] flex-col gap-4">
          {feedback && (
            <Link href={href(feedback)} className="flex flex-col gap-2 rounded-3xl border-2 border-ink bg-lime px-[22px] py-5">
              {isNewFeedback(feedback) && <span className="self-start rounded-full border-[1.5px] border-ink bg-white px-2.5 py-0.5 text-xs font-semibold">{t("assessments.newFeedback")}</span>}
              <span className="font-fun text-[56px] leading-none font-bold">{scoreText(feedback.latest?.final_score ?? null, feedback.latest?.max_score ?? null, data.locale)}</span>
              <span className="font-display text-lg font-bold">{t(`assessments.kindPrefix.${feedback.kind}`)}: {feedback.title}</span>
              <span className="line-clamp-3 text-sm leading-normal">„{feedback.latest?.feedback}”</span>
            </Link>
          )}
          <div className="flex flex-col gap-3 rounded-3xl border-2 border-ink px-5 py-[18px]">
            <h2 className="font-display text-lg font-extrabold">{data.tab === "todo" ? t("assessments.nextUp") : t(`assessments.groups.${data.tab}`)}</h2>
            {tabItems.length === 0 && <p className="text-sm text-muted">{t("assessments.nothingHere")}</p>}
            {tabItems.map((item) => (
              <Link key={item.id} href={`${href(item)}?tab=${data.tab}`} className="flex items-center gap-3 hover:underline">
                <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-xl border-2 border-ink font-fun font-bold ${item.kind === "assignment" ? "bg-honey" : "bg-white"}`}>
                  {item.state === "reviewed" ? Math.round(item.latest?.final_score ?? 0) : item.kind === "assignment" ? "↑" : "?"}
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{t(`assessments.kindPrefix.${item.kind}`)}: {item.title}</span>
                  <span className="text-xs text-muted">{statusLine(item, t)}{dueLine(item, t, data.locale) ? ` · ${dueLine(item, t, data.locale)}` : ""}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
