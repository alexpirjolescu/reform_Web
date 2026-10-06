// Dates are shown in Romanian time, where re_form's meetings happen.
export const timeZone = "Europe/Bucharest";

function fmt(locale: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ro-RO", { timeZone, ...options });
}

export function dayNumber(iso: string, locale: string) {
  return fmt(locale, { day: "2-digit" }).format(new Date(iso));
}

export function monthShort(iso: string, locale: string) {
  return fmt(locale, { month: "short" }).format(new Date(iso)).replace(".", "");
}

export function weekdayLong(iso: string, locale: string) {
  return fmt(locale, { weekday: "long" }).format(new Date(iso));
}

export function timeOfDay(iso: string, locale: string) {
  return fmt(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function fullDate(iso: string, locale: string) {
  return fmt(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

export function shortDate(iso: string, locale: string) {
  return fmt(locale, { day: "numeric", month: "short" }).format(new Date(iso)).replace(".", "");
}

/** "vineri, 9 octombrie la 16:00"; the year is added when it is not the current one. */
export function dateTime(iso: string, locale: string, now = new Date()) {
  const date = new Date(iso);
  const year = date.getFullYear() === now.getFullYear() ? undefined : "numeric";
  return fmt(locale, { weekday: "long", day: "numeric", month: "long", year, hour: "2-digit", minute: "2-digit" }).format(date);
}

/** "14:02", "ieri" / "yesterday", weekday, or a short date — for message lists. */
export function relativeStamp(iso: string, locale: string, now = new Date()) {
  const date = new Date(iso);
  const day = (d: Date) => fmt(locale, { year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  if (day(date) === day(now)) return timeOfDay(iso, locale);
  const yesterday = new Date(now.getTime() - 86_400_000);
  if (day(date) === day(yesterday)) return locale === "en" ? "yesterday" : "ieri";
  if (now.getTime() - date.getTime() < 6 * 86_400_000) return fmt(locale, { weekday: "short" }).format(date);
  return shortDate(iso, locale);
}

export function fileSize(bytes: number, locale: string) {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || value >= 10 ? 0 : 1;
  return `${value.toLocaleString(locale === "en" ? "en-GB" : "ro-RO", { maximumFractionDigits: digits })} ${units[unit]}`;
}

/** Whole days from today (Romanian time) until a date; negative when it has passed. */
export function daysUntil(isoDate: string, now = new Date()) {
  const today = fmt("en", { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => today.find((p) => p.type === type)?.value ?? "";
  const todayUtc = Date.UTC(Number(part("year")), Number(part("month")) - 1, Number(part("day")));
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - todayUtc) / 86_400_000);
}

export function monthNumber(iso: string, locale: string) {
  return fmt(locale, { month: "2-digit" }).format(new Date(iso));
}

/** "vineri, 16 oct, 23:59": deadlines for assessments. */
export function deadline(iso: string, locale: string) {
  return fmt(locale, { weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    .format(new Date(iso))
    .replaceAll(".", "");
}

/** Value for <input type="datetime-local"> in Romanian time. */
export function toLocalInput(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Inverse of toLocalInput: a Romanian wall-clock time from a datetime-local input, as an ISO instant. */
export function fromLocalInput(local: string) {
  const asUtc = Date.parse(`${local}:00Z`);
  if (Number.isNaN(asUtc)) return null;
  const shown = Date.parse(`${toLocalInput(new Date(asUtc).toISOString())}:00Z`);
  return new Date(asUtc - (shown - asUtc)).toISOString();
}
