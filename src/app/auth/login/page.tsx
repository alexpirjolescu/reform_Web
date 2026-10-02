import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "./login-form";

export async function generateMetadata() {
  const t = await getTranslations("auth.login");
  return { title: t("title") };
}

export default async function LoginPage({ searchParams }: PageProps<"/auth/login">) {
  const [{ next }, t] = await Promise.all([searchParams, getTranslations("auth.login")]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-5xl font-extrabold tracking-tight">{t("title")}</h1>
      <LoginForm next={typeof next === "string" ? next : undefined} />
      <Link href="/auth/forgot-password" className="text-th-link underline underline-offset-4">
        {t("forgot")}
      </Link>
      <p className="text-sm leading-relaxed text-th-muted">{t("noAccount")}</p>
    </div>
  );
}
