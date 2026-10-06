import { getTranslations } from "next-intl/server";
import { ColorShell, StudioShell } from "@/components/shells/shells";
import { requireProfile } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { getShellData } from "@/lib/shell";
import { getTheme } from "@/lib/theme";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  if (!hasSupabaseEnv) {
    const t = await getTranslations("setup");
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <h1 className="mb-4 font-display text-4xl font-extrabold">{t("title")}</h1>
        <p className="leading-relaxed">{t("body")}</p>
      </main>
    );
  }

  const profile = await requireProfile();
  const [shell, theme] = await Promise.all([getShellData(profile), getTheme(profile.theme)]);

  if (theme === "color") return <ColorShell shell={shell}>{children}</ColorShell>;
  return <StudioShell shell={shell} theme={theme}>{children}</StudioShell>;
}
