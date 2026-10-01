export const locales = ["ro", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ro";
export const localeCookie = "locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}
