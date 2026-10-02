import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth";
import { SetPasswordForm } from "./set-password-form";

export async function generateMetadata() {
  const t = await getTranslations("auth.setPassword");
  return { title: t("title") };
}

// Reached from the invite or reset email, after /auth/confirm has signed the person in.
export default async function SetPasswordPage() {
  const session = await getSession();
  if (session.status === "signed-out") redirect("/auth/error");

  const t = await getTranslations("auth.setPassword");

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
