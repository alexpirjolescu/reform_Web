// The news article editor: templates, blocks in any order, media beside the text or side by side,
// the preview, and the public page. Local stack only.
// Usage: node --env-file=.env.local e2e/article.mjs
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { base, check, context, launch, login } from "./lib.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!/127\.0\.0\.1|localhost/.test(url ?? "")) throw new Error("local stack only");
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const png = join(tmpdir(), "e2e-article.png");
writeFileSync(png, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
const stamp = Date.now().toString(36);
const browser = await launch();
let id = null;

try {
  const ctx = await context(browser, "white");
  const staff = await login(ctx, "mentor@reform.test");
  await staff.goto(`${base}/app/admin/news/new`);
  await staff.fill("#act-title", `E2E articol ${stamp}`);
  await staff.fill("#act-summary", "Un articol construit din blocuri.");

  // Five templates; the recap one fills the article with nine blocks.
  const picker = staff.locator("section[aria-labelledby=tpl-title]");
  check((await picker.locator("li button").count()) === 6, "five templates and a blank page");
  await picker.locator("button", { hasText: "După eveniment" }).click();
  const blocks = staff.locator("ol[aria-label='Blocurile articolului'] > li");
  check((await blocks.count()) === 9, "template adds its blocks");
  const block = (n) => blocks.nth(n - 1);

  await block(1).locator("textarea").fill(`Introducere ${stamp}.`);
  await block(2).locator("input[type=file]").setInputFiles(png);
  await block(2).locator("img").waitFor();
  await block(3).locator("textarea").fill(`Povestea zilei ${stamp}. `.repeat(8));
  await block(4).locator("input[type=file]").setInputFiles(png);
  await block(4).locator("img").waitFor();
  await block(5).locator("textarea").fill("Ce au învățat participanții.");
  await block(6).locator("textarea").fill(`Citat ${stamp}`);
  await block(7).locator("input[type=file]").setInputFiles([png, png]);
  await block(7).locator("img").nth(1).waitFor();
  await block(8).locator("input[type=url]").fill("https://youtu.be/dQw4w9WgXcQ");
  await block(8).getByRole("button", { name: "adaugă linkul" }).click();
  await block(9).getByLabel("Textul butonului").fill("Vezi toate fotografiile");
  await block(9).getByLabel("Unde duce (https://…)").fill("https://reform.ro/galerie");
  check(true, "blocks filled: photo across, photo beside the text, two side by side, a YouTube video, a button");

  // Drag the quote above the introduction with the keyboard (Space, arrows, Space). A tall window keeps
  // every block on screen, as the headless browser doesn't scroll while dragging.
  await staff.setViewportSize({ width: 1280, height: 4200 });
  await staff.locator("#act-article").evaluate((el) => el.scrollIntoView({ block: "start" }));
  const handle = block(6).getByRole("button", { name: /Trage blocul 6/ });
  await handle.focus();
  await staff.keyboard.press("Space");
  for (let i = 0; i < 8; i++) {
    await staff.keyboard.press("ArrowUp");
    await staff.waitForTimeout(350);
  }
  await staff.keyboard.press("Space");
  await staff.waitForTimeout(400);
  const label = (n) => block(n).locator("div[role=group]").first().getAttribute("aria-label");
  const labels = await staff.locator("ol[aria-label='Blocurile articolului'] div[role=group]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  check(labels[0] === "1. citat", `blocks move by drag and drop (${labels.slice(0, 3).join(", ")})`);
  await block(1).getByRole("button", { name: "mută blocul 1 mai jos" }).click();
  check((await label(2)) === "2. citat", "and with the arrow buttons");
  await staff.setViewportSize({ width: 1280, height: 820 });

  // Preview on the paper: the second photo floats right of the text, the pair sits in a row.
  await staff.getByRole("tab", { name: "previzualizare" }).click();
  const preview = staff.locator("article", { hasText: `E2E articol ${stamp}` });
  await preview.waitFor();
  check((await preview.locator("div.sm\\:float-right img").count()) === 1, "preview: photo beside the text");
  check((await preview.locator("div.grid img").count()) === 2, "preview: photos side by side");
  check((await preview.getByText("O fotografie de aproape").count()) === 0, "preview hides the template's hints");
  await staff.getByRole("tab", { name: "editează" }).click();

  await staff.selectOption("#act-status", "published");
  await staff.check("#act-consent");
  await Promise.all([staff.waitForURL(/saved=/), staff.click("form:has(#act-title) button[type=submit]")]);
  id = new URL(staff.url()).searchParams.get("saved");
  const { data: saved } = await admin.from("activities").select("layout, body").eq("id", id).single();
  check(saved.layout?.blocks?.length === 9, "layout saved with all nine blocks");
  check(saved.body.includes(`Citat ${stamp}`), "plain text kept for search");

  // The public page follows the layout.
  const visitorCtx = await context(browser, "dark");
  const visitor = await visitorCtx.newPage();
  await visitor.goto(`${base}/activities/${id}`);
  const main = visitor.locator("main");
  check((await main.locator("blockquote", { hasText: `Citat ${stamp}` }).count()) === 1, "quote shown");
  check((await main.locator("div.sm\\:float-right img").count()) === 1, "photo floats beside the text");
  check((await main.locator("div.grid img").count()) === 2, "two photos side by side");
  check((await main.locator("button:has-text('Afișează')").count()) === 1, "YouTube waits for a click");
  check((await main.locator("a[href='https://reform.ro/galerie']", { hasText: "Vezi toate fotografiile" }).count()) === 1, "button shown");
  const order = await main.locator("blockquote, p, img").evaluateAll((els) => els.map((e) => (e.tagName === "IMG" ? "img" : e.textContent?.slice(0, 12))));
  check(order.indexOf("img") > order.findIndex((x) => x?.startsWith("Introducere")), "blocks keep their order on the page");

  // Editing again brings back the same blocks.
  await staff.goto(`${base}/app/admin/news/${id}`);
  check((await staff.locator("ol[aria-label='Blocurile articolului'] > li").count()) === 9, "editor reopens the saved layout");

  // A post from before blocks existed still shows its text and media.
  const { data: legacy } = await admin.from("activities").select("id, body").is("layout", null).neq("body", "").eq("status", "published").limit(1).single();
  await visitor.goto(`${base}/activities/${legacy.id}`);
  check((await visitor.locator("main .prose-reform").count()) >= 1, "older posts still render");

  const errors = [...ctx.errors, ...visitorCtx.errors].filter((e) => !/favicon|youtube|Failed to load resource/i.test(e));
  check(errors.length === 0, `no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} finally {
  if (id && !process.env.KEEP) {
    const { data: media } = await admin.from("activity_media").select("path").eq("activity_id", id);
    await admin.from("activities").delete().eq("id", id);
    const paths = (media ?? []).map((m) => m.path).filter(Boolean);
    if (paths.length) await admin.storage.from("media").remove(paths);
  }
  await browser.close();
}
