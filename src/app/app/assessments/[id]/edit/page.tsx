import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { AssessmentEditor } from "@/components/assessments/assessment-editor";
import { PageHeader } from "@/components/page-header";
import { getAssessmentForEditor } from "@/lib/assessments-server";
import { requireStaff } from "@/lib/auth";
import { getTheme } from "@/lib/theme";
import { defaultWindow, getEditorOptions } from "../../editor-data";

export default async function EditAssessmentPage({ params }: PageProps<"/app/assessments/[id]/edit">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const profile = await requireStaff();
  const locale = await getLocale();
  const [theme, t, options, initial] = await Promise.all([
    getTheme(profile.theme),
    getTranslations("assessments"),
    getEditorOptions(locale),
    getAssessmentForEditor(id),
  ]);
  if (!initial) notFound();
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader variant={theme} logo="academy" kicker={<Link href={`/app/assessments/${id}/results`} className="hover:underline">← {initial.title}</Link>} title={t("edit")} />
      <div className="px-4 py-6 sm:px-8">
        <AssessmentEditor initial={initial} schools={options.schools} activities={options.activities} defaultWindow={defaultWindow()} />
      </div>
    </div>
  );
}
