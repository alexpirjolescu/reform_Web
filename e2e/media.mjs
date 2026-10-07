// News posts with media: staff upload files and paste social/video links; visitors see them, and
// third-party players load only after a click. Local stack only.
// Usage: NODE_PATH=$(npm root -g) node --env-file=.env.local e2e/media.mjs
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { base, check, context, launch, login } from "./lib.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!/127\.0\.0\.1|localhost/.test(url ?? "")) throw new Error("local stack only");
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const dir = tmpdir();
const png = join(dir, "e2e-photo.png");
writeFileSync(png, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
const pdf = join(dir, "e2e-program.pdf");
writeFileSync(pdf, "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const mp4 = join(dir, "e2e-clip.mp4");
writeFileSync(mp4, Buffer.alloc(2048, 1));

const browser = await launch();
const stamp = Date.now().toString(36);
try {
  const staffCtx = await context(browser);
  const staff = await login(staffCtx, "mentor@reform.test");
  await staff.goto(`${base}/app/admin/news/new`);
  await staff.fill("#act-title", `E2E media ${stamp}`);
  await staff.fill("#act-summary", "Postare cu fotografii, video și linkuri.");

  await staff.setInputFiles("input[type=file][multiple]", [png, mp4, pdf]);
  await staff.waitForFunction(() => document.querySelectorAll("ol li").length === 3, null, { timeout: 30000 });
  check(true, "photo, video and PDF uploaded in the editor");

  for (const link of ["https://www.instagram.com/p/DPabc123XYZ/?igsh=x", "https://youtu.be/dQw4w9WgXcQ", "https://reform.ro/despre"]) {
    await staff.fill("#media-link", link);
    await staff.click("button:has-text('adaugă linkul')");
  }
  await staff.waitForFunction(() => document.querySelectorAll("ol li").length === 6);
  check((await staff.locator("ol li", { hasText: "postare Instagram" }).count()) === 1, "Instagram link recognised");
  check((await staff.locator("ol li", { hasText: "postare YouTube" }).count()) === 1, "YouTube link recognised");

  // Move the YouTube video to the top.
  await staff.click("button[aria-label='mută elementul 5 mai sus']");
  await staff.click("button[aria-label='mută elementul 4 mai sus']");
  await staff.click("button[aria-label='mută elementul 3 mai sus']");
  await staff.click("button[aria-label='mută elementul 2 mai sus']");
  check((await staff.locator("ol li").first().textContent()).includes("YouTube"), "items can be reordered");

  await staff.selectOption("#act-status", "published");
  await staff.click("form:has(#act-title) button[type=submit]");
  await staff.waitForSelector("[role=alert]:has-text('acordul')", { timeout: 15000 });
  check(true, "publishing photos or videos needs the consent box");
  await staff.check("#act-consent");
  await Promise.all([staff.waitForURL(/saved=/), staff.click("form:has(#act-title) button[type=submit]")]);
  const id = new URL(staff.url()).searchParams.get("saved");
  check(Boolean(id), "post with media saved");

  // A visitor sees everything; Instagram and YouTube load only after a click.
  const visitorCtx = await context(browser, "white");
  const visitor = await visitorCtx.newPage();
  await visitor.goto(`${base}/activities/${id}`);
  check((await visitor.locator("main img[src*='/media/activities/']").count()) === 1, "photo shown");
  check((await visitor.locator("main video[src*='/media/activities/']").count()) === 1, "video player shown");
  check((await visitor.locator("main a[download][href*='.pdf']").count()) === 1, "PDF offered for download");
  check((await visitor.locator("main a[href='https://reform.ro/despre']").count()) === 1, "plain link shown as a card");
  check((await visitor.locator("main iframe").count()) === 0, "no third-party player before a click");
  const order = await visitor.locator("main section[aria-labelledby=media-title] > div > *").evaluateAll((els) => els.map((e) => e.textContent ?? ""));
  check(order[0].includes("YouTube"), "media keep the editor's order");
  await visitor.locator("figure", { hasText: "Instagram" }).locator("button:has-text('Afișează')").click();
  const instagram = await visitor.locator("main iframe").first().getAttribute("src");
  check(instagram === "https://www.instagram.com/p/DPabc123XYZ/embed/captioned/", "Instagram post loads after a click");
  await visitor.locator("figure", { hasText: "YouTube" }).locator("button:has-text('Afișează')").click();
  check((await visitor.locator("main iframe[src^='https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ']").count()) === 1, "YouTube loads without tracking cookies domain");

  // Removing the PDF in the editor deletes the file from storage.
  const { data: before } = await admin.from("activity_media").select("path").eq("activity_id", id).eq("kind", "file").single();
  await staff.goto(`${base}/app/admin/news/${id}`);
  await staff.locator("ol li", { hasText: "document" }).locator("button:has-text('scoate')").click();
  await Promise.all([staff.waitForURL(/saved=/), staff.click("form:has(#act-title) button[type=submit]")]);
  const { data: files } = await admin.storage.from("media").list("activities", { search: before.path.split("/")[1] });
  check(files.length === 0, "removed file deleted from storage");

  // Both embeds survive an edit.
  const { data: forged } = await admin.from("activity_media").select("kind").eq("activity_id", id).eq("kind", "embed");
  check(forged.length === 2, "two embeds kept after editing");

  await admin.from("activities").delete().eq("id", id);
  const errors = [...staffCtx.errors, ...visitorCtx.errors].filter((e) => !/favicon|status of 404|MEDIA_ERR|Failed to load resource|youtube|instagram/i.test(e));
  check(errors.length === 0, `no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} finally {
  await browser.close();
}
