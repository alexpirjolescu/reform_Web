// Screenshots of every module in every theme, for visual review against docs/design/mockups.
// Usage: NODE_PATH=$(npm root -g) node e2e/screens.mjs [outDir]
import { mkdirSync } from "node:fs";
import { base, context, launch, login, themes } from "./lib.mjs";

const out = process.argv[2] ?? "e2e/screens";
mkdirSync(out, { recursive: true });
const browser = await launch();
const errors = [];

for (const theme of themes) {
  const visitor = await context(browser, theme);
  const page = await visitor.newPage();
  for (const [name, path] of [["news", "/"], ["calendar", "/activities"], ["activity", "/activities/de000000-0000-4000-8000-000000000101"], ["about", "/about"], ["login", "/auth/login"]]) {
    await page.goto(base + path);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${out}/${theme}-${name}.png`, fullPage: name === "news" });
  }
  errors.push(...visitor.errors);
  await visitor.close();

  const student = await context(browser, theme);
  const app = await login(student, "ana@reform.test");
  for (const [name, path] of [
    ["workspace-list", "/app/workspace"],
    ["workspace-board", "/app/workspace/de000000-0000-4000-8000-000000000201"],
    ["library", "/app/library"],
    ["library-folder", "/app/library?folder=de000000-0000-4000-8000-000000000302"],
    ["assessments", "/app/assessments"],
    ["messages", "/app/messages"],
  ]) {
    await app.goto(base + path);
    await app.waitForLoadState("networkidle");
    await app.screenshot({ path: `${out}/${theme}-${name}.png` });
  }
  errors.push(...student.errors);
  await student.close();

  const staff = await context(browser, theme);
  const s = await login(staff, "admin@reform.test");
  for (const [name, path] of [
    ["staff-assessments", "/app/assessments"],
    ["staff-results", "/app/assessments/de000000-0000-4000-8000-000000000401/results"],
    ["admin-news", "/app/admin/news"],
    ["admin-users", "/app/admin/users"],
  ]) {
    await s.goto(base + path);
    await s.waitForLoadState("networkidle");
    await s.screenshot({ path: `${out}/${theme}-${name}.png` });
  }
  errors.push(...staff.errors);
  await staff.close();
}
await browser.close();
console.log(errors.length ? `console errors:\n${errors.join("\n")}` : "no console errors");
