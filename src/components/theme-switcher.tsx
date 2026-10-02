import { getTranslations } from "next-intl/server";
import { setTheme } from "@/lib/theme-actions";
import { themes, type Theme } from "@/lib/theme";

const swatches: Record<Theme, string> = {
  white: "linear-gradient(135deg, #ffffff 50%, #77bfb2 50%)",
  dark: "linear-gradient(135deg, #221f20 50%, #77bfb2 50%)",
  color: "conic-gradient(#e28ba3 0 25%, #e1b345 0 50%, #79569a 0 75%, #dd6937 0)",
};

/** Lets anyone (visitors included) pick white, dark or colour. Signed-in users keep it on their profile. */
export async function ThemeSwitcher({ current, tone = "light" }: { current: Theme; tone?: "light" | "dark" }) {
  const t = await getTranslations("theme");
  const ring = tone === "dark" ? "#ffffff" : "#221f20";

  return (
    <form action={setTheme} className="flex items-center gap-1" aria-label={t("label")}>
      {themes.map((theme) => (
        <button
          key={theme}
          type="submit"
          name="theme"
          value={theme}
          aria-pressed={theme === current}
          title={t(theme)}
          className="grid size-11 place-items-center"
        >
          <span
            aria-hidden="true"
            className="block size-6 rounded-full"
            style={{
              background: swatches[theme],
              border: `2px solid ${theme === current ? ring : "transparent"}`,
              outline: theme === current ? "none" : `1px solid ${tone === "dark" ? "#5a5557" : "#bdb9bb"}`,
            }}
          />
          <span className="sr-only">{t(theme)}</span>
        </button>
      ))}
    </form>
  );
}
