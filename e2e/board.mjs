// Project board, round two: the task window, people search, checklist owners, comment replies
// and the project map. Local stack after supabase/demo.sql and scripts/dev-users.mjs.
// Usage: node e2e/board.mjs
import { execFileSync } from "node:child_process";
import { base, check, context, launch, login } from "./lib.mjs";

const board = "de000000-0000-4000-8000-000000000201";
const stamp = Date.now().toString(36);
const sql = (query) =>
  execFileSync("psql", ["postgresql://postgres:postgres@127.0.0.1:54322/postgres", "-Atc", query], { encoding: "utf8" }).trim();
const card = "de000000-0000-4000-8000-000000000231";
const cleanUp = () => {
  sql(`delete from card_assignees where card_id = '${card}'`);
  sql(`delete from checklist_items where card_id = '${card}' and label like 'Pas e2e %'`);
  sql(`delete from card_comments where card_id = '${card}' and (body like 'Comentariul %' or body like 'Live %')`);
  sql(`delete from board_map_nodes where board_id = '${board}' and kind = 'concept' and label like 'sondajul %'`);
  sql(`update cards set stage = 'need' where id = '${card}'`);
  sql(`update board_map_nodes set label = 'O campanie: un sondaj online, afișe și o dezbatere cu direcțiunea.' where board_id = '${board}' and stage = 'solution' and kind = 'stage'`);
};
cleanUp();
const browser = await launch();
const allErrors = [];

try {
  const leadCtx = await context(browser, "white");
  const lead = await login(leadCtx, "ana@reform.test");
  await lead.goto(`${base}/app/workspace/${board}`);
  await lead.click("[aria-label='Întrebările pentru sondaj']");
  const dialog = lead.locator("[role=dialog]");
  await dialog.locator("text=Pași").waitFor();

  // --- The task window opens in the middle of the screen ------------------------
  const box = await dialog.boundingBox();
  const view = lead.viewportSize();
  check(Math.abs(box.x + box.width / 2 - view.width / 2) < 4 && Math.abs(box.y + box.height / 2 - view.height / 2) < 4, "task window is centred");
  const aside = await dialog.locator("aside[aria-labelledby=comments-title]").boundingBox();
  check(aside.x > box.x + box.width / 2, "comments sit on the right of the window");

  // --- Assignees: search the team by name -------------------------------------------
  const people = dialog.getByRole("combobox", { name: "Alege responsabilii" });
  await people.fill("mat");
  await dialog.getByRole("option", { name: /Matei Toma/ }).waitFor();
  await lead.waitForFunction(() => document.querySelectorAll("[role=dialog] [role=listbox] [role=option]").length === 1, null, { timeout: 5000 }).catch(() => {});
  check((await dialog.getByRole("listbox").getByRole("option").count()) === 1, "search narrows the list to matching names");
  await people.press("Enter");
  await dialog.locator("ul[aria-label=responsabili] li", { hasText: "Matei Toma" }).waitFor();
  await people.fill("elena");
  await dialog.locator("text=Nimeni cu numele ăsta în echipă.").waitFor();
  check(true, "people from another school are not offered");
  await people.press("Escape");
  check(sql(`select count(*) from card_assignees where card_id = '${card}' and profile_id = (select id from auth.users where email = 'matei@reform.test')`) === "1", "assignee saved");

  // --- Checklist item with two owners, ticked by the lead -----------------------------
  const item = `Pas e2e ${stamp}`;
  await dialog.locator("#new-item").fill(item);
  await dialog.locator("#new-item").press("Enter");
  const row = dialog.locator("fieldset > div", { hasText: item });
  await row.waitFor();
  for (const name of ["Ana", "Matei"]) {
    await row.getByRole("button", { name: `Cine se ocupă de „${item}”` }).click();
    const search = row.getByRole("combobox");
    await search.fill(name);
    await row.getByRole("listbox").getByRole("option", { name: new RegExp(name) }).click();
    await search.press("Escape");
    check(await dialog.isVisible(), `Escape closes only the people search (${name})`);
  }
  const owners = () => sql(`select count(*) from checklist_item_assignees a join checklist_items i on i.id = a.item_id where i.label = '${item}'`);
  for (let i = 0; i < 20 && owners() !== "2"; i++) await lead.waitForTimeout(250);
  check(owners() === "2", "checklist item has two owners");
  await dialog.locator("fieldset > div", { hasText: item }).locator("input[type=checkbox]").check();
  await dialog.locator("fieldset > div", { hasText: item }).locator("text=/bifat de Ana Popescu/").waitFor();
  check(sql(`select p.full_name from checklist_items i join profiles p on p.id = i.done_by where i.label = '${item}'`) === "Ana Popescu", "who ticked the item is recorded");

  // --- Comments: a long thread scrolls inside its own column; replies ----------------
  const before = (await dialog.boundingBox()).height;
  for (let i = 1; i <= 12; i++) {
    await dialog.locator("#new-comment").fill(`Comentariul ${i} ${stamp}`);
    await dialog.locator("#new-comment").press("Control+Enter");
    await dialog.locator(`text=Comentariul ${i} ${stamp}`).waitFor();
  }
  const list = dialog.getByLabel("Lista comentariilor");
  const scroll = await list.evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight, top: el.scrollTop }));
  check(scroll.sh > scroll.ch + 100, "comment list scrolls instead of growing");
  check(scroll.top + scroll.ch >= scroll.sh - 4, "comment list follows the newest comment");
  check(Math.abs((await dialog.boundingBox()).height - before) < 2, "window keeps its height");
  const first = list.locator("article", { hasText: `Comentariul 1 ${stamp}` });
  await first.getByRole("button", { name: "răspunde" }).click();
  await first.locator("textarea").fill(`Răspuns ${stamp}`);
  await first.getByRole("button", { name: "răspunde" }).click();
  await first.locator("ol[aria-label=Răspunsuri]", { hasText: `Răspuns ${stamp}` }).waitFor();
  check(true, "reply appears under the comment it answers");

  // --- A student opens the same task and sees all of it ------------------------------
  const studentCtx = await context(browser, "color");
  const student = await login(studentCtx, "matei@reform.test");
  await student.goto(`${base}/app/workspace/${board}`);
  await student.click("[aria-label='Întrebările pentru sondaj']");
  const sDialog = student.locator("[role=dialog]");
  await sDialog.locator(`text=/bifat de Ana Popescu/`).waitFor();
  await sDialog.locator(`text=Răspuns ${stamp}`).waitFor();
  check(true, "a teammate sees who ticked the item and the reply");
  const live = `Live ${stamp}`;
  await sDialog.locator("#new-comment").fill(live);
  await sDialog.getByRole("button", { name: "trimite" }).click();
  await dialog.locator(`text=${live}`).waitFor({ timeout: 15000 });
  check(true, "new comments arrive live in an open window");
  allErrors.push(...studentCtx.errors);
  await studentCtx.close();

  // --- The project map ---------------------------------------------------------------
  await lead.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  await lead.getByRole("tab", { name: "harta proiectului" }).click();
  await lead.locator("[data-node][aria-label^='Nevoia:']").waitFor();
  for (const name of ["Nevoia", "Soluția", "Realizarea", "Livrarea", "Impactul"]) {
    check((await lead.locator(`[data-node][aria-label^='${name}:']`).count()) === 1, `map has the step ${name}`);
  }
  const task = lead.locator("[data-node][aria-label='sarcină: Întrebările pentru sondaj']");
  const taskBox = await task.boundingBox();
  const needBox = await lead.locator("[data-node][aria-label^='Nevoia:']").boundingBox();
  check(Math.abs(taskBox.x + taskBox.width / 2 - (needBox.x + needBox.width / 2)) < 40, "task sits in its step's lane");

  const inspector = lead.locator("aside[aria-label=Detalii]");

  // Write the step's sentence.
  await lead.locator("[data-node][aria-label^='Soluția:']").click();
  const statement = inspector.locator("textarea");
  await statement.fill(`O campanie cu sondaj, ${stamp}.`);
  await inspector.locator("h3").first().click();
  await lead.locator(`[data-node][aria-label='Soluția: O campanie cu sondaj, ${stamp}.']`).waitFor();
  check(true, "step sentence saved on the map");

  // Add an idea and link it to the impact with a phrase.
  await lead.getByRole("button", { name: "+ idee" }).click();
  const label = inspector.getByLabel("Ideea, pe scurt");
  await label.waitFor();
  await label.fill(`sondajul ${stamp}`);
  await label.press("Enter");
  const idea = lead.locator(`[data-node][aria-label='Idee: sondajul ${stamp}']`);
  await idea.waitFor();
  // Keyboard: with the idea selected, L starts a link from it; the phrase is typed right on the map.
  await idea.click();
  await lead.keyboard.press("l");
  await lead.locator("[role=status]", { hasText: "Acum apasă pe conceptul unde ajunge" }).waitFor();
  await lead.locator("[data-node][aria-label^='Impactul:']").click();
  const phrase = lead.getByLabel(`Cuvintele de legătură dintre „sondajul ${stamp}” și „Impactul”`);
  await phrase.waitFor();
  check(await phrase.evaluate((el) => el === document.activeElement), "after linking, the phrase box waits for typing");
  await phrase.fill("măsoară");
  await phrase.press("Enter");
  const linkLabel = lead.getByRole("button", { name: `Legătură: sondajul ${stamp} măsoară Impactul` });
  await linkLabel.waitFor();
  check(true, "idea linked to a step with a phrase (L key)");

  // The phrase box takes a background and a text colour.
  await linkLabel.click();
  await inspector.locator("fieldset", { hasText: "Fundalul textului" }).getByRole("button", { name: "galben" }).click();
  await inspector.locator("fieldset", { hasText: "Culoarea textului" }).getByRole("button", { name: "lavandă" }).click();
  await lead.waitForFunction((name) => {
    const el = document.querySelector(`button[aria-label="${name}"]`);
    return el && getComputedStyle(el).backgroundColor === "rgb(225, 179, 69)" && getComputedStyle(el).color === "rgb(121, 86, 154)";
  }, `Legătură: sondajul ${stamp} măsoară Impactul`, { timeout: 5000 });
  check(true, "link phrase colours change");

  // Toolbar: "new link", then two clicks.
  await lead.getByRole("button", { name: /legătură nouă/ }).click();
  await lead.locator("[role=status]", { hasText: "Legătură nouă: apasă pe conceptul de unde pleacă" }).waitFor();
  await idea.click();
  await lead.locator("[data-node][aria-label^='Livrarea:']").click();
  await lead.getByLabel(`Cuvintele de legătură dintre „sondajul ${stamp}” și „Livrarea”`).press("Escape");
  await lead.getByRole("button", { name: `Legătură: sondajul ${stamp} → Livrarea` }).waitFor();
  check(true, "new link from the toolbar button");

  // Drag a task to another lane: it moves to that step.
  await lead.evaluate(() => document.querySelector("[data-node]").closest(".overflow-auto").scrollTo(0, 0));
  await lead.waitForTimeout(400);
  const buildBox = await lead.locator("[data-node][aria-label^='Realizarea:']").boundingBox();
  const start = await task.boundingBox();
  await lead.mouse.move(start.x + 30, start.y + 15);
  await lead.mouse.down();
  await lead.mouse.move(start.x + 60, start.y + 40, { steps: 4 });
  await lead.mouse.move(buildBox.x + 40, buildBox.y + buildBox.height + 260, { steps: 12 });
  await lead.mouse.up();
  const stage = () => sql(`select stage from cards where id = '${card}'`);
  for (let i = 0; i < 20 && stage() !== "build"; i++) await lead.waitForTimeout(250);
  check(stage() === "build", "dragging a task into another lane changes its step");
  await lead.getByRole("tab", { name: "tablă" }).click();
  await lead.locator("[aria-label='Întrebările pentru sondaj']", { hasText: "Realizarea" }).waitFor();
  check(true, "the board card shows its new step");

  // The story, in words.
  await lead.getByRole("tab", { name: "harta proiectului" }).click();
  await lead.getByRole("tab", { name: "povestea" }).click();
  await lead.locator("article li", { hasText: `sondajul ${stamp} măsoară Impactul` }).waitFor();
  await lead.locator("article p", { hasText: `O campanie cu sondaj, ${stamp}.` }).waitFor();
  check(true, "story view reads the map as sentences");

  allErrors.push(...leadCtx.errors);
} finally {
  await browser.close();
  if (!process.env.KEEP) cleanUp();
}

const errors = allErrors.filter((e) => !e.includes("favicon"));
if (errors.length) {
  console.log(errors.join("\n"));
  process.exit(1);
}
console.log("no console errors");
