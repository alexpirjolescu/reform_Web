import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth";
import { SetPasswordLinkCheck } from "@/components/auth-link-handler";
import { SetPasswordForm } from "./set-password-form";

export async function generateMetadata() {
  const t = await getTranslations("auth.setPassword");
  return { title: t("title") };
}

// Reached from the invite or reset email, after /auth/confirm (or AuthLinkHandler) has signed the person in.
export default async function SetPasswordPage({ searchParams }: PageProps<"/auth/set-password">) {
  const [session, t, { code }] = await Promise.all([getSession(), getTranslations("auth.setPassword"), searchParams]);
  // Older reset links come back here with a one-time code: exchange it first.
  if (session.status === "signed-out" && typeof code === "string") {
    redirect(`/auth/confirm?code=${encodeURIComponent(code)}&next=/auth/set-password`);
  }
  if (session.status === "signed-out") return <SetPasswordLinkCheck label={t("checking")} />;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-5xl font-extrabold tracking-tight">{t("title")}</h1>
        <p className="text-th-muted">{t("intro")}</p>
      </div>
      <SetPasswordForm />
    </div>
  );
}
