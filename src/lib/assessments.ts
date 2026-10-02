// Client-safe types and helpers for assessments (PRD module 4).

export type AssessmentKind = "quiz" | "assignment";
export type QuestionKind = "single" | "multiple" | "true_false" | "open";

export type AttemptSummary = {
  id: string;
  attempt_number: number;
  status: "in_progress" | "submitted" | "reviewed";
  submitted_at: string | null;
  is_late: boolean;
  auto_score: number | null;
  final_score: number | null;
  max_score: number | null;
  feedback: string;
  reviewed_at: string | null;
  text_response: string;
  link_response: string;
};

export type StudentState = "upcoming" | "todo" | "in_progress" | "submitted" | "reviewed" | "missed";

export type StudentAssessment = {
  id: string;
  title: string;
  kind: AssessmentKind;
  instructions: string;
  opens_at: string;
  closes_at: string;
  max_attempts: number;
  show_answers: "after_submit" | "after_close" | "never";
  allow_late: boolean;
  activity: { id: string; title: string; starts_at: string } | null;
  attempts: AttemptSummary[];
  latest: AttemptSummary | null;
  attemptsLeft: number;
  state: StudentState;
  questionCount: number;
};

export type RunnerChoice = { id: string; label: string; position: number };
export type RunnerQuestion = {
  id: string;
  position: number;
  kind: QuestionKind;
  prompt: string;
  points: number;
  choices: RunnerChoice[];
};
export type RunnerAnswer = { choice_ids: string[]; text_answer: string };
export type SubmissionFile = { id: string; name: string; storage_path: string; size_bytes: number; mime_type: string };

export function studentState(
  a: { opens_at: string; closes_at: string; allow_late: boolean },
  latest: AttemptSummary | null,
  now = Date.now(),
): StudentState {
  if (latest?.status === "in_progress") return "in_progress";
  if (Date.parse(a.opens_at) > now) return "upcoming";
  if (latest?.status === "submitted") return "submitted";
  if (latest?.status === "reviewed") return "reviewed";
  if (Date.parse(a.closes_at) < now && !a.allow_late) return "missed";
  return "todo";
}

/** The student list groups from AS-5: to do, submitted, reviewed (closed ones sit with the reviewed). */
export function studentGroup(state: StudentState): "todo" | "submitted" | "reviewed" {
  if (state === "submitted") return "submitted";
  if (state === "reviewed" || state === "missed") return "reviewed";
  return "todo";
}

export function canStartAgain(a: StudentAssessment, now = Date.now()) {
  if (a.attemptsLeft <= 0 || a.state === "in_progress") return false;
  if (Date.parse(a.opens_at) > now) return false;
  return Date.parse(a.closes_at) >= now || a.allow_late;
}

/** "8/10", "8,5/10": scores without trailing zeros. */
export function scoreText(score: number | null, max: number | null, locale: string) {
  if (score === null) return "—";
  const format = (n: number) => n.toLocaleString(locale === "en" ? "en-GB" : "ro-RO", { maximumFractionDigits: 2 });
  return max === null ? format(score) : `${format(score)}/${format(max)}`;
}

export function isAnswered(question: RunnerQuestion, answer: RunnerAnswer | undefined) {
  if (!answer) return false;
  return question.kind === "open" ? answer.text_answer.trim().length > 0 : answer.choice_ids.length > 0;
}

export const choiceLetter = (index: number) => String.fromCharCode(65 + index);
