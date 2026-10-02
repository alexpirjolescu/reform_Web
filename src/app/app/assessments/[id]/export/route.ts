import { NextResponse } from "next/server";
import { getResults } from "@/lib/assessment-results";
import { getSession } from "@/lib/auth";
import { isStaffRole } from "@/lib/types";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  // Quote everything; neutralise spreadsheet formulas (=, +, -, @) in names and answers.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

/** CSV with one row per attempt (and one per student who has not started), for staff (AS-8). */
export async function GET(_request: Request, { params }: RouteContext<"/app/assessments/[id]/export">) {
  const { id } = await params;
  const session = await getSession();
  if (session.status !== "active" || !isStaffRole(session.profile.role)) return new NextResponse(null, { status: 403 });
  if (!uuid.test(id)) return new NextResponse(null, { status: 404 });
  const data = await getResults(id);
  if (!data) return new NextResponse(null, { status: 404 });

  const questions = data.assessment.questions;
  const header = ["school", "student", "attempt", "status", "submitted_at", "late", "score", "max_score", ...questions.map((_, i) => `q${i + 1}_points`), "feedback"];
  const pointsFor = (attemptId: string, questionId: string) =>
    data.answers.find((a) => a.attempt_id === attemptId && a.question_id === questionId)?.points_awarded ?? "";

  const lines = [header.map(cell).join(",")];
  for (const row of data.rows) {
    if (!row.attempts.length) {
      lines.push([row.schoolName, row.student.full_name, "", "not_started", "", "", "", "", ...questions.map(() => ""), ""].map(cell).join(","));
      continue;
    }
    for (const attempt of row.attempts) {
      lines.push(
        [
          row.schoolName,
          row.student.full_name,
          attempt.attempt_number,
          attempt.status,
          attempt.submitted_at ?? "",
          attempt.is_late ? "yes" : "no",
          attempt.final_score ?? "",
          attempt.max_score ?? "",
          ...questions.map((q) => pointsFor(attempt.id, q.id)),
          attempt.feedback,
        ]
          .map(cell)
          .join(","),
      );
    }
  }

  const name = data.assessment.title.normalize("NFKD").replace(/[^\w-]+/g, "-").slice(0, 60) || "results";
  return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
