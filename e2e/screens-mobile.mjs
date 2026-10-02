// Phone-width screenshots (390px) of the main screens in every theme.
import { base, launch, login, password, themes } from "./lib.mjs";

const out = process.argv[2] ?? "e2e/screens";
const browser = await launch();
for (const theme of themes) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await ctx.addCookies([{ name: "theme", value: theme, url: base }]);
  const page = await ctx.newPage();
  await page.goto(base);
  await page.screenshot({ path: `${out}/m-${theme}-news.png`, fullPage: true });
  const app = await login(ctx, "ana@reform.test");
  for (const [name, path] of [["board", "/app/workspace/de000000-0000-4000-8000-000000000201"], ["library", "/app/library"], ["assessments", "/app/assessments"], ["messages", "/app/messages"]]) {
    await app.goto(base + path);
    await app.waitForLoadState("networkidle");
    await app.screenshot({ path: `${out}/m-${theme}-${name}.png` });
  }
  await ctx.close();
}
await browser.close();
void password;
