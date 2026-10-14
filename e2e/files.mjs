// Files in tasks and the file viewer: a file uploaded into a task is saved in the uploader's own space,
// attached to the task and listed in the project's folder; teammates open it in the viewer laid over the page.
// Usage: node --env-file=.env.local e2e/files.mjs   (local stack only)
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { base, check, context, launch, login } from "./lib.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!/127\.0\.0\.1|localhost/.test(url ?? "")) throw new Error("local stack only");
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const sql = (query) => execFileSync("psql", ["postgresql://postgres:postgres@127.0.0.1:54322/postgres", "-Atc", query], { encoding: "utf8" }).trim();
const stamp = Date.now().toString(36);
const board = "de000000-0000-4000-8000-000000000201";
// The open button's name starts with the file name (then its size); the remove button's doesn't.
const startsWith = (text) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);

// A small two-page PDF and a text note, written by hand.
const dir = join(tmpdir(), `e2e-files-${stamp}`);
mkdirSync(dir, { recursive: true });
const pdfName = `Plan ${stamp}.pdf`;
const objects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 7 0 R >> >> >>",
  null,
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 6 0 R /Resources << /Font << /F1 7 0 R >> >> >>",
  null,
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
];
const stream = (text) => {
  const body = `BT /F1 28 Tf 72 760 Td (${text}) Tj ET`;
  return `<< /Length ${body.length} >>\nstream\n${body}\nendstream`;
};
objects[3] = stream("Pagina unu");
objects[5] = stream("Pagina doi");
let pdf = "%PDF-1.4\n";
const offsets = [];
objects.forEach((body, i) => {
  offsets.push(pdf.length);
  pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
});
const xref = pdf.length;
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
writeFileSync(join(dir, pdfName), pdf);
const noteName = `Note ${stamp}.txt`;
writeFileSync(join(dir, noteName), `Notițe ${stamp}\n- primul punct\n`);

const browser = await launch();
let fileIds = [];

try {
  const ana = sql("select id from auth.users where email = 'ana@reform.test'");
  const anaCtx = await context(browser, "white");
  const page = await login(anaCtx, "ana@reform.test");
  await page.goto(`${base}/app/workspace/${board}`);
  await page.click("[aria-label='Întrebările pentru sondaj']");
  const task = page.getByRole("dialog", { name: "Întrebările pentru sondaj" });
  await task.waitFor();
  await task.locator("input[type=file]").setInputFiles([join(dir, pdfName), join(dir, noteName)]);
  await task.getByText(/2 fișiere sunt salvate/).waitFor({ timeout: 30000 });
  check(true, "two files uploaded from the device into the task");

  const rows = sql(`select f.id || '|' || d.space || '|' || coalesce(d.owner_id::text, '') from library_files f join library_folders d on d.id = f.folder_id where f.name in ('${pdfName}', '${noteName}')`).split("\n");
  fileIds = rows.map((r) => r.split("|")[0]);
  check(rows.length === 2 && rows.every((r) => r.endsWith(`|personal|${ana}`)), "they are saved in the uploader's own space");
  const attached = sql(`select count(*) from card_attachments a join cards c on c.id = a.card_id where c.board_id = '${board}' and a.file_id in ('${fileIds.join("','")}')`);
  check(attached === "2", "and attached to the task");

  // The viewer opens over the task and closes back to it.
  await task.getByRole("button", { name: startsWith(pdfName) }).click();
  const viewer = page.getByRole("dialog", { name: pdfName });
  await viewer.waitFor();
  await viewer.locator("canvas[aria-label='pagina 2 din 2']").waitFor({ timeout: 20000 });
  check(true, "a PDF opens in the viewer, every page drawn");
  await page.keyboard.press("Escape");
  await viewer.waitFor({ state: "detached" });
  check(await task.isVisible(), "Escape closes the viewer and the task stays open");
  await task.getByRole("button", { name: startsWith(noteName) }).click();
  await page.getByRole("dialog", { name: noteName }).getByText(`Notițe ${stamp}`).waitFor();
  check(true, "a text file opens in the viewer");
  await page.getByRole("dialog", { name: noteName }).getByRole("button", { name: "Închide" }).click();

  // The project's folder in the library lists the task's files.
  await task.getByRole("link", { name: /folderul proiectului/ }).click();
  await page.waitForURL(/\/app\/library\?folder=/);
  const listed = page.locator("tr", { hasText: pdfName });
  await listed.waitFor();
  check((await listed.getByText(/la: Întrebările pentru sondaj/).count()) === 1, "the project folder lists the file with its task");

  // A teammate opens Ana's file from the task.
  const mateiCtx = await context(browser, "dark");
  const matei = await login(mateiCtx, "matei@reform.test");
  await matei.goto(`${base}/app/workspace/${board}`);
  await matei.click("[aria-label='Întrebările pentru sondaj']");
  const mTask = matei.getByRole("dialog", { name: "Întrebările pentru sondaj" });
  await mTask.getByRole("button", { name: startsWith(pdfName) }).click();
  await matei.getByRole("dialog", { name: pdfName }).locator("canvas[aria-label='pagina 1 din 2']").waitFor({ timeout: 20000 });
  check(true, "a teammate opens the file in the viewer");
  const res = await matei.request.get(`${base}/app/library/file/${fileIds[0]}`, { maxRedirects: 0 });
  check(res.status() === 307, `the file link works for the team (${res.status()})`);

  const errors = [...anaCtx.errors, ...mateiCtx.errors].filter((e) => !/Failed to load resource/i.test(e));
  check(errors.length === 0, `no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} finally {
  if (fileIds.length && !process.env.KEEP) {
    const paths = sql(`select storage_path from library_files where id in ('${fileIds.join("','")}')`).split("\n").filter(Boolean);
    await admin.storage.from("library").remove(paths);
    sql(`delete from library_files where id in ('${fileIds.join("','")}')`);
  }
  await browser.close();
}
