import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AssessmentEditor } from "@/components/assessments/assessment-editor";
import { PageHeader } from "@/components/page-header";
import { requireStaff } from "@/lib/auth";
import { getTheme } from "@/lib/theme";
import { defaultWindow, getEditorOptions } from "../editor-data";

export async function generateMetadata() {
  const t = await getTranslations("assessments");
  return { title: t("new") };
}

export default async function NewAssessmentPage() {
  const profile = await requireStaff();
  const locale = await getLocale();
  const [theme, t, options] = await Promise.all([getTheme(profile.theme), getTranslations("assessments"), getEditorOptions(locale)]);
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader variant={theme} logo="academy" kicker={<Link href="/app/assessments" className="hover:underline">← {t("title")}</Link>} title={t("new")} />
      <div className="px-4 py-6 sm:px-8">
        <AssessmentEditor initial={null} schools={options.schools} activities={options.activities} defaultWindow={defaultWindow()} />
      </div>
    </div>
  );
}
