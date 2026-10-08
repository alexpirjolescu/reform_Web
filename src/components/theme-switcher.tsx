import { getTranslations } from "next-intl/server";
import { setTheme } from "@/lib/theme-actions";
import { themes, type Theme } from "@/lib/theme";

const swatches: Record<Theme, string> = {
  white: "linear-gradient(135deg, #ffffff 50%, #77bfb2 50%)",
  dark: "linear-gradient(135deg, #221f20 50%, #77bfb2 50%)",
  color: "conic-gradient(#e28ba3 0 25%, #e1b345 0 50%, #79569a 0 75%, #dd6937 0)",
};

/** Lets anyone (visitors included) pick white, dark or colour, as an iOS segmented control.
 * Signed-in users keep it on their profile. `tone` is kept for callers; the control follows the theme. */
export async function ThemeSwitcher({ current }: { current: Theme; tone?: "light" | "dark" }) {
  const t = await getTranslations("theme");

  return (
    <form action={setTheme} className="ui-seg" aria-label={t("label")}>
      {themes.map((theme) => (
        <button key={theme} type="submit" name="theme" value={theme} aria-pressed={theme === current} title={t(theme)} className="px-2.5">
          <span
            aria-hidden="true"
            className="block size-[18px] rounded-full"
            style={{ background: swatches[theme], boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.18)" }}
          />
          <span className="sr-only">{t(theme)}</span>
        </button>
      ))}
    </form>
  );
}
