import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  studentState,
  type AttemptSummary,
  type RunnerAnswer,
  type RunnerQuestion,
  type StudentAssessment,
  type SubmissionFile,
} from "@/lib/assessments";

const attemptColumns =
  "id, attempt_number, status, submitted_at, is_late, auto_score, final_score, max_score, feedback, reviewed_at, text_response, link_response";

type RawAssessment = {
  id: string;
  title: string;
  kind: StudentAssessment["kind"];
  instructions: string;
  opens_at: string;
  closes_at: string;
  max_attempts: number;
  show_answers: StudentAssessment["show_answers"];
  allow_late: boolean;
  activities: { id: string; title: string; starts_at: string } | null;
  attempts: AttemptSummary[];
  questions: { count: number }[];
};

/** A student's assessments with their attempts (RLS: published, for their school; only their own attempts). */
export const listStudentAssessments = cache(async (): Promise<StudentAssessment[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assessments")
    .select(
      `id, title, kind, instructions, opens_at, closes_at, max_attempts, show_answers, allow_late, activities(id, title, starts_at), attempts(${attemptColumns}), questions(count)`,
    )
    .eq("status", "published")
    .order("closes_at")
    .overrideTypes<RawAssessment[], { merge: false }>();

  const now = Date.now();
  return (data ?? []).map(({ activities, attempts, questions, ...row }) => {
    const sorted = [...attempts].sort((a, b) => a.attempt_number - b.attempt_number);
    const latest = sorted.at(-1) ?? null;
    return {
      ...row,
      activity: activities,
      attempts: sorted,
      latest,
      attemptsLeft: Math.max(0, row.max_attempts - sorted.length),
      state: studentState(row, latest, now),
      questionCount: questions[0]?.count ?? 0,
    };
  });
});

export type RunnerData = {
  questions: RunnerQuestion[];
  answers: Record<string, RunnerAnswer>;
  files: SubmissionFile[];
};

/** Questions (visible once the assessment opens), the student's saved answers and hand-in files. */
export async function getRunnerData(assessmentId: string, attemptId: string | null): Promise<RunnerData> {
  const supabase = await createClient();
  const [{ data: questions }, answers, files] = await Promise.all([
    supabase
      .from("questions")
      .select("id, position, kind, prompt, points, question_choices(id, label, position)")
      .eq("assessment_id", assessmentId)
      .order("position"),
    attemptId
      ? supabase.from("answers").select("question_id, choice_ids, text_answer").eq("attempt_id", attemptId)
      : Promise.resolve({ data: [] as { question_id: string; choice_ids: string[]; text_answer: string }[] }),
    attemptId
      ? supabase.from("submission_files").select("id, name, storage_path, size_bytes, mime_type").eq("attempt_id", attemptId).order("created_at")
      : Promise.resolve({ data: [] as SubmissionFile[] }),
  ]);

  return {
    questions: (questions ?? []).map(({ question_choices, ...q }) => ({
      ...q,
      points: Number(q.points),
      choices: [...question_choices].sort((a, b) => a.position - b.position),
    })),
    answers: Object.fromEntries((answers.data ?? []).map((a) => [a.question_id, { choice_ids: a.choice_ids, text_answer: a.text_answer }])),
    files: files.data ?? [],
  };
}

export type ReviewRow = { question_id: string; is_correct: boolean | null; points_awarded: number | null; correct_choice_ids: string[] | null };

export async function getAttemptReview(attemptId: string): Promise<Map<string, ReviewRow>> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("attempt_review", { target_attempt: attemptId });
  return new Map((data ?? []).map((row) => [row.question_id, { ...row, points_awarded: row.points_awarded === null ? null : Number(row.points_awarded) }]));
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

export type StaffAssessmentRow = {
  id: string;
  title: string;
  kind: StudentAssessment["kind"];
  status: "draft" | "published";
  opens_at: string;
  closes_at: string;
  schools: string[];
  submitted: number;
  toReview: number;
};

export async function listStaffAssessments(): Promise<StaffAssessmentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assessments")
    .select("id, title, kind, status, opens_at, closes_at, assessment_schools(schools(name)), attempts(status)")
    .order("closes_at", { ascending: false });
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    kind: row.kind,
    status: row.status as "draft" | "published",
    opens_at: row.opens_at,
    closes_at: row.closes_at,
    schools: row.assessment_schools.map((s) => s.schools?.name ?? "").filter(Boolean),
    submitted: row.attempts.filter((a) => a.status !== "in_progress").length,
    toReview: row.attempts.filter((a) => a.status === "submitted").length,
  }));
}

export type EditorQuestion = RunnerQuestion & { choices: (RunnerQuestion["choices"][number] & { correct: boolean })[] };

export type EditorData = {
  id: string;
  title: string;
  kind: StudentAssessment["kind"];
  instructions: string;
  activity_id: string | null;
  opens_at: string;
  closes_at: string;
  max_attempts: number;
  show_answers: StudentAssessment["show_answers"];
  allow_late: boolean;
  status: "draft" | "published";
  schoolIds: string[];
  questions: EditorQuestion[];
  attemptCount: number;
};

export async function getAssessmentForEditor(id: string): Promise<EditorData | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assessments")
    .select(
      "id, title, kind, instructions, activity_id, opens_at, closes_at, max_attempts, show_answers, allow_late, status, assessment_schools(school_id), attempts(count), questions(id, position, kind, prompt, points, question_choices(id, label, position, choice_keys(is_correct)))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const { assessment_schools, attempts, questions, ...row } = data;
  return {
    ...row,
    show_answers: row.show_answers as EditorData["show_answers"],
    status: row.status as EditorData["status"],
    schoolIds: assessment_schools.map((s) => s.school_id),
    attemptCount: attempts[0]?.count ?? 0,
    questions: [...questions]
      .sort((a, b) => a.position - b.position)
      .map(({ question_choices, ...q }) => ({
        ...q,
        points: Number(q.points),
        choices: [...question_choices]
          .sort((a, b) => a.position - b.position)
          .map(({ choice_keys, ...c }) => ({ ...c, correct: Boolean(choice_keys?.is_correct) })),
      })),
  };
}
