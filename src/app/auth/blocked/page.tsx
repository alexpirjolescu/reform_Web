import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth";
import { signOut } from "../actions";

// Signed in, but the account has no profile yet or has been deactivated.
export default async function BlockedPage() {
  const session = await getSession();
  if (session.status === "signed-out") redirect("/auth/login");
  if (session.status === "active") redirect("/app");

  const t = await getTranslations();

  return (
    <div className="flex flex-col gap-6">
      <p className="text-lg leading-relaxed">
        {session.status === "deactivated" ? t("auth.deactivated") : t("auth.noProfile")}
      </p>
      <form action={signOut}>
        <button type="submit" className="min-h-12 border border-ink px-6 font-display font-semibold">
          {t("common.logout")}
        </button>
      </form>
    </div>
  );
}
