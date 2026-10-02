import { getLocale, getTranslations } from "next-intl/server";
import { setLocale } from "@/i18n/actions";
import { locales } from "@/i18n/config";

export async function LanguageSwitcher({ className = "" }: { className?: string }) {
  const [current, t] = await Promise.all([getLocale(), getTranslations("common")]);

  return (
    <form action={setLocale} className={`flex items-center text-sm ${className}`} aria-label={t("language")}>
      {locales.map((locale, index) => (
        <span key={locale} className="flex items-center">
          {index > 0 && <span aria-hidden="true" className="opacity-60">/</span>}
          <button
            type="submit"
            name="locale"
            value={locale}
            aria-pressed={locale === current}
            className={`min-h-11 min-w-9 px-1 ${locale === current ? "font-semibold" : "opacity-70 hover:opacity-100"}`}
          >
            {locale}
          </button>
        </span>
      ))}
    </form>
  );
}
