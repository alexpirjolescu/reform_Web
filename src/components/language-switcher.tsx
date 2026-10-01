import { getLocale, getTranslations } from "next-intl/server";
import { setLocale } from "@/i18n/actions";
import { locales } from "@/i18n/config";

export async function LanguageSwitcher() {
  const [current, t] = await Promise.all([getLocale(), getTranslations("common")]);

  return (
    <form action={setLocale} className="flex items-center gap-1 text-sm" aria-label={t("language")}>
      {locales.map((locale) => (
        <button
          key={locale}
          type="submit"
          name="locale"
          value={locale}
          aria-pressed={locale === current}
          className={`min-h-11 min-w-11 px-2 uppercase ${locale === current ? "font-semibold" : "text-muted hover:text-ink"}`}
        >
          {locale}
        </button>
      ))}
    </form>
  );
}
