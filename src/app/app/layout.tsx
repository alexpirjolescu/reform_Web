import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { requireProfile } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { signOut } from "../auth/actions";
import { AppNav } from "./app-nav";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const t = await getTranslations();

  if (!hasSupabaseEnv) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <h1 className="mb-4 font-display text-4xl font-extrabold">{t("setup.title")}</h1>
        <p className="leading-relaxed">{t("setup.body")}</p>
      </main>
    );
  }

  const profile = await requireProfile();
  const initials = profile.full_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <aside className="flex flex-col gap-8 border-b border-line p-5 md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <Link href="/app" aria-label="re_form platform">
          <Logo variant="platform" height={38} />
        </Link>
        <AppNav isAdmin={profile.role === "admin"} />
        <div className="mt-auto flex flex-col gap-4 text-sm">
          <Link href="/" className="text-muted hover:text-ink">
            {t("common.newsPanel")} ↗
          </Link>
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-full bg-teal font-display text-sm font-bold"
            >
              {initials || "?"}
            </span>
            <span className="flex flex-col">
              <span>{profile.full_name || "—"}</span>
              <span className="text-xs text-muted">{t(`roles.${profile.role}`)}</span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <form action={signOut}>
              <button type="submit" className="min-h-11 underline underline-offset-4">
                {t("common.logout")}
              </button>
            </form>
            <LanguageSwitcher />
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-5 md:p-10">{children}</main>
    </div>
  );
}
