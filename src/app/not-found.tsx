import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-start justify-center gap-5 px-4 py-16">
      <p className="font-fun text-6xl font-bold text-th-heading">404</p>
      <h1 className="font-display text-4xl font-extrabold">{t("title")}</h1>
      <p className="text-lg leading-relaxed text-th-muted">{t("body")}</p>
      <div className="flex flex-wrap gap-3">
        <Link href="/" className="ui-btn ui-filled">{t("home")}</Link>
        <Link href="/app" className="ui-btn ui-plain">{t("app")}</Link>
      </div>
    </main>
  );
}
