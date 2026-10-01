import { getTranslations } from "next-intl/server";

type Module = "workspace" | "library" | "assessments" | "messages";

/** Temporary page body for modules that later phases build (see docs/PRD.md, Release plan). */
export async function ModulePlaceholder({ module }: { module: Module }) {
  const t = await getTranslations();

  return (
    <section className="flex max-w-2xl flex-col gap-4">
      <h1 className="font-display text-5xl font-extrabold tracking-tight text-teal-strong">{t(`app.${module}.title`)}</h1>
      <p className="text-lg leading-relaxed">{t(`app.${module}.body`)}</p>
      <span className="self-start bg-honey px-3 py-1 text-sm font-medium">{t("common.comingSoon")}</span>
    </section>
  );
}
