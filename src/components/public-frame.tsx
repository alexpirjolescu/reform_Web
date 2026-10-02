import Link from "next/link";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { NewsFooter } from "@/components/news/footer";
import { ThemeSwitcher } from "@/components/theme-switcher";
import type { Theme } from "@/lib/theme";

/** Header and footer for secondary public pages (activity, archive, about), in the chosen theme. */
export async function PublicFrame({ theme, signedIn, children }: { theme: Theme; signedIn: boolean; children: ReactNode }) {
  const t = await getTranslations();
  const dark = theme === "dark";
  const button =
    theme === "dark"
      ? "rounded-[2px] bg-teal px-5 py-3 font-display text-[15px] font-semibold text-night"
      : theme === "color"
        ? "rounded-full border-2 border-ink bg-teal px-5 py-[11px] font-display text-[15px] font-bold"
        : "bg-ink px-[18px] py-[11px] font-display text-[15px] font-semibold text-white";

  return (
    <div className={`flex min-h-screen flex-col ${dark ? "bg-night text-white" : "bg-white text-ink"}`}>
      <header className={`mx-auto flex w-full max-w-[1200px] flex-wrap items-center gap-x-10 gap-y-4 px-4 py-6 sm:px-10 ${theme === "white" ? "border-b border-ink" : ""}`}>
        <Link href="/" aria-label={t("news.home")} className="flex">
          <Logo white={dark} height={40} />
        </Link>
        <nav aria-label={t("news.mainNav")} className="flex flex-grow flex-wrap gap-6 text-[15px]">
          <Link href="/#urmeaza" className="hover:underline">{t("news.nav.activities")}</Link>
          <Link href="/about" className="hover:underline">{t("news.nav.about")}</Link>
          <Link href="/about#schools" className="hover:underline">{t("news.nav.schools")}</Link>
          <Link href="/about#contact" className="hover:underline">{t("news.nav.contact")}</Link>
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          <LanguageSwitcher className={dark ? "text-night-muted" : "text-muted"} />
          <ThemeSwitcher current={theme} tone={dark ? "dark" : "light"} />
          <Link href={signedIn ? "/app" : "/auth/login"} className={button}>
            {signedIn ? t("news.openApp") : t("common.login")}
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-12 sm:px-10">{children}</main>
      <NewsFooter variant={theme} />
    </div>
  );
}
