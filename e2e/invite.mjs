// Invite links, both kinds: Supabase's default email (session in the URL fragment) and the
// repo's template (token_hash to /auth/confirm). Local stack only.
// Usage: node --env-file=.env.local e2e/invite.mjs
import { createClient } from "@supabase/supabase-js";
import { base, check, launch } from "./lib.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!/127\.0\.0\.1|localhost/.test(url ?? "")) throw new Error("local stack only");
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const browser = await launch();

async function invite(email) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "invite", email, options: { redirectTo: `${base}/auth/set-password` } });
  if (error) throw error;
  await admin.from("profiles").insert({ id: data.user.id, full_name: "Invite Test", role: "staff" });
  return data;
}

async function choosePassword(page, label) {
  await page.waitForSelector("#password", { timeout: 20000 });
  check(true, `${label}: "choose a password" opens signed in`);
  await page.fill("#password", "parola-test-2026");
  await page.fill("#confirm", "parola-test-2026");
  await Promise.all([page.waitForURL(/\/app/), page.click("form:has(#password) button[type=submit]")]);
  check(true, `${label}: password saved, lands in the app`);
}

try {
  const stamp = Date.now().toString(36);
  // 1) Default Supabase email: the link goes through Supabase's /verify and comes back with #access_token=…
  const a = await invite(`fragment-${stamp}@reform.test`);
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await pageA.goto(a.properties.action_link);
  await choosePassword(pageA, "default email link");

  // 2) Repo template: {{ .SiteURL }}/auth/confirm?token_hash=…&type=invite&next=/auth/set-password
  const b = await invite(`hash-${stamp}@reform.test`);
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await pageB.goto(`${base}/auth/confirm?token_hash=${b.properties.hashed_token}&type=invite&next=/auth/set-password`);
  await choosePassword(pageB, "template link");

  // 3) Expired or reused link: the error page, not a broken form.
  const ctxC = await browser.newContext();
  const pageC = await ctxC.newPage();
  await pageC.goto(`${base}/auth/set-password`);
  await pageC.waitForURL(/\/auth\/error/);
  check(true, "no session and no token: explains the link expired");
} finally {
  await browser.close();
}
