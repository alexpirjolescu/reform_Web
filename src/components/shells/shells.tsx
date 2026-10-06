import Link from "next/link";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { signOut } from "@/app/auth/actions";
import { Avatar } from "@/components/avatar";
import { BoardIcon, ChatIcon, FolderIcon, GridIcon, MailIcon, NewsIcon, QuizIcon, ShieldIcon, UsersIcon } from "@/components/icons";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { ThemeSwitcher } from "@/components/theme-switcher";
import type { ShellData } from "@/lib/shell";
import { NavLink, WhenActive } from "./nav-link";
import { adminNav, badgeFor, moduleNav, type AdminKey, type NavKey } from "./nav-items";

const moduleIcons: Record<NavKey, typeof BoardIcon> = {
  workspace: BoardIcon,
  library: FolderIcon,
  assessments: QuizIcon,
  messages: ChatIcon,
};
const adminIcons: Record<AdminKey, typeof BoardIcon> = { overview: GridIcon, invites: MailIcon, news: NewsIcon, users: UsersIcon, reports: ShieldIcon };

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
// A · Studio: sidebar, teal underscore marks the open section. Dark and white
// share it; the colours come from the theme tokens (--th-*, globals.css).
// ---------------------------------------------------------------------------
export async function StudioShell({ shell, theme, children }: ShellProps & { theme: "dark" | "white" }) {
  const t = await getTranslations();
  const { profile } = shell;
  const dark = theme === "dark";
  const item = "flex min-h-11 items-center gap-3 px-2.5 py-3 text-[15px] hover:text-th-link";
  const active = "flex min-h-11 items-center gap-3 bg-th-raised px-2.5 py-3 text-[15px] font-medium";
  const tone = dark ? "dark" : "light";
  const marker = <span aria-hidden="true" className="ml-auto h-1 w-4 bg-teal" />;

  return (
    <div className="flex min-h-screen flex-col bg-th-bg text-th-fg md:h-screen md:flex-row md:overflow-hidden">
      <aside className="flex shrink-0 flex-col gap-4 border-b border-th-line px-4 pt-4 pb-3 md:w-[220px] md:gap-7 md:overflow-y-auto md:border-r md:border-b-0 md:pt-7 md:pb-5">
        <div className="flex items-center justify-between gap-3">
          <Link href="/app" className="ml-1.5 flex self-start" aria-label="re_form platform">
            <Logo name="platform" white={dark} height={38} />
          </Link>
          <MobileAccount label={t("shell.account")} panelClass="border border-th-edge bg-th-card text-th-fg" profile={profile}>
            <span className="text-sm">{profile.full_name} · <span className="text-th-muted">{t(`roles.${profile.role}`)}</span></span>
            <Link href="/" className="text-sm text-th-muted hover:text-th-link">{t("common.newsPanel")} ↗</Link>
            <div className="flex items-center justify-between"><ThemeSwitcher current={theme} tone={tone} /><LanguageSwitcher className="text-th-muted" /></div>
            <form action={signOut}><button type="submit" className="min-h-11 text-sm underline underline-offset-4">{t("common.logout")}</button></form>
          </MobileAccount>
        </div>
        <div className="hidden px-1.5 md:block">
          <div className="mb-1 text-xs text-th-muted">{shell.isStaff ? t("shell.team") : t("shell.yourSchool")}</div>
          <div className="font-display font-semibold">{shell.schoolName ?? "re_form"}</div>
          <div className="text-[13px] text-th-muted">{t(`roles.${profile.role}`)}</div>
        </div>
        <nav aria-label={t("nav.label")} className="flex flex-row flex-wrap gap-0.5 md:flex-col">
          {moduleNav.map(({ key, href }) => {
            const Icon = moduleIcons[key];
            const badge = badgeFor(key, shell);
            return (
              <NavLink key={key} href={href} className={item} activeClassName={active} activeExtra={marker}>
                <WhenActive href={href} active={<Icon className="text-th-link" />} inactive={<Icon />} />
                {t(`nav.${key}`)}
                {badge > 0 && <span className="ml-auto bg-th-fg px-[7px] py-px text-xs text-th-bg">{badge}</span>}
              </NavLink>
            );
          })}
          {adminNav(shell).length > 0 && <div className="mt-4 mb-1 hidden px-2.5 text-xs text-th-muted md:block">{t("nav.adminSection")}</div>}
          {adminNav(shell).map(({ key, href, badge, exact }) => {
            const Icon = adminIcons[key];
            return (
              <NavLink key={key} href={href} exact={exact} className={item} activeClassName={active} activeExtra={marker}>
                <WhenActive href={href} exact={exact} active={<Icon className="text-th-link" />} inactive={<Icon />} />
                {t(`nav.admin_${key}`)}
                {!!badge && <span className="ml-auto bg-honey px-[7px] py-px text-xs text-ink">{badge}</span>}
              </NavLink>
            );
          })}
        </nav>
        <div className="mt-auto hidden flex-col gap-3 px-1.5 md:flex">
          <Link href="/" className="text-sm text-th-muted hover:text-th-link">{t("common.newsPanel")} ↗</Link>
          <div className="flex items-center gap-2.5">
            <Avatar id={profile.id} name={profile.full_name} size={36} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm">{profile.full_name}</span>
              <span className="text-xs text-th-muted">{t(`roles.${profile.role}`)}</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-1">
            <ThemeSwitcher current={theme} tone={tone} />
            <LanguageSwitcher className="text-th-muted" />
          </div>
          <form action={signOut}>
            <button type="submit" className="min-h-11 text-sm text-th-muted underline underline-offset-4 hover:text-th-fg">{t("common.logout")}</button>
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
