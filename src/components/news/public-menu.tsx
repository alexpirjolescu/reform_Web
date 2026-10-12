import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { MenuSetting, MobileMenu } from "@/components/mobile-menu";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { menuRow } from "@/components/ui-classes";
import type { Theme } from "@/lib/theme";
import { paperFor } from "./paper";

/**
 * Phones and tablets: the public pages' links, language, look and the way into the platform, in the ☰ menu
 * (top right, slides in from the left on the paper of the chosen theme). Wide screens show them in the header.
 */
export async function PublicMenu({ theme, signedIn }: { theme: Theme; signedIn: boolean }) {
  const t = await getTranslations();
  const p = paperFor(theme);

  return (
    <MobileMenu
      label={t("common.menu")}
      closeLabel={t("common.closeMenu")}
      hideFrom="lg"
      header={<Logo white={p.logoWhite} height={34} />}
      panelClass={p.page}
    >
      <nav aria-label={t("news.mainNav")} className="flex flex-col gap-0.5">
        <Link href="/#urmeaza" className={menuRow}>{t("news.nav.activities")}</Link>
        <Link href="/about" className={menuRow}>{t("news.nav.about")}</Link>
        <Link href="/about#schools" className={menuRow}>{t("news.nav.schools")}</Link>
        <Link href="/about#contact" className={menuRow}>{t("news.nav.contact")}</Link>
      </nav>
      <div aria-hidden="true" className={`mx-3 border-t ${p.line}`} />
      <div className="flex flex-col gap-0.5">
        <MenuSetting label={t("common.language")}>
          <LanguageSwitcher />
        </MenuSetting>
        <MenuSetting label={t("theme.label")}>
          <ThemeSwitcher current={theme} />
        </MenuSetting>
      </div>
      <div className="mt-auto px-3 pt-4">
        <Link href={signedIn ? "/app" : "/auth/login"} className="ui-btn ui-filled ui-lg w-full">
          {signedIn ? t("news.openApp") : t("common.login")}
        </Link>
      </div>
    </MobileMenu>
  );
}
