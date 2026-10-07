// Resources, round two: personal space, folders in folders, drag and drop (from the computer and
// between folders), sharing from the personal space, moving a folder into the team's space.
// Local stack after supabase/demo.sql and scripts/dev-users.mjs.
// Usage: node --env-file=.env.local e2e/library.mjs
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { base, check, context, launch, login } from "./lib.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!/127\.0\.0\.1|localhost/.test(url ?? "")) throw new Error("local stack only");
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const sql = (query) => execFileSync("psql", ["postgresql://postgres:postgres@127.0.0.1:54322/postgres", "-Atc", query], { encoding: "utf8" }).trim();
const stamp = Date.now().toString(36);
const schoolFolder = "de000000-0000-4000-8000-000000000303";
const browser = await launch();

/** Drops files (as if dragged from the computer) or a library item on an element. */
async function drop(page, selector, payload) {
  await page.locator(selector).first().evaluate((el, payload) => {
    const data = new DataTransfer();
    if (payload.files) for (const f of payload.files) data.items.add(new File([f.content], f.name, { type: f.type }));
    if (payload.item) data.setData("application/x-reform-library", JSON.stringify(payload.item));
    for (const type of ["dragenter", "dragover", "drop"]) el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data }));
  }, payload);
}

try {
  const leadCtx = await context(browser, "white");
  const lead = await login(leadCtx, "ana@reform.test");
  const ana = sql("select id from auth.users where email = 'ana@reform.test'");
  const mine = sql(`select id from library_folders where space = 'personal' and owner_id = '${ana}' and parent_id is null order by created_at limit 1`);
  check(Boolean(mine), "everyone has a personal folder");

  await lead.goto(`${base}/app/library?folder=${mine}`);
  await lead.getByText("spațiul meu").first().waitFor();
  check((await lead.getByRole("meter", { name: "Cât din spațiul personal e folosit" }).count()) === 1, "personal space shows how much is used");

  // Files dropped from the computer onto the open folder upload into it.
  await drop(lead, `[data-drop="${mine}"]`, { files: [{ name: `notite-${stamp}.txt`, type: "text/plain", content: "project notes ".repeat(50) }] });
  await lead.getByRole("link", { name: `notite-${stamp}.txt` }).first().waitFor({ timeout: 20000 });
  check(true, "file dropped from the computer is uploaded");
  const file = sql(`select id from library_files where name = 'notite-${stamp}.txt'`);
  check(sql(`select size_bytes from library_files where id = '${file}'`) === "700", "its size is the stored size");

  // A folder inside the personal folder.
  await lead.getByText("+ folder nou aici").click();
  await lead.fill("#folder-name", `Proiect ${stamp}`);
  await lead.getByRole("button", { name: "Creează folderul" }).click();
  const sub = await (async () => {
    for (let i = 0; i < 40; i++) {
      const id = sql(`select id from library_folders where name = 'Proiect ${stamp}'`);
      if (id) return id;
      await lead.waitForTimeout(250);
    }
    return "";
  })();
  check(sql(`select parent_id || ' ' || space from library_folders where id = '${sub}'`) === `${mine} personal`, "folder created inside the open folder");
  await lead.reload();
  await lead.locator(`tr[data-drop="${sub}"]`).waitFor();

  // Dragging the file onto the subfolder moves it.
  await drop(lead, `tr[data-drop="${sub}"]`, { item: { kind: "file", id: file, name: `notite-${stamp}.txt` } });
  await lead.getByText(`„notite-${stamp}.txt” e acum în „Proiect ${stamp}”.`).waitFor();
  check(sql(`select folder_id from library_files where id = '${file}'`) === sub, "file dragged onto a folder moves into it");

  // Share the subfolder with a teammate.
  await lead.goto(`${base}/app/library?folder=${sub}`);
  await lead.getByText("partajează folderul").click();
  const who = lead.getByRole("combobox", { name: "Cu cine partajezi" });
  await who.fill("Matei");
  await lead.getByRole("listbox").getByRole("option", { name: /Matei Toma/ }).click();
  await who.press("Escape");
  await lead.getByRole("button", { name: "partajează", exact: true }).click();
  await lead.getByRole("list", { name: "Partajat cu" }).getByText("Matei Toma").waitFor();
  check(true, "folder shared with a teammate");

  const studentCtx = await context(browser, "color");
  const student = await login(studentCtx, "matei@reform.test");
  await student.goto(`${base}/app/library`);
  await student.getByRole("link", { name: new RegExp(`Proiect ${stamp}`) }).first().click();
  await student.getByRole("link", { name: `notite-${stamp}.txt` }).first().waitFor();
  check(true, "the teammate sees the shared folder and its file");
  const res = await student.request.get(`${base}/app/library/file/${file}?download=1`, { maxRedirects: 0 });
  check(res.status() === 307, `and can download it (${res.status()})`);
  check((await student.locator(`[data-drop="${sub}"]`).count()) === 0, "but cannot drop files into it");
  check((await student.getByRole("button", { name: /partajează/ }).count()) === 0, "nor share it further");

  // The other school's student sees nothing.
  const elenaCtx = await context(browser, "white");
  const elena = await login(elenaCtx, "elena@reform.test");
  const denied = await elena.request.get(`${base}/app/library/file/${file}`, { maxRedirects: 0 });
  check(denied.status() === 404, "people it wasn't shared with can't open it");

  // Moving the folder into the team's space: everyone in the school sees it there.
  await lead.goto(`${base}/app/library?folder=${sub}`);
  await lead.locator("summary", { hasText: "mută folderul" }).click();
  const moveBox = lead.locator("details[open]", { has: lead.locator("summary", { hasText: "mută folderul" }) });
  await moveBox.locator("select[name=to]").selectOption(schoolFolder);
  await moveBox.getByRole("button", { name: "mută", exact: true }).click();
  for (let i = 0; i < 40 && sql(`select space from library_folders where id = '${sub}'`) !== "school"; i++) await lead.waitForTimeout(250);
  check(sql(`select space || ' ' || parent_id from library_folders where id = '${sub}'`) === `school ${schoolFolder}`, "a personal folder moves into the school space");

  // Dragging a folder back to the top of the school space.
  await lead.goto(`${base}/app/library?folder=${schoolFolder}`);
  await lead.locator(`tr[data-drop="${sub}"]`).waitFor();
  check((await lead.locator(`tr[data-drag="folder:${sub}"]`).count()) === 1, "folders can be picked up");

  const errors = [...leadCtx.errors, ...studentCtx.errors, ...elenaCtx.errors].filter((e) => !/favicon|Failed to load resource/i.test(e));
  check(errors.length === 0, `no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} finally {
  const paths = sql(`select coalesce(string_agg(storage_path, ','), '') from library_files where name like 'notite-${stamp}%'`);
  sql(`delete from library_files where name like 'notite-${stamp}%'`);
  sql(`delete from library_folders where name = 'Proiect ${stamp}'`);
  if (paths) await admin.storage.from("library").remove(paths.split(","));
  await browser.close();
}
