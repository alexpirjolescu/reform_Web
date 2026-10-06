// Invitations end to end: staff create an invite link in the app, the invited person accepts it;
// plus both kinds of emailed link (Supabase's default, and the repo's template). Local stack only.
// Usage: node --env-file=.env.local e2e/invite.mjs
import { createClient } from "@supabase/supabase-js";
import { base, check, context, launch, login } from "./lib.mjs";

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

  // 2) Repo template: {{ .SiteURL }}/auth/accept?token_hash=…&type=invite (and the older /auth/confirm form)
  const b = await invite(`hash-${stamp}@reform.test`);
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await pageB.goto(`${base}/auth/accept?token_hash=${b.properties.hashed_token}&type=invite`);
  await pageB.click("form:has(input[name=token_hash]) button[type=submit]");
  await choosePassword(pageB, "template link");
  const b2 = await invite(`hash2-${stamp}@reform.test`);
  const pageB2 = await (await browser.newContext()).newPage();
  await pageB2.goto(`${base}/auth/confirm?token_hash=${b2.properties.hashed_token}&type=invite&next=/auth/set-password`);
  await choosePassword(pageB2, "older template link");

  // 3) Staff invite a student with a link to copy, from the administration area.
  const staffCtx = await context(browser);
  const staff = await login(staffCtx, "mentor@reform.test");
  await staff.goto(`${base}/app/admin`);
  check(await staff.locator("a[href='/app/admin/invites']").count() > 0, "staff see invitations in the administration area");
  await staff.goto(`${base}/app/admin/invites`);
  const roles = await staff.locator("#role option").evaluateAll((options) => options.map((o) => o.value));
  check(!roles.includes("admin"), "staff can't invite admins");
  const email = `student-${stamp}@reform.test`;
  await staff.fill("#fullName", "Elev Invitat");
  await staff.fill("#email", email);
  await staff.selectOption("#role", "student");
  await staff.selectOption("#schoolId", { index: 1 });
  await staff.click("button[name=delivery][value=link]");
  const linkField = staff.locator("input[readonly][value*='/auth/accept?']").first();
  await linkField.waitFor({ timeout: 15000 });
  const link = await linkField.inputValue();
  check(link.startsWith(`${base}/auth/accept?`), "invite link points to this site");
  await staff.reload();
  check(await staff.locator(`text=${email}`).count() > 0, "the invitation is listed as open");

  // A link preview (only loads the page) must not use up the link.
  const preview = await (await browser.newContext()).newPage();
  await preview.goto(link);
  await preview.goto(link);
  const invitedCtx = await context(browser);
  const invited = await invitedCtx.newPage();
  await invited.goto(link);
  await invited.click("form:has(input[name=token_hash]) button[type=submit]");
  await choosePassword(invited, "staff invite link");
  await staff.reload();
  check(await staff.locator(`text=${email}`).count() === 0, "accepted invitation leaves the open list");

  // Inviting someone who already has an account is refused.
  await staff.fill("#fullName", "Elev Invitat");
  await staff.fill("#email", email);
  await staff.selectOption("#schoolId", { index: 1 });
  await staff.click("button[name=delivery][value=link]");
  await staff.waitForSelector("[role=alert]:has-text('cont activ')", { timeout: 15000 });
  check(true, "an active account can't be invited again");

  // By email, then a fresh link from the open list, then withdraw it.
  const emailed = `emailed-${stamp}@reform.test`;
  await staff.reload();
  await staff.fill("#fullName", "Coleg Nou");
  await staff.fill("#email", emailed);
  await staff.selectOption("#role", "staff");
  await staff.click("button[name=delivery][value=email]");
  await staff.waitForSelector(`[role=status]:has-text('${emailed}')`, { timeout: 15000 });
  check(true, "invitation sent by email");
  await staff.reload();
  const row = staff.locator("li", { hasText: emailed });
  await row.locator("button", { hasText: "link nou" }).click();
  await row.locator("input[readonly][value*='/auth/accept?']").waitFor({ timeout: 15000 });
  check(true, "a fresh link for an open invitation");
  await row.locator("button", { hasText: "anulează invitația" }).click();
  await row.locator("button", { hasText: "da, anulează" }).click();
  await staff.waitForFunction((e) => !document.body.innerText.includes(e), emailed, { timeout: 15000 });
  check(true, "invitation withdrawn");

  // Staff can't open account management (admins only).
  await staff.goto(`${base}/app/admin/users`);
  check(!staff.url().includes("/app/admin/users"), "staff are sent away from accounts");

  // 4) Expired or reused link: the error page, not a broken form.
  const ctxC = await browser.newContext();
  const pageC = await ctxC.newPage();
  await pageC.goto(`${base}/auth/set-password`);
  await pageC.waitForURL(/\/auth\/error/);
  check(true, "no session and no token: explains the link expired");
} finally {
  await browser.close();
}
