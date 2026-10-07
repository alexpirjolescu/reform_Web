// Messages, round two: groups (WhatsApp-style), polls, replies, reactions, pins, stickers, GIFs,
// files from the resource library and videos playing inside the chat. Local stack only.
// Usage: node --env-file=.env.local e2e/messages.mjs
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { base, check, context, launch, login } from "./lib.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!/127\.0\.0\.1|localhost/.test(url ?? "")) throw new Error("local stack only");
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const sql = (query) => execFileSync("psql", ["postgresql://postgres:postgres@127.0.0.1:54322/postgres", "-Atc", query], { encoding: "utf8" }).trim();
const stamp = Date.now().toString(36);
const title = `E2E grup ${stamp}`;
const png = join(tmpdir(), "e2e-group.png");
writeFileSync(png, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
const browser = await launch();
let groupId = "";

try {
  const ana = sql("select id from auth.users where email = 'ana@reform.test'");
  // A file in Ana's personal space to send from "resources".
  const folder = sql(`select id from library_folders where space = 'personal' and owner_id = '${ana}' and parent_id is null limit 1`);
  const { data: file } = await admin.from("library_files").insert({ folder_id: folder, name: `Plan ${stamp}`, external_url: "https://example.org/plan", mime_type: "text/uri-list", uploaded_by: ana }).select("id").single();

  const anaCtx = await context(browser, "white");
  const lead = await login(anaCtx, "ana@reform.test");
  await lead.goto(`${base}/app/messages`);
  await lead.getByRole("button", { name: "Conversație nouă" }).click();
  await lead.getByRole("button", { name: /Grup nou/ }).click();
  await lead.getByLabel("Numele grupului").fill(title);
  const who = lead.getByRole("combobox", { name: "Cine intră în grup" });
  for (const name of ["Matei", "Andrei"]) {
    await who.fill(name);
    await lead.getByRole("listbox").getByRole("option", { name: new RegExp(name) }).click();
  }
  await who.press("Escape");
  await Promise.all([lead.waitForURL(/\?c=/), lead.getByRole("button", { name: "creează grupul" }).click()]);
  groupId = new URL(lead.url()).searchParams.get("c");
  await lead.getByText(`Ai creat grupul „${title}”`).waitFor();
  check(true, "group created; the chat shows who created it");

  // A video link plays right in the chat.
  const composer = lead.getByRole("textbox", { name: `Mesaj către ${title}` });
  await composer.fill("Uitați clipul: https://youtu.be/dQw4w9WgXcQ");
  await composer.press("Enter");
  await lead.locator("main iframe[src^='https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ']").waitFor();
  check(true, "YouTube link plays inside the message");

  // A sticker; the GIF tab explains it isn't switched on without a GIPHY key.
  await lead.getByRole("button", { name: "Stickere și GIF-uri" }).click();
  await lead.getByRole("dialog", { name: "Stickere și GIF-uri" }).getByRole("button", { name: "bravo!" }).click();
  await lead.locator("main [role=img][aria-label='bravo!']").waitFor();
  check(true, "sticker sent");
  await lead.getByRole("button", { name: "Stickere și GIF-uri" }).click();
  await lead.getByRole("tab", { name: "GIF-uri" }).click();
  await lead.getByText(/Căutarea de GIF-uri nu e pornită|GIPHY nu răspunde/).waitFor();
  check(true, "GIF tab works (and says when GIPHY isn't configured)");
  await lead.keyboard.press("Escape");

  // A poll.
  await lead.getByRole("button", { name: /Atașează/ }).click();
  await lead.getByRole("menuitem", { name: "sondaj nou" }).click();
  await lead.getByLabel("Întrebarea").fill(`Când ne vedem ${stamp}?`);
  await lead.getByLabel("Varianta 1").fill("luni");
  await lead.getByLabel("Varianta 2").fill("joi");
  await lead.getByRole("button", { name: "trimite sondajul" }).click();
  await lead.getByText(`Când ne vedem ${stamp}?`).waitFor();
  check(true, "poll sent");

  // A file from the personal space.
  await lead.getByRole("button", { name: /Atașează/ }).click();
  await lead.getByRole("menuitem", { name: "din resurse" }).click();
  await lead.getByRole("dialog", { name: "din resurse" }).getByRole("button", { name: new RegExp(`Plan ${stamp}`) }).click();
  await lead.locator("main a", { hasText: `Plan ${stamp}` }).waitFor();
  check(true, "file sent from resources");

  // Matei joins in: vote, reply, react, open the file.
  const mateiCtx = await context(browser, "color");
  const matei = await login(mateiCtx, "matei@reform.test");
  await matei.goto(`${base}/app/messages?c=${groupId}`);
  await matei.getByRole("radio", { name: /joi/ }).click();
  await lead.getByText("o persoană a votat").waitFor({ timeout: 15000 });
  check(true, "a vote shows up for everyone");
  const res = await matei.request.get(`${base}/app/library/file/${file.id}`, { maxRedirects: 0 });
  check(res.status() === 307, `a personal file sent in the chat opens for the others (${res.status()})`);
  const first = matei.locator(`[id^=msg-]`, { hasText: "Uitați clipul" }).first();
  await first.hover();
  await first.getByRole("button", { name: "răspunde" }).click();
  await matei.getByText("Răspunzi lui Ana Popescu").waitFor();
  const mComposer = matei.getByRole("textbox", { name: `Mesaj către ${title}` });
  await mComposer.fill(`Super clip ${stamp}`);
  await mComposer.press("Enter");
  const reply = lead.locator(`[id^=msg-]`, { hasText: `Super clip ${stamp}` });
  await reply.waitFor({ timeout: 15000 });
  check((await reply.getByRole("button", { name: /Uitați clipul/ }).count()) === 1, "replies quote the message they answer");
  await first.hover();
  await first.getByRole("button", { name: "reacționează" }).click();
  await matei.getByRole("menuitem", { name: "👍" }).click();
  await lead.getByRole("button", { name: /👍 1: Matei Toma/ }).waitFor({ timeout: 15000 });
  check(true, "reactions show who reacted");

  // Ana pins, changes the photo and makes it admins-only.
  const pinTarget = lead.locator(`[id^=msg-]`, { hasText: "Uitați clipul" }).first();
  await pinTarget.hover();
  await pinTarget.getByRole("button", { name: "fixează sus" }).click();
  await lead.getByRole("button", { name: /fixat: Uitați clipul/ }).waitFor();
  check(true, "pinned message shows at the top");
  await lead.getByRole("button", { name: new RegExp(title) }).click();
  const info = lead.getByRole("complementary", { name: "Despre grup" });
  await info.locator("input[type=file]").setInputFiles(png);
  await lead.getByText("Ai schimbat poza grupului").waitFor({ timeout: 15000 });
  check(true, "group photo changed");
  await info.getByLabel("Doar adminii pot trimite mesaje").check();
  await matei.getByText("Doar adminii pot trimite mesaje în acest grup.").waitFor({ timeout: 15000 });
  check(true, "admins-only: members can't write");
  await info.locator("summary[aria-label=\"Opțiuni pentru Matei Toma\"]").click();
  await info.getByRole("button", { name: "fă-l admin" }).click();
  await matei.getByRole("textbox", { name: `Mesaj către ${title}` }).waitFor({ timeout: 15000 });
  check(true, "a new admin can write again");

  // Matei leaves.
  await matei.getByRole("button", { name: new RegExp(title) }).click();
  await matei.getByRole("button", { name: "ieși din grup" }).click();
  await Promise.all([matei.waitForURL(/\/app\/messages$/), matei.getByRole("button", { name: "da, ies" }).click()]);
  await lead.getByText("Matei Toma a ieșit din grup").waitFor({ timeout: 15000 });
  check(true, "leaving shows in the group");

  const errors = [...anaCtx.errors, ...mateiCtx.errors].filter((e) => !/favicon|youtube|Failed to load resource|giphy/i.test(e));
  check(errors.length === 0, `no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} finally {
  if (groupId && !process.env.KEEP) sql(`delete from conversations where id = '${groupId}'`);
  if (!process.env.KEEP) sql(`delete from library_files where name = 'Plan ${stamp}'`);
  await browser.close();
}
