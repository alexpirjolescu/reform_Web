import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ActivityEditor } from "@/components/news/activity-editor";
import { PageHeader } from "@/components/page-header";
import { requireStaff } from "@/lib/auth";
import { getTheme } from "@/lib/theme";
import { defaultStart, getSchools, mediaBase } from "../editor-data";

export default async function NewActivityPage() {
  const profile = await requireStaff();
  const [theme, t, schools] = await Promise.all([getTheme(profile.theme), getTranslations("adminNews"), getSchools()]);
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader variant={theme} kicker={<Link href="/app/admin/news" className="hover:underline">← {t("pageTitle")}</Link>} title={t("new")} />
      <div className="px-4 py-6 sm:px-8">
        <ActivityEditor initial={null} schools={schools} defaultStart={defaultStart()} mediaBase={mediaBase} theme={theme} />
      </div>
    </div>
  );
}
