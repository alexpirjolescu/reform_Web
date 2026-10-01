import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";

// Public news panel (PRD module 1). Phase 1 replaces the empty states with published activities.
export default async function HomePage() {
  const t = await getTranslations();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-6 px-4 py-6 sm:px-10">
        <Link href="/" aria-label="re_form ed">
          <Logo variant="ed" height={40} priority />
        </Link>
        <div className="ml-auto flex items-center gap-4">
          <LanguageSwitcher />
          <Link href="/auth/login" className="flex min-h-11 items-center bg-teal px-5 font-display font-semibold text-ink">
            {t("common.login")}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-10">
        <section className="grid gap-10 py-16 md:grid-cols-2 md:items-end">
          <div>
            <p className="mb-5 text-sm tracking-wide text-teal-text">{t("home.kicker")}</p>
            <h1 className="font-display text-6xl leading-[0.95] font-extrabold tracking-tight sm:text-8xl">
              {t("home.title")}
              <span aria-hidden="true" className="ml-2 inline-block h-[0.15em] w-[0.9em] bg-teal align-baseline" />
            </h1>
          </div>
          <div>
            <p className="mb-8 text-lg leading-relaxed font-light">{t("home.mission")}</p>
            <a href="#upcoming" className="inline-flex min-h-12 items-center bg-ink px-6 font-display font-semibold text-paper">
              {t("home.seeUpcoming")}
            </a>
          </div>
        </section>

        <section id="upcoming" aria-labelledby="upcoming-title" className="border-t border-ink py-12">
          <h2 id="upcoming-title" className="mb-4 font-display text-5xl font-bold text-teal-strong">
            {t("home.upcoming")}
          </h2>
          <p className="text-muted">{t("home.emptyUpcoming")}</p>
        </section>

        <section aria-labelledby="past-title" className="border-t border-line py-12">
          <h2 id="past-title" className="mb-4 font-display text-5xl font-bold text-teal-strong">
            {t("home.past")}
          </h2>
          <p className="text-muted">{t("home.emptyPast")}</p>
        </section>
      </main>

      <footer className="bg-ink text-paper">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-4 py-10 sm:px-10">
          <Logo variant="ed-white" height={38} />
          <span className="text-sm text-[#bdb9bb]">re_form {new Date().getFullYear()} ©</span>
        </div>
      </footer>
    </div>
  );
}
