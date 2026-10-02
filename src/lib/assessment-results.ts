import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ResultsData = NonNullable<Awaited<ReturnType<typeof getResults>>>;

/** Staff view of one assessment: every targeted student with their attempts, plus per-question numbers (AS-8). */
export async function getResults(id: string) {
  const supabase = await createClient();
  const { data: assessment } = await supabase
    .from("assessments")
    .select("id, title, kind, status, opens_at, closes_at, max_attempts, assessment_schools(school_id, schools(name)), questions(id, position, kind, prompt, points)")
    .eq("id", id)
    .maybeSingle();
  if (!assessment) return null;

  const schoolIds = assessment.assessment_schools.map((s) => s.school_id);
  const schoolNames = new Map(assessment.assessment_schools.map((s) => [s.school_id, s.schools?.name ?? ""]));

  const [{ data: students }, { data: attempts }, { data: answers }] = await Promise.all([
    schoolIds.length
      ? supabase
          .from("profiles")
          .select("id, full_name, school_id")
          .in("school_id", schoolIds)
          .in("role", ["student", "core_lead"])
          .is("deactivated_at", null)
          .order("full_name")
      : Promise.resolve({ data: [] as { id: string; full_name: string; school_id: string | null }[] }),
    supabase
      .from("attempts")
      .select("id, student_id, attempt_number, status, submitted_at, is_late, auto_score, final_score, max_score, feedback, reviewed_at")
      .eq("assessment_id", id)
      .order("attempt_number"),
    supabase
      .from("answers")
      .select("attempt_id, question_id, is_correct, points_awarded, text_answer, attempts!inner(assessment_id, status)")
      .eq("attempts.assessment_id", id)
      .neq("attempts.status", "in_progress"),
  ]);

  const questions = [...assessment.questions].sort((a, b) => a.position - b.position).map((q) => ({ ...q, points: Number(q.points) }));
  const byStudent = new Map<string, NonNullable<typeof attempts>>();
  for (const attempt of attempts ?? []) byStudent.set(attempt.student_id, [...(byStudent.get(attempt.student_id) ?? []), attempt]);

  // Students from the targeted schools, plus anyone who attempted it while their school was targeted.
  const known = new Map((students ?? []).map((s) => [s.id, s]));
  const missingIds = [...byStudent.keys()].filter((sid) => !known.has(sid));
  if (missingIds.length) {
    const { data: extra } = await supabase.from("profiles").select("id, full_name, school_id").in("id", missingIds);
    for (const s of extra ?? []) known.set(s.id, s);
  }

  const rows = [...known.values()]
    .map((student) => {
      const list = byStudent.get(student.id) ?? [];
      return {
        student,
        schoolName: (student.school_id && schoolNames.get(student.school_id)) || "",
        attempts: list,
        latest: list.at(-1) ?? null,
      };
    })
    .sort((a, b) => a.schoolName.localeCompare(b.schoolName, "ro") || a.student.full_name.localeCompare(b.student.full_name, "ro"));

  const questionStats = questions.map((q) => {
    const rowsForQ = (answers ?? []).filter((a) => a.question_id === q.id);
    const correct = rowsForQ.filter((a) => a.is_correct).length;
    const scored = rowsForQ.filter((a) => a.points_awarded !== null);
    const avg = scored.length ? scored.reduce((sum, a) => sum + Number(a.points_awarded), 0) / scored.length : null;
    return { question: q, answered: rowsForQ.length, correct, average: avg };
  });

  return {
    assessment: { ...assessment, questions },
    schoolNames,
    rows,
    questionStats,
    answers: answers ?? [],
  };
}
