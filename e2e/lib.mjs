// Shared helpers for the local end-to-end checks (run against `next start` + the local Supabase stack).
import { chromium } from "playwright";

export const base = process.env.E2E_BASE_URL ?? "http://localhost:3000";
export const password = "reform-dev-2026";
export const themes = ["white", "dark", "color"];

export async function launch() {
  return chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
}

/** New browser context with the chosen theme cookie, console errors collected in `errors`. */
export async function context(browser, theme = "white", locale = "ro") {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 }, locale: "ro-RO" });
  await ctx.addCookies([
    { name: "theme", value: theme, url: base },
    { name: "locale", value: locale, url: base },
  ]);
  ctx.errors = [];
  ctx.on("page", (page) => {
    page.on("console", (msg) => {
      if (msg.type() === "error") ctx.errors.push(`${page.url()}: ${msg.text()}`);
    });
    page.on("pageerror", (err) => ctx.errors.push(`${page.url()}: ${err.message}`));
  });
  return ctx;
}

export async function login(ctx, email) {
  const page = await ctx.newPage();
  await page.goto(`${base}/auth/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([page.waitForURL(/\/app/), page.click('form:has(input[name="password"]) button[type="submit"]')]);
  return page;
}

export function check(ok, label) {
  if (!ok) throw new Error(`FAIL ${label}`);
  console.log(`PASS ${label}`);
}
