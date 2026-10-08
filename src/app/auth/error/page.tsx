import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function AuthErrorPage() {
  const t = await getTranslations("auth.error");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-5xl font-extrabold tracking-tight">{t("title")}</h1>
      <p className="leading-relaxed">{t("body")}</p>
      <Link href="/auth/forgot-password" className="ui-btn ui-plain -ml-2.5 self-start">
        {t("retry")}
      </Link>
    </div>
  );
}
