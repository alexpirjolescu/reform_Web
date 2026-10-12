import Link from "next/link";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { signOut } from "@/app/auth/actions";
import { Avatar } from "@/components/avatar";
import { BoardIcon, ChatIcon, FolderIcon, GridIcon, MailIcon, NewsIcon, QuizIcon, ShieldIcon, UsersIcon } from "@/components/icons";
import { LanguageSwitcher } from "@/components/language-switcher";
import { MenuSetting, MobileMenu } from "@/components/mobile-menu";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { menuRow, menuRowActive } from "@/components/ui-classes";
import type { Theme } from "@/lib/theme";
import type { ShellData } from "@/lib/shell";
import { NavLink, WhenActive } from "./nav-link";
import { SectionLogo } from "./section-logo";
import { adminNav, badgeFor, moduleNav, type AdminKey, type NavKey } from "./nav-items";

const moduleIcons: Record<NavKey, typeof BoardIcon> = {
  workspace: BoardIcon,
  library: FolderIcon,
  assessments: QuizIcon,
  messages: ChatIcon,
};
const adminIcons: Record<AdminKey, typeof BoardIcon> = { overview: GridIcon, invites: MailIcon, news: NewsIcon, users: UsersIcon, reports: ShieldIcon };

type ShellProps = { shell: ShellData; children: ReactNode };
type NavStyle = { nav: string; item: string; active: string; section?: string; marker?: ReactNode };

/**
 * Phones: the sidebar folds into the ☰ menu (top right), which slides in from the right with who you are,
 * every section, the news panel, the look, the language and logging out.
 */
async function AppMenu({ shell, theme, logo, nav, panelClass }: { shell: ShellData; theme: Theme; logo: ReactNode; nav: ReactNode; panelClass: string }) {
  const t = await getTranslations();
  const { profile } = shell;
  return (
    <MobileMenu label={t("common.menu")} closeLabel={t("common.closeMenu")} hideFrom="md" header={logo} panelClass={panelClass}>
      <div className="flex items-center gap-3 px-3">
        <Avatar id={profile.id} name={profile.full_name} size={44} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-display text-[17px] font-semibold">{profile.full_name}</span>
          <span className="truncate text-[13px] text-th-muted">
            {t(`roles.${profile.role}`)}
            {shell.schoolName ? ` · ${shell.schoolName}` : ""}
          </span>
        </span>
      </div>
      {nav}
      <div aria-hidden="true" className="mx-3 h-px bg-th-sep" />
      <div className="flex flex-col gap-0.5">
        <Link href="/" className={menuRow}>
          {t("common.newsPanel")}
          <span aria-hidden="true" className="ml-auto text-th-muted">↗</span>
        </Link>
        <MenuSetting label={t("theme.label")}>
          <ThemeSwitcher current={theme} />
        </MenuSetting>
        <MenuSetting label={t("common.language")}>
          <LanguageSwitcher />
        </MenuSetting>
      </div>
      <form action={signOut} className="mt-auto px-3 pt-4">
        <button type="submit" className="ui-btn ui-tinted ui-danger w-full">{t("common.logout")}</button>
      </form>
    </MobileMenu>
  );
}

// ---------------------------------------------------------------------------
// A · Studio: sidebar, teal underscore marks the open section. Dark and white
// share it; the colours come from the theme tokens (--th-*, globals.css).
// ---------------------------------------------------------------------------
export async function StudioShell({ shell, theme, children }: ShellProps & { theme: "dark" | "white" }) {
  const t = await getTranslations();
  const { profile } = shell;
  const dark = theme === "dark";
  const tone = dark ? "dark" : "light";

  const nav = ({ nav, item, active, section, marker }: NavStyle) => (
    <nav aria-label={t("nav.label")} className={nav}>
      {moduleNav.map(({ key, href }) => {
        const Icon = moduleIcons[key];
        const badge = badgeFor(key, shell);
        return (
          <NavLink key={key} href={href} className={item} activeClassName={active} activeExtra={marker}>
            <WhenActive href={href} active={<Icon className="text-th-link" />} inactive={<Icon />} />
            {t(`nav.${key}`)}
            {badge > 0 && <span className="ml-auto min-w-5 rounded-full bg-th-fg px-1.5 py-px text-center text-xs font-semibold text-th-bg">{badge}</span>}
          </NavLink>
        );
      })}
      {adminNav(shell).length > 0 && <div className={section}>{t("nav.adminSection")}</div>}
      {adminNav(shell).map(({ key, href, badge, exact }) => {
        const Icon = adminIcons[key];
        return (
          <NavLink key={key} href={href} exact={exact} className={item} activeClassName={active} activeExtra={marker}>
            <WhenActive href={href} exact={exact} active={<Icon className="text-th-link" />} inactive={<Icon />} />
            {t(`nav.admin_${key}`)}
            {!!badge && <span className="ml-auto min-w-5 rounded-full bg-honey px-1.5 py-px text-center text-xs font-semibold text-ink">{badge}</span>}
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen flex-col bg-th-bg text-th-fg md:h-screen md:flex-row md:overflow-hidden">
      <aside className="flex shrink-0 flex-col gap-4 border-b border-th-line px-4 pt-3 pb-3 md:w-[220px] md:gap-7 md:overflow-y-auto md:border-r md:border-b-0 md:pt-7 md:pb-5">
        <div className="flex items-center justify-between gap-3">
          <Link href="/app" className="ml-1.5 flex self-start" aria-label="re_form platform">
            <SectionLogo white={dark} height={38} />
          </Link>
          <AppMenu
            shell={shell}
            theme={theme}
            logo={<SectionLogo white={dark} height={32} />}
            panelClass="bg-th-bg text-th-fg"
            nav={nav({ nav: "flex flex-col gap-0.5", item: menuRow, active: menuRowActive, section: "mt-3 mb-1 px-3 text-[13px] text-th-muted" })}
          />
        </div>
        <div className="hidden px-1.5 md:block">
          <div className="mb-1 text-xs text-th-muted">{shell.isStaff ? t("shell.team") : t("shell.yourSchool")}</div>
          <div className="font-display font-semibold">{shell.schoolName ?? "re_form"}</div>
          <div className="text-[13px] text-th-muted">{t(`roles.${profile.role}`)}</div>
        </div>
        {nav({
          nav: "hidden flex-col gap-0.5 md:flex",
          item: "flex min-h-11 items-center gap-3 rounded-[10px] px-2.5 py-3 text-[15px] transition-colors hover:bg-th-fill",
          active: "flex min-h-11 items-center gap-3 rounded-[10px] bg-th-fill px-2.5 py-3 text-[15px] font-medium",
          section: "mt-4 mb-1 px-2.5 text-xs text-th-muted",
          marker: <span aria-hidden="true" className="ml-auto h-1 w-4 rounded-full bg-teal" />,
        })}
        <div className="mt-auto hidden flex-col gap-3 px-1.5 md:flex">
          <Link href="/" className="text-sm text-th-muted hover:text-th-link">{t("common.newsPanel")} ↗</Link>
          <div className="flex items-center gap-2.5">
            <Avatar id={profile.id} name={profile.full_name} size={36} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm">{profile.full_name}</span>
              <span className="text-xs text-th-muted">{t(`roles.${profile.role}`)}</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ThemeSwitcher current={theme} tone={tone} />
            <LanguageSwitcher />
          </div>
          <form action={signOut}>
            <button type="submit" className="ui-btn ui-plain ui-sm ui-danger -ml-2">{t("common.logout")}</button>
          </form>
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// C · Colour system: sticker sidebar, each module in its sub-brand colour
// ---------------------------------------------------------------------------
export async function ColorShell({ shell, children }: ShellProps) {
  const t = await getTranslations();
  const { profile } = shell;
  const pill = "flex items-center gap-3 rounded-full py-1.5 pr-3 pl-1.5 transition-colors";

  const nav = ({ nav, item, active, section }: NavStyle) => (
    <nav aria-label={t("nav.label")} className={nav}>
      {moduleNav.map(({ key, href, color, ink }) => {
        const Icon = moduleIcons[key];
        const badge = badgeFor(key, shell);
        return (
          <NavLink key={key} href={href} className={item} activeClassName={active}>
            <span aria-hidden="true" className="grid size-[34px] shrink-0 place-items-center rounded-full border-2 border-ink" style={{ background: color, color: ink }}>
              <Icon size={18} strokeWidth={2.5} />
            </span>
            {t(`nav.${key}`)}
            {badge > 0 && <span className="ml-auto rounded-full bg-ink px-2.5 font-fun text-sm font-bold text-white">{badge}</span>}
          </NavLink>
        );
      })}
      {section && adminNav(shell).length > 0 && <div className={section}>{t("nav.adminSection")}</div>}
      {adminNav(shell).map(({ key, href, badge, exact }) => {
        const Icon = adminIcons[key];
        return (
          <NavLink key={key} href={href} exact={exact} className={item} activeClassName={active}>
            <span aria-hidden="true" className="grid size-[34px] shrink-0 place-items-center rounded-full border-2 border-ink bg-teal">
              <Icon size={18} strokeWidth={2.5} />
            </span>
            {t(`nav.admin_${key}`)}
            {!!badge && <span className="ml-auto rounded-full bg-honey px-2.5 font-fun text-sm font-bold">{badge}</span>}
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen flex-col bg-white text-ink md:h-screen md:flex-row md:overflow-hidden">
      <aside className="flex shrink-0 flex-col gap-4 border-b-2 border-ink px-[18px] pt-3 pb-3 md:w-[236px] md:gap-6 md:overflow-y-auto md:border-r-2 md:border-b-0 md:pt-[26px] md:pb-[22px]">
        <div className="flex items-center justify-between gap-3">
          <Link href="/app" className="flex self-start" aria-label="re_form platform">
            <SectionLogo height={38} />
          </Link>
          <AppMenu
            shell={shell}
            theme="color"
            logo={<SectionLogo height={32} />}
            panelClass="bg-white text-ink"
            nav={nav({
              nav: "flex flex-col gap-1",
              item: `${pill} min-h-11 text-[17px] font-medium hover:bg-th-fill`,
              active: `${pill} min-h-11 bg-th-fill-2 text-[17px] font-semibold`,
              section: "mt-3 mb-1 px-3 text-[13px] text-muted",
            })}
          />
        </div>
        <span className="hidden self-start rounded-full border-2 border-ink px-3 py-1 text-[13px] font-medium md:inline">
          {shell.schoolName ?? "re_form"} · {t(`roles.${profile.role}`)}
        </span>
        {nav({
          nav: "hidden flex-col gap-1.5 md:flex",
          item: `${pill} min-h-11 text-[15px] font-medium hover:bg-th-fill`,
          active: `${pill} min-h-11 bg-th-fill-2 text-[15px] font-semibold`,
        })}
        <div className="mt-auto hidden flex-col gap-3 md:flex">
          <Link href="/" className="text-sm font-medium hover:underline">← {t("common.newsPanel")}</Link>
          <div className="flex items-center gap-2.5 rounded-[18px] border-2 border-ink p-2.5">
            <Avatar id={profile.id} name={profile.full_name} size={36} ring="#221f20" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{profile.full_name}</span>
              <span className="text-xs text-muted">{t(`roles.${profile.role}`)}</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ThemeSwitcher current="color" />
            <LanguageSwitcher />
          </div>
          <form action={signOut}>
            <button type="submit" className="ui-btn ui-plain ui-sm ui-danger -ml-2">{t("common.logout")}</button>
          </form>
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
