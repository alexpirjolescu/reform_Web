import "server-only";
import { headers } from "next/headers";

const isLocal = (url: string) => /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(url);

/**
 * The public address of this site, for links in emails (invites, password resets) and calendar files.
 *
 * 1. NEXT_PUBLIC_SITE_URL, unless it still says localhost while running on Vercel;
 * 2. on Vercel production, the project's production address (VERCEL_PROJECT_PRODUCTION_URL);
 * 3. otherwise the address the current request came in on (previews, local development).
 */
export async function getSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  const onVercel = Boolean(process.env.VERCEL);
  if (configured && !(onVercel && isLocal(configured))) return configured;

  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const proto = h.get("x-forwarded-proto") ?? (isLocal(`//${host}`) ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch {
    // Outside a request (build time): fall through.
  }
  return configured || "http://localhost:3000";
}
