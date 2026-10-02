import { notFound, redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { listStudentAssessments } from "@/lib/assessments-server";
import { requireProfile } from "@/lib/auth";
import { getTheme } from "@/lib/theme";
import { isStaffRole } from "@/lib/types";
import { StudentScreen } from "../student-screen";

export async function generateMetadata({ params }: PageProps<"/app/assessments/[id]">) {
  const { id } = await params;
  const profile = await requireProfile();
  if (isStaffRole(profile.role) || !z.uuid().safeParse(id).success) return {};
  const list = await listStudentAssessments();
  return { title: list.find((a) => a.id === id)?.title };
}

export default async function AssessmentPage({ params, searchParams }: PageProps<"/app/assessments/[id]">) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();
  const profile = await requireProfile();
  if (isStaffRole(profile.role)) redirect(`/app/assessments/${id}/results`);
  const [theme, locale, list] = await Promise.all([getTheme(profile.theme), getLocale(), listStudentAssessments()]);
  if (!list.some((a) => a.id === id)) notFound();
  return <StudentScreen selectedId={id} tab={typeof tab === "string" ? tab : undefined} theme={theme} locale={locale} />;
}
