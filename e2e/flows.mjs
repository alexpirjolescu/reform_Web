// End-to-end flows across modules on the local stack (after supabase/demo.sql and scripts/dev-users.mjs).
// Usage: node e2e/flows.mjs
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { base, check, context, launch, login } from "./lib.mjs";

const pdf = join(tmpdir(), "e2e-plan.pdf");
writeFileSync(pdf, "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const stamp = Date.now().toString(36);
const browser = await launch();
const allErrors = [];

try {
  // --- Workspace: core lead creates a board and a task -----------------------
  const leadCtx = await context(browser, "white");
  const lead = await login(leadCtx, "ana@reform.test");
  await lead.goto(`${base}/app/workspace`);
  await lead.click("summary:has-text('proiect nou')");
  await lead.fill("#board-name", `E2E proiect ${stamp}`);
  await Promise.all([lead.waitForURL(/\/app\/workspace\/[0-9a-f-]{36}$/), lead.click("form:has(#board-name) button[type=submit]")]);
  check(await lead.locator("h2", { hasText: "de făcut" }).count() === 1, "board created with default columns");
  await lead.click("text=+ adaugă o sarcină >> nth=0");
  await lead.fill("textarea[id^=new-card-]", "Sarcină de test");
  await lead.keyboard.press("Enter");
  await lead.waitForSelector("text=Sarcină de test");
  check(true, "task added");
  await lead.click("[aria-label='Sarcină de test']");
  await lead.waitForSelector("text=Pași");
  check(true, "task detail opens");

  // --- Library: upload into the school folder ---------------------------------
  await lead.goto(`${base}/app/library?folder=de000000-0000-4000-8000-000000000303`);
  await lead.setInputFiles("input[type=file][multiple]", pdf);
  await lead.waitForSelector("text=e2e-plan.pdf", { timeout: 20000 });
  check(true, "file uploaded to the library");
  const fileLink = lead.locator("a", { hasText: "e2e-plan.pdf" }).first();
  await fileLink.click();
  const download = await lead.request.get(`${base}${await lead.locator("a:has-text('descarcă')").getAttribute("href")}`, { maxRedirects: 0 });
  check(download.status() === 307 || download.status() === 302, `download redirects to a signed URL (${download.status()})`);

  // --- Messages: student writes to the core lead, live delivery ---------------
  const studentCtx = await context(browser, "color");
  const student = await login(studentCtx, "matei@reform.test");
  await student.goto(`${base}/app/messages`);
  await student.click("button[aria-label='Conversație nouă']");
  await student.fill("input[placeholder='caută o persoană']", "Ana");
  await Promise.all([student.waitForURL(/\?c=/), student.click("button:has-text('Ana Popescu')")]);
  await lead.goto(`${base}${new URL(student.url()).pathname}${new URL(student.url()).search}`);
  await lead.waitForLoadState("networkidle");
  await lead.waitForTimeout(1500);
  await student.fill("textarea", `Salut! ${stamp}`);
  await student.keyboard.press("Enter");
  await lead.waitForSelector(`text=Salut! ${stamp}`, { timeout: 15000 });
  check(true, "message arrives live for the recipient");

  // --- Assessments: student takes the quiz, staff marks it -------------------
  await student.goto(`${base}/app/assessments/de000000-0000-4000-8000-000000000401`);
  await Promise.all([student.waitForURL(/401$/), student.click("button:has-text('Începe quizul')")]);
  await student.waitForSelector("text=Stabiliți obiectivul");
  await student.click("label:has-text('Stabiliți obiectivul')");
  await student.click("button:has-text('următoarea')");
  await student.click("label:has-text('un responsabil')");
  await student.click("label:has-text('un termen')");
  await student.click("button:has-text('următoarea')");
  await student.click("label:has-text('Fals')");
  await student.click("button:has-text('următoarea')");
  await student.fill("textarea", "Succesul înseamnă 200 de răspunsuri la sondaj și o dezbatere cu direcțiunea.");
  await student.waitForTimeout(1200);
  await student.click("button:has-text('verifică și trimite')");
  await student.click("button:has-text('trimite')");
  await student.click("button:has-text('da, trimite răspunsurile')");
  await student.waitForSelector("text=am primit predarea ta", { timeout: 15000 });
  check(true, "quiz submitted, waiting for marking");

  const staffCtx = await context(browser, "dark");
  const staff = await login(staffCtx, "mentor@reform.test");
  await staff.goto(`${base}/app/assessments/de000000-0000-4000-8000-000000000401/results`);
  await staff.click("a:has-text('corectează')");
  await staff.waitForSelector("text=corectare");
  await staff.fill("input[name^='points:']", "3");
  await staff.fill("#review-feedback", "Foarte clar. Bravo!");
  await staff.click("button:has-text('Salvează corectarea')");
  await staff.waitForSelector("text=Corectarea a fost salvată");
  check(true, "staff marked the open answer");

  await student.reload();
  await student.waitForSelector("text=Foarte clar. Bravo!");
  check(await student.locator("text=7/7").count() > 0, "student sees score 7/7 and feedback");

  // --- Assignment hand-in -------------------------------------------------------
  await student.goto(`${base}/app/assessments/de000000-0000-4000-8000-000000000402`);
  await Promise.all([student.waitForURL(/402$/), student.click("button:has-text('Începe tema')")]);
  await student.setInputFiles("input[type=file][multiple]", pdf);
  await student.waitForSelector("li:has-text('e2e-plan.pdf')");
  await student.click("button:has-text('predă tema')");
  await student.click("button:has-text('da, predă tema')");
  await student.waitForSelector("text=am primit predarea ta", { timeout: 15000 });
  check(true, "assignment handed in with a file");

  // --- News: staff publishes an activity, visitors see it ---------------------
  await staff.goto(`${base}/app/admin/news/new`);
  await staff.fill("#act-title", `Activitate E2E ${stamp}`);
  await staff.fill("#act-summary", "Rezumat de test.");
  await staff.selectOption("#act-status", "published");
  await Promise.all([staff.waitForURL(/admin\/news\?saved=/), staff.click("form:has(#act-title) button[type=submit]")]);
  const visitorCtx = await context(browser, "white");
  const visitor = await visitorCtx.newPage();
  await visitor.goto(base);
  check(await visitor.locator(`text=Activitate E2E ${stamp}`).count() > 0, "published activity shows on the public panel");

  // --- Access rules in the UI ------------------------------------------------
  const outsiderCtx = await context(browser, "white");
  const outsider = await login(outsiderCtx, "elena@reform.test");
  const res = await outsider.goto(`${base}/app/workspace/de000000-0000-4000-8000-000000000201`);
  check(res.status() === 404, "student of another school gets 404 on a foreign board");
  await outsider.goto(`${base}/app/admin/users`);
  check(!outsider.url().includes("/admin/"), "student is sent away from admin pages");

  // --- Theme choice sticks to the profile ------------------------------------
  await outsider.goto(`${base}/app/workspace`);
  await outsider.click("form[aria-label='Aspect'] button[value='dark'] >> nth=0");
  await outsider.waitForLoadState("networkidle");
  check((await outsider.locator("html").getAttribute("data-theme")) === "dark", "theme switches to dark");

  for (const c of [leadCtx, studentCtx, staffCtx, visitorCtx, outsiderCtx]) allErrors.push(...c.errors);
} finally {
  await browser.close();
}
const real = allErrors.filter((e) => !/favicon|Failed to load resource: the server responded with a status of 404/.test(e));
console.log(real.length ? `console errors:\n${real.join("\n")}` : "no console errors");
