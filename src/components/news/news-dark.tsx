import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { dayNumber, monthShort, timeOfDay, weekdayLong } from "@/lib/format";
import { categoryColor } from "@/lib/news";
import { ActivityVisual, CategoryChips, CategoryLabel, SchoolSearchForm, schoolNames, type NewsProps } from "./shared";
import { NewsletterForm } from "./newsletter-form";
import { NewsFooter } from "./footer";

// Design A · Dark studio (docs/design/mockups/A-news.dc.html)
export async function NewsDark(props: NewsProps) {
  const { locale, upcoming, past, stats, schools, filters, signedIn, theme } = props;
  const t = await getTranslations();
  const [featured, ...rest] = upcoming;
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-night text-white">
      <header className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-10 gap-y-4 px-4 py-7 sm:px-10">
        <Link href="/" aria-label={t("news.home")} className="flex">
          <Logo white height={40} priority />
        </Link>
        <nav aria-label={t("news.mainNav")} className="flex flex-grow flex-wrap gap-7 text-[15px]">
          <a href="#urmeaza" className="border-b-[3px] border-teal pb-1.5 hover:text-teal">{t("news.nav.activities")}</a>
          <Link href="/about" className="pb-1.5 hover:text-teal">{t("news.nav.about")}</Link>
          <Link href="/about#schools" className="pb-1.5 hover:text-teal">{t("news.nav.schools")}</Link>
          <Link href="/about#contact" className="pb-1.5 hover:text-teal">{t("news.nav.contact")}</Link>
        </nav>
        <div className="flex flex-wrap items-center gap-4">
          <LanguageSwitcher className="text-night-muted" />
          <ThemeSwitcher current={theme} tone="dark" />
          <Link href={signedIn ? "/app" : "/auth/login"} className="rounded-[2px] bg-teal px-5 py-3 font-display text-[15px] font-semibold text-night">
            {signedIn ? t("news.openApp") : t("common.login")}
          </Link>
        </div>
      </header>

      <section className="relative mx-auto grid max-w-[1200px] items-end gap-14 px-4 pt-[72px] pb-[104px] sm:pl-[72px] sm:pr-10 md:grid-cols-2">
        <div>
          <p className="mb-6 text-sm tracking-[0.06em] text-teal">{t("home.kicker")}</p>
          <h1 className="font-display text-[64px] leading-[0.92] font-extrabold tracking-[-0.03em] sm:text-[104px]">
            {t("home.titleLine1")}
            <br />
            {t("home.titleLine2")}
            <span aria-hidden="true" className="ml-[0.1em] inline-block h-[0.15em] w-[0.9em] bg-teal" />
          </h1>
        </div>
        <div>
          <p className="mb-8 text-xl leading-[1.6] font-light text-[#e8e5e6]">{t("home.mission")}</p>
          <div className="flex flex-wrap gap-3">
            <a href="#urmeaza" className="rounded-[2px] bg-teal px-6 py-[15px] font-display font-semibold text-night">{t("home.seeUpcoming")}</a>
            <Link href="/about" className="rounded-[2px] border border-white px-6 py-[14px] font-display font-semibold hover:text-teal">{t("news.aboutReform")}</Link>
          </div>
        </div>
        <span aria-hidden="true" className="absolute bottom-[104px] left-6 hidden font-display text-[15px] font-bold tracking-[0.08em] [writing-mode:vertical-rl] rotate-180 sm:block">
          {year}
        </span>
      </section>

      <section aria-label={t("news.stats.label")} className="border-y border-night-line">
        <div className="mx-auto grid max-w-[1200px] grid-cols-2 px-4 sm:px-10 md:grid-cols-4">
          {(["schools", "students", "activities", "thisYear"] as const).map((key) => (
            <div key={key} className="py-7">
              <div className="font-display text-[40px] font-bold text-teal">{stats[key]}</div>
              <div className="text-sm text-night-muted">{t(`news.stats.${key}`)}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="urmeaza" className="mx-auto max-w-[1200px] scroll-mt-6 px-4 pt-24 pb-10 sm:px-10">
        <div className="mb-9 flex flex-wrap items-end justify-between gap-6">
          <h2 className="font-display text-[64px] leading-none font-bold tracking-[-0.02em] text-teal">{t("home.upcoming")}</h2>
          <div className="flex flex-wrap items-end gap-3">
            <CategoryChips
              filters={filters}
              chip="rounded-full border border-night-edge px-4 py-2.5 text-sm text-white hover:border-white"
              activeChip="rounded-full border border-white bg-white px-4 py-2.5 text-sm text-night"
            />
            <SchoolSearchForm
              filters={filters}
              schools={schools}
              labelClass="text-night-muted"
              fieldClass="min-h-11 rounded-[2px] border border-night-edge bg-night-3 px-3 text-sm text-white"
              buttonClass="min-h-11 rounded-[2px] border border-night-edge px-4 text-sm hover:border-white"
            />
          </div>
        </div>

        {featured ? (
          <div className="flex flex-wrap gap-10">
            <article className="flex flex-[1_1_560px] flex-col bg-night-3">
              <div className="relative">
                <ActivityVisual activity={featured} ratio="2 / 1" />
              </div>
              <div className="flex flex-col gap-3.5 px-8 pt-7 pb-8">
                <div className="flex flex-wrap items-center gap-4 text-[13px] text-night-muted">
                  <span className="inline-flex items-center gap-2 text-white">
                    <span aria-hidden="true" className="size-2.5" style={{ background: categoryColor[featured.category] }} />
                    <CategoryLabel category={featured.category} />
                  </span>
                  <span>
                    {weekdayLong(featured.startsAt, locale)}, {dayNumber(featured.startsAt, locale)} {monthShort(featured.startsAt, locale)} · {timeOfDay(featured.startsAt, locale)}
                  </span>
                  {featured.location && <span>{featured.location}</span>}
                </div>
                <h3 className="font-display text-[34px] leading-[1.1] font-bold">{featured.title}</h3>
                {featured.summary && <p className="text-base leading-[1.6] font-light text-night-body">{featured.summary}</p>}
                <Link href={`/activities/${featured.id}`} className="mt-1.5 font-display font-semibold text-teal">
                  {t("news.detailsAndCalendar")} →
                </Link>
              </div>
            </article>

            <div className="flex flex-[1_1_380px] flex-col">
              {rest.slice(0, 3).map((activity) => (
                <Link key={activity.id} href={`/activities/${activity.id}`} className="grid grid-cols-[76px_1fr] gap-5 border-b border-night-line py-6 hover:text-teal">
                  <div>
                    <div className="font-display text-5xl leading-none font-bold">{dayNumber(activity.startsAt, locale)}</div>
                    <div className="mt-1 text-sm text-teal">{monthShort(activity.startsAt, locale)}</div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="inline-flex items-center gap-2 text-[13px] text-white">
                      <span aria-hidden="true" className="size-2.5" style={{ background: categoryColor[activity.category] }} />
                      <CategoryLabel category={activity.category} />
                    </span>
                    <span className="font-display text-[21px] leading-[1.25] font-semibold">{activity.title}</span>
                    <span className="text-sm text-night-muted">
                      {weekdayLong(activity.startsAt, locale)} · {timeOfDay(activity.startsAt, locale)}
                      {activity.location ? ` · ${activity.location}` : ""}
                      {activity.schools.length ? ` · ${schoolNames(activity)}` : ""}
                    </span>
                  </div>
                </Link>
              ))}
              <Link href="/activities" className="pt-6 font-display font-semibold text-teal">{t("news.fullCalendar")} →</Link>
            </div>
          </div>
        ) : (
          <p className="text-night-muted">{t("home.emptyUpcoming")}</p>
        )}
      </section>

      <section className="mx-auto max-w-[1200px] px-4 pt-20 pb-10 sm:px-10">
        <div className="mb-9 flex flex-wrap items-end justify-between gap-6">
          <h2 className="font-display text-[64px] leading-none font-bold tracking-[-0.02em] text-teal">{t("home.past")}</h2>
          <Link href="/activities?when=past" className="font-display font-semibold hover:text-teal">{t("news.archive")} →</Link>
        </div>
        {past.length ? (
          <div className="grid gap-8 sm:grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
            {past.map((activity) => (
              <article key={activity.id} className="flex flex-col gap-3.5">
                <ActivityVisual activity={activity} />
                <div className="flex gap-3.5 text-[13px] text-night-muted">
                  <span className="inline-flex items-center gap-2 text-white">
                    <span aria-hidden="true" className="size-2.5" style={{ background: categoryColor[activity.category] }} />
                    <CategoryLabel category={activity.category} />
                  </span>
                  <span>{dayNumber(activity.startsAt, locale)} {monthShort(activity.startsAt, locale)}</span>
                </div>
                <h3 className="font-display text-2xl leading-[1.2] font-semibold">{activity.title}</h3>
                {activity.summary && <p className="text-[15px] leading-[1.6] font-light text-night-body">{activity.summary}</p>}
                <Link href={`/activities/${activity.id}`} className="font-display text-[15px] font-semibold text-teal">{t("news.read")} →</Link>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-night-muted">{t("home.emptyPast")}</p>
        )}
      </section>

      <section className="mx-auto max-w-[1200px] px-4 py-20 sm:px-10">
        <div className="flex flex-wrap items-center justify-between gap-8 bg-night-3 p-10">
          <div>
            <h2 className="mb-2 font-display text-[32px] font-bold">{t("news.newsletter.titleDark")}</h2>
            <p className="text-[15px] text-night-muted">{t("news.newsletter.body")}</p>
          </div>
          <NewsletterForm
            labelClass="text-[13px] text-night-muted"
            inputClass="w-72 rounded-[2px] border border-night-edge bg-night px-3.5 py-[13px] text-[15px] text-white"
            buttonClass="rounded-[2px] bg-teal px-[22px] py-3.5 font-display text-[15px] font-semibold text-night disabled:opacity-60"
            messageClass="text-teal"
          />
        </div>
      </section>

      <NewsFooter variant="dark" />
    </div>
  );
}
