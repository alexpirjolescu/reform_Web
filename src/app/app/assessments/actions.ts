"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/form";
import { requireProfile, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Student: start (or resume) an attempt, then open the runner. */
export async function startAttempt(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile();
  const id = z.uuid().safeParse(formData.get("assessmentId"));
  if (!id.success) return { error: "assessments.errors.generic" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_attempt", { target: id.data });
  if (error) {
    const key =
      error.message === "no attempts left" ? "noAttempts" : error.message === "closed" ? "closed" : error.message === "not open yet" ? "notOpen" : "generic";
    return { error: `assessments.errors.${key}` };
  }
  revalidatePath("/app/assessments", "layout");
  redirect(`/app/assessments/${id.data}`);
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

const choiceSchema = z.object({ label: z.string().trim().min(1).max(500), correct: z.boolean() });
const questionSchema = z
  .object({
    kind: z.enum(["single", "multiple", "true_false", "open"]),
    prompt: z.string().trim().min(1).max(2000),
    points: z.number().min(0).max(1000),
    choices: z.array(choiceSchema).max(12),
  })
  .refine((q) => {
    if (q.kind === "open") return q.choices.length === 0;
    const correct = q.choices.filter((c) => c.correct).length;
    if (q.choices.length < 2) return false;
    return q.kind === "multiple" ? correct >= 1 : correct === 1;
  });

const assessmentSchema = z
  .object({
    id: z.uuid().nullable(),
    title: z.string().trim().min(3).max(160),
    kind: z.enum(["quiz", "assignment"]),
    instructions: z.string().max(20000),
    activity_id: z.uuid().nullable(),
    opens_at: z.iso.datetime({ offset: true }),
    closes_at: z.iso.datetime({ offset: true }),
    max_attempts: z.number().int().min(1).max(10),
    show_answers: z.enum(["after_submit", "after_close", "never"]),
    allow_late: z.boolean(),
    status: z.enum(["draft", "published"]),
    school_ids: z.array(z.uuid()).max(100),
    questions: z.array(questionSchema).max(100),
  })
  .refine((a) => Date.parse(a.closes_at) > Date.parse(a.opens_at), { path: ["closes_at"], message: "window" })
  .refine((a) => a.status === "draft" || a.school_ids.length > 0, { path: ["school_ids"], message: "schools" })
  .refine((a) => a.status === "draft" || a.kind === "assignment" || a.questions.length > 0, { path: ["questions"], message: "questions" });

/** Staff: create or update an assessment with its schools and questions (one transaction in save_assessment). */
export async function saveAssessment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { error: "assessments.editor.errors.invalid" };
  }
  const parsed = assessmentSchema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const key =
      issue?.message === "window"
        ? "window"
        : issue?.message === "schools"
          ? "schools"
          : issue?.message === "questions"
            ? "questions"
            : issue?.path[0] === "questions"
              ? "question"
              : "invalid";
    const n = issue?.path[0] === "questions" && typeof issue.path[1] === "number" ? String(issue.path[1] + 1) : "";
    return { error: `assessments.editor.errors.${key}`, errorValues: { n } };
  }

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("save_assessment", { payload: parsed.data });
  if (error || !id) return { error: "assessments.editor.errors.saveFailed", errorValues: { detail: error?.message ?? "" } };

  revalidatePath("/app/assessments", "layout");
  redirect(`/app/assessments/${id}/results`);
}

export async function deleteAssessment(formData: FormData) {
  await requireStaff();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from("assessments").delete().eq("id", id.data);
  revalidatePath("/app/assessments", "layout");
  redirect("/app/assessments");
}

const reviewSchema = z.object({
  attemptId: z.uuid(),
  assessmentId: z.uuid(),
  feedback: z.string().max(8000).default(""),
  score: z.union([z.literal(""), z.coerce.number().min(0).max(100000)]),
});

/** Staff: score open answers and hand-ins, add feedback (AS-6). */
export async function reviewAttempt(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "assessments.review.errors.invalid" };

  const openPoints: Record<string, number> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("points:") || value === "") continue;
    const points = Number(value);
    const questionId = key.slice("points:".length);
    if (Number.isFinite(points) && z.uuid().safeParse(questionId).success) openPoints[questionId] = points;
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_attempt", {
    target_attempt: parsed.data.attemptId,
    open_points: openPoints,
    // null lets the function add up the points; a number overrides the total (e.g. for hand-ins).
    score: parsed.data.score === "" ? (null as unknown as number) : parsed.data.score,
    feedback_text: parsed.data.feedback,
  });
  if (error) return { error: "assessments.review.errors.saveFailed", errorValues: { detail: error.message } };

  revalidatePath(`/app/assessments/${parsed.data.assessmentId}`, "layout");
  return { message: "assessments.review.saved", done: Date.now() };
}
