import Link from "next/link";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { NewsFooter } from "@/components/news/footer";
import { paperFor } from "@/components/news/paper";
import { ThemeSwitcher } from "@/components/theme-switcher";
import type { Theme } from "@/lib/theme";

/** Header and footer for secondary public pages (activity, archive, about), on the paper of the chosen theme. */
export async function PublicFrame({ theme, signedIn, children }: { theme: Theme; signedIn: boolean; children: ReactNode }) {
  const t = await getTranslations();
  const p = paperFor(theme);

  return (
    <div className={`flex min-h-screen flex-col ${p.page}`}>
      <header className="mx-auto w-full max-w-[1200px] px-4 sm:px-10">
        <div className={`flex flex-wrap items-center gap-x-10 gap-y-4 border-b py-6 ${p.rule}`}>
          <Link href="/" aria-label={t("news.home")} className="flex">
            <Logo white={p.logoWhite} height={40} />
          </Link>
          <nav aria-label={t("news.mainNav")} className="flex flex-grow flex-wrap gap-6 text-[15px]">
            <Link href="/#urmeaza" className={p.hover}>{t("news.nav.activities")}</Link>
            <Link href="/about" className={p.hover}>{t("news.nav.about")}</Link>
            <Link href="/about#schools" className={p.hover}>{t("news.nav.schools")}</Link>
            <Link href="/about#contact" className={p.hover}>{t("news.nav.contact")}</Link>
          </nav>
          <div className="flex flex-wrap items-center gap-3">
            <LanguageSwitcher className={p.muted} />
            <ThemeSwitcher current={theme} tone={p.tone} />
            <Link href={signedIn ? "/app" : "/auth/login"} className={p.login}>
              {signedIn ? t("news.openApp") : t("common.login")}
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-12 sm:px-10">{children}</main>
      <NewsFooter variant={theme} />
    </div>
  );
}
