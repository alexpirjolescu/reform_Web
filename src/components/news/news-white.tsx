import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { dayNumber, fullDate, monthNumber, timeOfDay, weekdayLong } from "@/lib/format";
import { categoryColor } from "@/lib/news";
import { ActivityVisual, CategoryChips, CategoryLabel, SchoolSearchForm, type NewsProps } from "./shared";
import { NewsletterForm } from "./newsletter-form";
import { NewsFooter } from "./footer";

// Design B · White paper: a monthly newsletter issue (docs/design/mockups/B-news.dc.html)
export async function NewsWhite(props: NewsProps) {
  const { locale, upcoming, past, stats, schools, filters, signedIn, theme } = props;
  const t = await getTranslations();
  const [lead, ...agenda] = upcoming;
  const issue = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ro-RO", { month: "long", year: "numeric" }).format(new Date());

  return (
    <div className="min-h-screen bg-white text-ink">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-6 px-4 py-[18px] text-sm sm:px-10">
        <span className="text-muted">{t("news.issueOf", { month: issue })}</span>
        <div className="flex flex-wrap items-center gap-6">
          <nav aria-label={t("news.mainNav")} className="flex flex-wrap gap-6">
            <a href="#urmeaza" className="hover:text-teal-text">{t("news.nav.activities")}</a>
            <Link href="/about" className="hover:text-teal-text">{t("news.nav.about")}</Link>
            <Link href="/about#schools" className="hover:text-teal-text">{t("news.nav.schools")}</Link>
            <Link href="/about#contact" className="hover:text-teal-text">{t("news.nav.contact")}</Link>
          </nav>
          <LanguageSwitcher className="text-muted" />
          <ThemeSwitcher current={theme} />
          <Link href={signedIn ? "/app" : "/auth/login"} className="bg-ink px-[18px] py-[11px] font-display text-[15px] font-semibold text-white">
            {signedIn ? t("news.openApp") : t("common.login")}
          </Link>
        </div>
      </div>

      <header className="mx-auto max-w-[1200px] px-4 sm:px-10">
        <div className="flex flex-wrap items-end justify-between gap-8 border-t-[3px] border-b border-ink pt-10 pb-9">
          <Link href="/" aria-label={t("news.home")} className="flex">
            <Logo height={76} priority />
          </Link>
          <div className="max-w-[420px]">
            <p className="mb-1.5 font-display text-[22px] font-bold">{t("news.masthead")}</p>
            <p className="text-[15px] leading-[1.55] text-muted">{t("news.mastheadBody")}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-5 border-b border-line py-3.5">
          <CategoryChips
            filters={filters}
            chip="border-b-4 border-transparent py-2 text-[15px] text-muted hover:text-ink"
            activeChip="border-b-4 border-teal py-2 text-[15px] font-medium text-ink"
          />
          <SchoolSearchForm
            filters={filters}
            schools={schools}
            labelClass="text-muted"
            fieldClass="min-h-11 border border-ink bg-white px-2.5 text-sm text-ink"
            buttonClass="min-h-11 bg-ink px-4 text-sm text-white"
          />
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-4 pt-12 sm:px-10">
        <div id="urmeaza" className="flex scroll-mt-6 flex-wrap">
          {lead ? (
            <article className="flex flex-[2_1_600px] flex-col gap-[18px] pr-0 pb-10 md:pr-10">
              <p className="text-sm font-medium text-teal-text">
                _ {t("home.upcoming")} · <CategoryLabel category={lead.category} />
              </p>
              <h1 className="font-display text-[44px] leading-[1.02] font-extrabold tracking-[-0.02em] sm:text-[60px]">{lead.title}</h1>
              <p className="text-[15px] text-muted">
                {weekdayLong(lead.startsAt, locale)}, {fullDate(lead.startsAt, locale)} · {timeOfDay(lead.startsAt, locale)}
                {lead.location ? ` · ${lead.location}` : ""}
              </p>
              <ActivityVisual activity={lead} ratio="16 / 8" />
              {lead.summary && <p className="max-w-[680px] text-lg leading-[1.65] font-light">{lead.summary}</p>}
              <div className="flex flex-wrap gap-6 font-display font-semibold">
                <Link href={`/activities/${lead.id}`} className="text-teal-text">{t("news.detailsAndSignup")} →</Link>
                <a href={`/activities/${lead.id}/calendar.ics`} className="hover:text-teal-text">{t("news.addToCalendar")}</a>
              </div>
            </article>
          ) : (
            <p className="flex-[2_1_600px] pb-10 text-muted">{t("home.emptyUpcoming")}</p>
          )}

          <aside aria-labelledby="agenda-title" className="flex-[1_1_320px] pb-10 md:border-l md:border-ink md:pl-8">
            <h2 id="agenda-title" className="mb-2 font-display text-[30px] font-bold text-teal-strong">{t("news.agenda")}</h2>
            {agenda.slice(0, 4).map((activity) => (
              <Link key={activity.id} href={`/activities/${activity.id}`} className="grid grid-cols-[70px_1fr] gap-4 border-b border-line py-[18px] hover:text-teal-text">
                <span className="font-display text-[26px] leading-[1.1] font-bold">
                  {dayNumber(activity.startsAt, locale)}.{monthNumber(activity.startsAt, locale)}
                </span>
                <span className="flex flex-col gap-1.5">
                  <span className="font-display text-lg leading-[1.3] font-semibold">{activity.title}</span>
                  <span className="inline-flex items-center gap-2 text-[13px] text-muted">
                    <span aria-hidden="true" className="size-[9px]" style={{ background: categoryColor[activity.category] }} />
                    <CategoryLabel category={activity.category} /> · {timeOfDay(activity.startsAt, locale)}
                  </span>
                </span>
              </Link>
            ))}
            {agenda.length === 0 && <p className="py-4 text-sm text-muted">{t("news.agendaEmpty")}</p>}
            <Link href="/activities" className="mt-5 inline-block font-display font-semibold text-teal-text">{t("news.fullCalendar")} →</Link>
          </aside>
        </div>

        <section className="border-t border-ink pt-10">
          <div className="mb-8 flex flex-wrap items-baseline justify-between gap-5">
            <h2 className="font-display text-[52px] font-extrabold tracking-[-0.02em] text-teal-strong">{t("home.past")}</h2>
            <Link href="/activities?when=past" className="font-display font-semibold hover:text-teal-text">{t("news.archiveIssues")} →</Link>
          </div>
          {past.length ? (
            <div className="grid sm:grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
              {past.map((activity, index) => (
                <article key={activity.id} className={`flex flex-col gap-3 px-0 pb-10 sm:px-7 ${index ? "sm:border-l sm:border-line" : "sm:pl-0"}`}>
                  <ActivityVisual activity={activity} />
                  <span className="text-[13px] text-muted">
                    <CategoryLabel category={activity.category} /> · {fullDate(activity.startsAt, locale)}
                  </span>
                  <h3 className="font-display text-2xl leading-[1.2] font-bold">{activity.title}</h3>
                  {activity.summary && <p className="text-[15px] leading-[1.6] font-light">{activity.summary}</p>}
                  <Link href={`/activities/${activity.id}`} className="font-display text-[15px] font-semibold text-teal-text">{t("news.readArticle")} →</Link>
                </article>
              ))}
            </div>
          ) : (
            <p className="pb-10 text-muted">{t("home.emptyPast")}</p>
          )}
        </section>

        <section aria-label={t("news.stats.label")} className="grid grid-cols-2 border-y border-ink md:grid-cols-4">
          {(["schools", "students", "activities", "thisYear"] as const).map((key, index) => (
            <div key={key} className={`px-0 py-8 sm:px-7 ${index ? "border-l border-line" : "sm:pl-0"}`}>
              <div className="font-display text-5xl leading-none font-extrabold">{stats[key]}</div>
              <div aria-hidden="true" className="my-3 h-1.5 w-10 bg-teal" />
              <div className="text-sm text-muted">{t(`news.stats.${key}`)}</div>
            </div>
          ))}
        </section>

        <section className="flex flex-wrap items-end justify-between gap-10 pt-[72px] pb-[88px]">
          <div className="max-w-[520px]">
            <h2 className="mb-2.5 font-display text-[40px] leading-[1.05] font-extrabold">{t("news.newsletter.titleWhite")}</h2>
            <p className="text-[15px] text-muted">_ {t("news.newsletter.bodyShort")}</p>
          </div>
          <NewsletterForm
            labelClass="text-[13px] text-muted"
            inputClass="w-[300px] border-2 border-ink px-3.5 py-3.5 text-[15px]"
            buttonClass="border-2 border-ink bg-ink px-6 py-[15px] font-display text-[15px] font-semibold text-white disabled:opacity-60"
            messageClass="text-teal-text"
          />
        </section>
      </main>

      <NewsFooter variant="white" />
    </div>
  );
}
