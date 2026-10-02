import "server-only";
import { cookies } from "next/headers";

/**
 * The three looks from the design canvas (docs/design/README.md):
 *   white = B · White paper, dark = A · Dark studio, color = C · Colour system.
 * Each one has its own layouts, not just its own colours.
 */
export const themes = ["white", "dark", "color"] as const;
export type Theme = (typeof themes)[number];
export const themeCookie = "theme";
export const defaultTheme: Theme = "white";

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (themes as readonly string[]).includes(value);
}

/** Visitors choose with a cookie; signed-in users also store it on their profile. */
export async function getTheme(profileTheme?: string | null): Promise<Theme> {
  const stored = (await cookies()).get(themeCookie)?.value;
  if (isTheme(stored)) return stored;
  if (isTheme(profileTheme)) return profileTheme;
  return defaultTheme;
}
