import { getLocale, getTranslations } from "next-intl/server";
import { LibraryColor, LibraryStudio } from "@/components/library/library-views";
import { requireProfile } from "@/lib/auth";
import { getLibrary, parseLibraryQuery } from "@/lib/library-server";
import { getTheme } from "@/lib/theme";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("library") };
}

export default async function LibraryPage({ searchParams }: PageProps<"/app/library">) {
  const profile = await requireProfile();
  const [params, theme, locale, t] = await Promise.all([searchParams, getTheme(profile.theme), getLocale(), getTranslations("library")]);
  const data = await getLibrary(profile, parseLibraryQuery(params), t("shared"));

  if (theme === "color") return <LibraryColor data={data} locale={locale} />;
  return <LibraryStudio data={data} locale={locale} variant={theme} />;
}
