import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ForgotPasswordForm } from "./forgot-password-form";

export async function generateMetadata() {
  const t = await getTranslations("auth.forgot");
  return { title: t("title") };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth.forgot");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-5xl font-extrabold tracking-tight">{t("title")}</h1>
        <p className="text-th-muted">{t("intro")}</p>
      </div>
      <ForgotPasswordForm />
      <Link href="/auth/login" className="ui-btn ui-plain -ml-2.5 self-start">
        {t("back")}
      </Link>
    </div>
  );
}
