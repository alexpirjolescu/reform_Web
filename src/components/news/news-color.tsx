import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { dayNumber, monthShort, shortDate, timeOfDay, weekdayLong } from "@/lib/format";
import { categoryColor, categoryInk } from "@/lib/news";
import { ActivityVisual, CategoryChips, CategoryLabel, SchoolSearchForm, type NewsProps } from "./shared";
import { NewsletterForm } from "./newsletter-form";
import { NewsFooter } from "./footer";

// Design C · Colour system: bento tiles in the sub-brand colours (docs/design/mockups/C-news.dc.html)
export async function NewsColor(props: NewsProps) {
  const { locale, upcoming, past, stats, schools, filters, signedIn, theme } = props;
  const t = await getTranslations();
  const next = upcoming[0];

  return (
    <div className="min-h-screen bg-white text-ink">
      <header className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-8 gap-y-4 px-4 py-6 sm:px-8">
        <Link href="/" aria-label={t("news.home")} className="flex">
          <Logo height={40} priority />
        </Link>
        <nav aria-label={t("news.mainNav")} className="flex flex-grow flex-wrap gap-1.5 text-[15px]">
          <a href="#urmeaza" className="rounded-full bg-ink px-4 py-2.5 text-white">{t("news.nav.activities")}</a>
          <Link href="/about" className="rounded-full px-4 py-2.5 hover:underline">{t("news.nav.about")}</Link>
          <Link href="/about#schools" className="rounded-full px-4 py-2.5 hover:underline">{t("news.nav.schools")}</Link>
          <Link href="/about#contact" className="rounded-full px-4 py-2.5 hover:underline">{t("news.nav.contact")}</Link>
        </nav>
        <div className="flex flex-wrap items-center gap-3.5">
          <LanguageSwitcher />
          <ThemeSwitcher current={theme} />
          <Link href={signedIn ? "/app" : "/auth/login"} className="rounded-full border-2 border-ink bg-teal px-5 py-[11px] font-display text-[15px] font-bold">
            {signedIn ? t("news.openApp") : t("common.login")}
          </Link>
        </div>
      </header>

      <section className="mx-auto flex max-w-[1240px] flex-wrap gap-5 px-4 pt-3 sm:px-8">
        <div className="relative flex flex-[2_1_560px] flex-col gap-6 rounded-[28px] border-2 border-ink bg-teal p-8 sm:p-12">
          <span className="self-start rounded-full border-2 border-ink bg-white px-4 py-1.5 font-fun text-lg font-bold">{t("news.sticker")}</span>
          <h1 className="font-display text-[56px] leading-[0.95] font-extrabold tracking-[-0.03em] sm:text-[80px]">
            {t("home.titleLine1")}
            <br />
            {t("home.titleLine2")}.
          </h1>
          <p className="max-w-[560px] text-lg leading-[1.6]">{t("home.mission")}</p>
          <div className="flex flex-wrap gap-3">
            <a href="#urmeaza" className="rounded-full bg-ink px-6 py-3.5 font-display font-bold text-white">{t("home.seeUpcoming")}</a>
            <Link href="/about" className="rounded-full border-2 border-ink bg-white px-[22px] py-3 font-display font-bold">{t("news.aboutReform")}</Link>
          </div>
        </div>
        <div className="flex flex-[1_1_320px] flex-col gap-5">
          {next ? (
            <Link
              href={`/activities/${next.id}`}
              className="flex flex-grow flex-col gap-2.5 rounded-[28px] border-2 border-ink p-7"
              style={{ background: categoryColor[next.category], color: categoryInk[next.category] }}
            >
              <span className="text-sm">{t("news.nextUp")} · <CategoryLabel category={next.category} /></span>
              <span className="font-fun text-[72px] leading-[0.9] font-bold">
                {dayNumber(next.startsAt, locale)} {monthShort(next.startsAt, locale)}
              </span>
              <span className="font-display text-[22px] leading-[1.2] font-bold">{next.title}</span>
              <span className="text-sm">
                {weekdayLong(next.startsAt, locale)} · {timeOfDay(next.startsAt, locale)}
                {next.location ? ` · ${next.location}` : ""} →
              </span>
            </Link>
          ) : (
            <div className="flex flex-grow items-center rounded-[28px] border-2 border-ink bg-lavender p-7 text-white">
              <span className="font-display text-xl font-bold">{t("home.emptyUpcoming")}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 rounded-[28px] border-2 border-ink bg-honey px-7 py-6">
            {(["schools", "students", "activities", "thisYear"] as const).map((key) => (
              <div key={key}>
                <div className="font-fun text-[40px] leading-none font-bold">{stats[key]}</div>
                <div className="text-[13px]">{t(`news.stats.${key}Short`)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="urmeaza" className="mx-auto max-w-[1240px] scroll-mt-6 px-4 pt-[72px] sm:px-8">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-5">
          <h2 className="flex items-center gap-3.5 font-display text-5xl font-extrabold tracking-[-0.02em]">
            <svg width="44" height="44" viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="9" width="38" height="34" rx="4" fill="#fff" stroke="#221f20" strokeWidth="3" /><rect x="5" y="9" width="38" height="10" fill="#dd6937" stroke="#221f20" strokeWidth="3" /><path d="M15 5v8M33 5v8" stroke="#221f20" strokeWidth="3" strokeLinecap="round" /><rect x="13" y="26" width="7" height="7" fill="#221f20" /></svg>
            {t("home.upcoming")}
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <CategoryChips
              filters={filters}
              dot="round"
              chip="rounded-full border-2 border-ink bg-white px-4 py-2 text-sm"
              activeChip="rounded-full border-2 border-ink bg-ink px-4 py-2 text-sm font-medium text-white"
            />
            <SchoolSearchForm
              filters={filters}
              schools={schools}
              labelClass="font-medium"
              fieldClass="min-h-11 rounded-full border-2 border-ink bg-white px-4 text-sm"
              buttonClass="min-h-11 rounded-full border-2 border-ink bg-ink px-5 text-sm text-white"
            />
          </div>
        </div>
        {upcoming.length ? (
          <div className="grid gap-5 sm:grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
            {upcoming.slice(0, 4).map((activity) => (
              <article key={activity.id} className="flex flex-col overflow-hidden rounded-3xl border-2 border-ink bg-white">
                <div
                  className="flex items-end justify-between border-b-2 border-ink px-[22px] py-[18px]"
                  style={{ background: categoryColor[activity.category], color: categoryInk[activity.category] }}
                >
                  <span className="font-fun text-[56px] leading-[0.9] font-bold">{dayNumber(activity.startsAt, locale)}</span>
                  <span className="font-display text-lg font-bold">{monthShort(activity.startsAt, locale)}</span>
                </div>
                <div className="flex flex-grow flex-col gap-2.5 px-[22px] pt-5 pb-[22px]">
                  <span className="self-start rounded-full border-2 border-ink px-2.5 py-0.5 text-xs font-medium"><CategoryLabel category={activity.category} /></span>
                  <h3 className="font-display text-[21px] leading-[1.2] font-bold">{activity.title}</h3>
                  <span className="text-sm text-muted">
                    {weekdayLong(activity.startsAt, locale)} · {timeOfDay(activity.startsAt, locale)}
                    {activity.location ? ` · ${activity.location}` : ""}
                  </span>
                  <Link href={`/activities/${activity.id}`} className="mt-auto self-start border-b-2 border-ink font-display text-[15px] font-bold">
                    {t("news.details")}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-muted">{t("home.emptyUpcoming")}</p>
        )}
      </section>

      <section className="mx-auto max-w-[1240px] px-4 pt-[72px] sm:px-8">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-5">
          <h2 className="flex items-center gap-3.5 font-display text-5xl font-extrabold tracking-[-0.02em]">
            <svg width="44" height="44" viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="8" width="38" height="32" rx="4" fill="#fff" stroke="#221f20" strokeWidth="3" /><circle cx="17" cy="19" r="4" fill="#e1b345" stroke="#221f20" strokeWidth="3" /><path d="M5 34l12-10 9 8 6-5 11 9" fill="none" stroke="#221f20" strokeWidth="3" strokeLinejoin="round" /></svg>
            {t("home.past")}
          </h2>
          <Link href="/activities?when=past" className="border-b-2 border-ink font-display font-bold">{t("news.archive")}</Link>
        </div>
        {past.length ? (
          <div className="grid gap-5 sm:grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
            {past.map((activity) => (
              <Link key={activity.id} href={`/activities/${activity.id}`} className="flex flex-col gap-3 rounded-3xl border-2 border-ink p-3.5">
                <ActivityVisual activity={activity} rounded="rounded-2xl border-2 border-ink" />
                <div className="flex flex-col gap-2 px-2 pt-1 pb-2.5">
                  <span className="text-[13px] text-muted"><CategoryLabel category={activity.category} /> · {shortDate(activity.startsAt, locale)}</span>
                  <h3 className="font-display text-[23px] leading-[1.2] font-bold">{activity.title}</h3>
                  {activity.summary && <p className="text-[15px] leading-[1.55]">{activity.summary}</p>}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-muted">{t("home.emptyPast")}</p>
        )}
      </section>

      <section className="mx-auto max-w-[1240px] px-4 pt-[72px] pb-20 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-8 rounded-[28px] border-2 border-ink bg-lime px-8 py-10 sm:px-12">
          <div className="max-w-[520px]">
            <h2 className="mb-2 font-display text-[38px] leading-[1.05] font-extrabold">{t("news.newsletter.titleColor")}</h2>
            <p>{t("news.newsletter.body")}</p>
          </div>
          <NewsletterForm
            labelClass="text-[13px] font-medium"
            inputClass="w-[280px] rounded-full border-2 border-ink bg-white px-[18px] py-[13px] text-[15px]"
            buttonClass="rounded-full border-2 border-ink bg-ink px-6 py-3.5 font-display text-[15px] font-bold text-white disabled:opacity-60"
            messageClass="font-medium"
          />
        </div>
      </section>

      <NewsFooter variant="color" />
    </div>
  );
}
