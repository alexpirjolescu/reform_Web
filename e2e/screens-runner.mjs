// Screenshots of the quiz runner and a message thread in every theme (local stack).
import { base, context, launch, login, themes } from "./lib.mjs";

const out = process.argv[2] ?? "e2e/screens";
const browser = await launch();
for (const theme of themes) {
  const ctx = await context(browser, theme);
  const page = await login(ctx, "elena@reform.test");
  await page.goto(`${base}/app/assessments/de000000-0000-4000-8000-000000000401`);
  const start = page.locator("button:has-text('Începe quizul'), button:has-text('Continuă')");
  if (await start.count()) await Promise.all([page.waitForURL(/401$/), start.first().click()]);
  await page.waitForSelector("fieldset legend");
  await page.screenshot({ path: `${out}/${theme}-quiz-runner.png` });
  await ctx.close();

  const lead = await context(browser, theme);
  const p2 = await login(lead, "ana@reform.test");
  await p2.goto(`${base}/app/messages`);
  const first = p2.locator("a[href^='/app/messages?c=']").first();
  if (await first.count()) {
    await first.click();
    await p2.waitForURL(/\?c=/);
    await p2.waitForLoadState("networkidle");
  }
  await p2.screenshot({ path: `${out}/${theme}-message-thread.png` });
  await lead.close();
}
await browser.close();
