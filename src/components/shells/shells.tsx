import Link from "next/link";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { signOut } from "@/app/auth/actions";
import { Avatar } from "@/components/avatar";
import { BoardIcon, ChatIcon, FolderIcon, NewsIcon, QuizIcon, ShieldIcon, UsersIcon } from "@/components/icons";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { ThemeSwitcher } from "@/components/theme-switcher";
import type { ShellData } from "@/lib/shell";
import { NavLink, NavMenu, WhenActive } from "./nav-link";
import { adminNav, badgeFor, moduleNav, type AdminKey, type NavKey } from "./nav-items";

const moduleIcons: Record<NavKey, typeof BoardIcon> = {
  workspace: BoardIcon,
  library: FolderIcon,
  assessments: QuizIcon,
  messages: ChatIcon,
};
const adminIcons: Record<AdminKey, typeof BoardIcon> = { news: NewsIcon, users: UsersIcon, reports: ShieldIcon };

type ShellProps = { shell: ShellData; children: ReactNode };

/** Phones: the account block (theme, language, log out) folds into the avatar. */
function MobileAccount({ label, panelClass, profile, children }: { label: string; panelClass: string; profile: ShellData["profile"]; children: ReactNode }) {
  return (
    <details className="relative md:hidden">
      <summary aria-label={label} className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center">
        <Avatar id={profile.id} name={profile.full_name} size={36} />
      </summary>
      <div className={`absolute top-full right-0 z-40 mt-2 flex w-64 flex-col gap-3 p-4 ${panelClass}`}>{children}</div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// A · Dark studio: dark sidebar, teal underscore marks the open section
// ---------------------------------------------------------------------------
export async function DarkShell({ shell, children }: ShellProps) {
  const t = await getTranslations();
  const { profile } = shell;
  const item = "flex min-h-11 items-center gap-3 px-2.5 py-3 text-[15px] hover:text-teal";
  const active = "flex min-h-11 items-center gap-3 bg-night-4 px-2.5 py-3 text-[15px]";

  return (
    <div className="flex min-h-screen flex-col bg-night text-white md:h-screen md:flex-row md:overflow-hidden">
      <aside className="flex shrink-0 flex-col gap-4 border-b border-night-line px-4 pt-4 pb-3 md:w-[220px] md:gap-7 md:overflow-y-auto md:border-r md:border-b-0 md:pt-7 md:pb-5">
        <div className="flex items-center justify-between gap-3">
          <Link href="/app" className="ml-1.5 flex self-start" aria-label="re_form platform">
            <Logo name="platform" white height={38} />
          </Link>
          <MobileAccount label={t("shell.account")} panelClass="border border-night-edge bg-night-3 text-white" profile={profile}>
            <span className="text-sm">{profile.full_name} · <span className="text-night-muted">{t(`roles.${profile.role}`)}</span></span>
            <Link href="/" className="text-sm text-night-muted hover:text-teal">{t("common.newsPanel")} ↗</Link>
            <div className="flex items-center justify-between"><ThemeSwitcher current="dark" tone="dark" /><LanguageSwitcher className="text-night-muted" /></div>
            <form action={signOut}><button type="submit" className="min-h-11 text-sm underline underline-offset-4">{t("common.logout")}</button></form>
          </MobileAccount>
        </div>
        <div className="hidden px-1.5 md:block">
          <div className="mb-1 text-xs text-night-muted">{shell.isStaff ? t("shell.team") : t("shell.yourSchool")}</div>
          <div className="font-display font-semibold">{shell.schoolName ?? "re_form"}</div>
          <div className="text-[13px] text-night-muted">{t(`roles.${profile.role}`)}</div>
        </div>
        <nav aria-label={t("nav.label")} className="flex flex-row flex-wrap gap-0.5 md:flex-col">
          {moduleNav.map(({ key, href }) => {
            const Icon = moduleIcons[key];
            const badge = badgeFor(key, shell);
            return (
              <NavLink key={key} href={href} className={item} activeClassName={active}
                activeExtra={<span aria-hidden="true" className="ml-auto h-1 w-4 bg-teal" />}>
                <WhenActive href={href} active={<Icon className="text-teal" />} inactive={<Icon />} />
                {t(`nav.${key}`)}
                {badge > 0 && <span className="ml-auto bg-white px-[7px] py-px text-xs text-night">{badge}</span>}
              </NavLink>
            );
          })}
          {adminNav(shell).length > 0 && <div className="mt-4 mb-1 hidden px-2.5 text-xs text-night-muted md:block">{t("nav.adminSection")}</div>}
          {adminNav(shell).map(({ key, href, badge }) => {
            const Icon = adminIcons[key];
            return (
              <NavLink key={key} href={href} className={item} activeClassName={active}
                activeExtra={<span aria-hidden="true" className="ml-auto h-1 w-4 bg-teal" />}>
                <WhenActive href={href} active={<Icon className="text-teal" />} inactive={<Icon />} />
                {t(`nav.admin_${key}`)}
                {!!badge && <span className="ml-auto bg-honey px-[7px] py-px text-xs text-night">{badge}</span>}
              </NavLink>
            );
          })}
        </nav>
        <div className="mt-auto hidden flex-col gap-3 px-1.5 md:flex">
          <Link href="/" className="text-sm text-night-muted hover:text-teal">{t("common.newsPanel")} ↗</Link>
          <div className="flex items-center gap-2.5">
            <Avatar id={profile.id} name={profile.full_name} size={36} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm">{profile.full_name}</span>
              <span className="text-xs text-night-muted">{t(`roles.${profile.role}`)}</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-1">
            <ThemeSwitcher current="dark" tone="dark" />
            <LanguageSwitcher className="text-night-muted" />
          </div>
          <form action={signOut}>
            <button type="submit" className="min-h-11 text-sm text-night-muted underline underline-offset-4 hover:text-white">{t("common.logout")}</button>
          </form>
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// B · White paper: top bar with tabs, teal bar under the open section
// ---------------------------------------------------------------------------
export async function WhiteShell({ shell, children }: ShellProps) {
  const t = await getTranslations();
  const { profile } = shell;
  const tab = "flex min-h-11 items-center gap-1.5 border-b-4 border-transparent pt-1 text-[15px] text-muted hover:text-ink";
  const activeTab = "flex min-h-11 items-center gap-1.5 border-b-4 border-teal pt-1 text-[15px] font-medium text-ink";

  return (
    <div className="flex min-h-screen flex-col bg-white text-ink md:h-screen md:overflow-hidden">
      <header className="relative flex shrink-0 flex-wrap items-stretch gap-x-9 gap-y-2 border-b border-ink px-4 sm:px-7 md:h-[68px] md:flex-nowrap">
        <Link href="/app" className="flex items-center py-3" aria-label="re_form platform">
          <Logo name="platform" height={34} />
        </Link>
        <nav aria-label={t("nav.label")} className="flex flex-wrap gap-x-6">
          {moduleNav.map(({ key, href }) => {
            const badge = badgeFor(key, shell);
            return (
              <NavLink key={key} href={href} className={`${tab} whitespace-nowrap`} activeClassName={`${activeTab} whitespace-nowrap`}>
                {t(`nav.${key}`)}
                {badge > 0 && <span className="bg-ink px-1.5 text-xs text-white">{badge}</span>}
              </NavLink>
            );
          })}
          {adminNav(shell).length > 0 && (
            <NavMenu
              label={t("nav.adminSection")}
              items={adminNav(shell).map(({ key, href, badge }) => ({ href, badge, label: t(`nav.admin_${key}`) }))}
              className={tab}
              activeClassName={activeTab}
            />
          )}
        </nav>
        <div className="ml-auto hidden items-center gap-2 py-2 md:flex">
          <Link href="/" className="hidden text-sm whitespace-nowrap text-muted hover:text-ink xl:inline">{t("common.newsPanel")} ↗</Link>
          <ThemeSwitcher current="white" />
          <LanguageSwitcher className="text-muted" />
          <form action={signOut}>
            <button type="submit" className="min-h-11 px-2 text-sm whitespace-nowrap text-muted underline underline-offset-4 hover:text-ink">{t("common.logout")}</button>
          </form>
          <Avatar id={profile.id} name={profile.full_name} size={40} />
        </div>
        <div className="absolute top-3 right-4 md:hidden">
          <MobileAccount label={t("shell.account")} panelClass="border border-ink bg-white" profile={profile}>
            <span className="text-sm">{profile.full_name} · <span className="text-muted">{t(`roles.${profile.role}`)}</span></span>
            <Link href="/" className="text-sm text-muted hover:text-ink">{t("common.newsPanel")} ↗</Link>
            <div className="flex items-center justify-between"><ThemeSwitcher current="white" /><LanguageSwitcher className="text-muted" /></div>
            <form action={signOut}><button type="submit" className="min-h-11 text-sm underline underline-offset-4">{t("common.logout")}</button></form>
          </MobileAccount>
        </div>
      </header>
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
  const item = "flex min-h-11 items-center gap-3 rounded-full border-2 border-transparent py-1.5 pr-3 pl-1.5 text-[15px] font-medium hover:border-line";
  const active = "flex min-h-11 items-center gap-3 rounded-full border-2 border-ink py-1.5 pr-3 pl-1.5 text-[15px] font-medium";

  return (
    <div className="flex min-h-screen flex-col bg-white text-ink md:h-screen md:flex-row md:overflow-hidden">
      <aside className="flex shrink-0 flex-col gap-4 border-b-2 border-ink px-[18px] pt-4 pb-3 md:w-[236px] md:gap-6 md:overflow-y-auto md:border-r-2 md:border-b-0 md:pt-[26px] md:pb-[22px]">
        <div className="flex items-center justify-between gap-3">
          <Link href="/app" className="flex self-start" aria-label="re_form platform">
            <Logo name="platform" height={38} />
          </Link>
          <MobileAccount label={t("shell.account")} panelClass="rounded-[18px] border-2 border-ink bg-white" profile={profile}>
            <span className="text-sm font-medium">{profile.full_name} · {t(`roles.${profile.role}`)}</span>
            <Link href="/" className="text-sm font-medium hover:underline">← {t("common.newsPanel")}</Link>
            <div className="flex items-center justify-between"><ThemeSwitcher current="color" /><LanguageSwitcher /></div>
            <form action={signOut}><button type="submit" className="min-h-11 text-sm font-medium underline underline-offset-4">{t("common.logout")}</button></form>
          </MobileAccount>
        </div>
        <span className="hidden self-start rounded-full border-2 border-ink px-3 py-1 text-[13px] font-medium md:inline">
          {shell.schoolName ?? "re_form"} · {t(`roles.${profile.role}`)}
        </span>
        <nav aria-label={t("nav.label")} className="flex flex-row flex-wrap gap-1.5 md:flex-col">
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
          {adminNav(shell).map(({ key, href, badge }) => {
            const Icon = adminIcons[key];
            return (
              <NavLink key={key} href={href} className={item} activeClassName={active}>
                <span aria-hidden="true" className="grid size-[34px] shrink-0 place-items-center rounded-full border-2 border-ink bg-teal">
                  <Icon size={18} strokeWidth={2.5} />
                </span>
                {t(`nav.admin_${key}`)}
                {!!badge && <span className="ml-auto rounded-full bg-honey px-2.5 font-fun text-sm font-bold">{badge}</span>}
              </NavLink>
            );
          })}
        </nav>
        <div className="mt-auto hidden flex-col gap-3 md:flex">
          <Link href="/" className="text-sm font-medium hover:underline">← {t("common.newsPanel")}</Link>
          <div className="flex items-center gap-2.5 rounded-[18px] border-2 border-ink p-2.5">
            <Avatar id={profile.id} name={profile.full_name} size={36} ring="#221f20" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{profile.full_name}</span>
              <span className="text-xs text-muted">{t(`roles.${profile.role}`)}</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-1">
            <ThemeSwitcher current="color" />
            <LanguageSwitcher />
          </div>
          <form action={signOut}>
            <button type="submit" className="min-h-11 text-sm font-medium underline underline-offset-4">{t("common.logout")}</button>
          </form>
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
