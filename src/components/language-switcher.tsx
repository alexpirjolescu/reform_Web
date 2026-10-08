import { getLocale, getTranslations } from "next-intl/server";
import { setLocale } from "@/i18n/actions";
import { locales } from "@/i18n/config";

/** ro / en as a small iOS segmented control. */
export async function LanguageSwitcher({ className = "" }: { className?: string }) {
  const [current, t] = await Promise.all([getLocale(), getTranslations("common")]);

  return (
    <form action={setLocale} className={`ui-seg ${className}`} aria-label={t("language")}>
      {locales.map((locale) => (
        <button key={locale} type="submit" name="locale" value={locale} aria-pressed={locale === current} className="px-3 text-[13px] uppercase">
          {locale}
        </button>
      ))}
    </form>
  );
}
