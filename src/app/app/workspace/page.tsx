import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader, moduleButtons } from "@/components/page-header";
import { requireProfile } from "@/lib/auth";
import { shortDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getTheme } from "@/lib/theme";
import { isStaffRole } from "@/lib/types";
import { listBoards } from "@/lib/workspace-server";
import { archiveBoard } from "./actions";
import { NewBoardForm } from "./new-board-form";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("workspace") };
}

export default async function WorkspacePage() {
  const profile = await requireProfile();
  const isStaff = isStaffRole(profile.role);
  const canCreate = isStaff || profile.role === "core_lead";
  const supabase = await createClient();
  const [boards, theme, t, locale, schools] = await Promise.all([
    listBoards(profile),
    getTheme(profile.theme),
    getTranslations("workspace"),
    getLocale(),
    isStaff ? supabase.from("schools").select("id, name, city").order("name").then((r) => r.data ?? []) : Promise.resolve(null),
  ]);
  const b = moduleButtons[theme];

  const groups = new Map<string, typeof boards>();
  for (const board of boards) groups.set(board.schoolName, [...(groups.get(board.schoolName) ?? []), board]);

  const creator = canCreate && (
    <details className="group">
      <summary className={`${b.primary} cursor-pointer list-none`}>+ {t("newBoard")}</summary>
      <div
        className={`mt-4 max-w-2xl p-5 ${theme === "color" ? "rounded-[22px] border-2 border-ink bg-sand" : "bg-th-sunk"}`}
      >
        <NewBoardForm schools={schools} />
      </div>
    </details>
  );

  const tile = (board: (typeof boards)[number]) => {
    const pct = board.cardCount ? Math.round((100 * board.doneCount) / board.cardCount) : 0;
    const due = board.dueDate ? shortDate(`${board.dueDate}T12:00:00Z`, locale) : null;
    const canArchive = isStaff || (profile.role === "core_lead" && board.mine);
    const archive = canArchive && (
      <form action={archiveBoard}>
        <input type="hidden" name="boardId" value={board.id} />
        <button type="submit" className={`min-h-11 text-[13px] underline underline-offset-4 text-th-muted hover:text-th-fg`}>
          {t("archive")}
        </button>
      </form>
    );

    if (theme !== "color") {
      // Studio (dark and white)
      return (
        <li key={board.id} className="flex flex-col gap-3 bg-th-sunk p-5">
          <Link href={`/app/workspace/${board.id}`} className="font-display text-xl font-semibold hover:text-th-link">{board.name}</Link>
          {board.description && <p className="line-clamp-2 text-sm text-th-soft">{board.description}</p>}
          <span aria-hidden="true" className="block h-1 bg-th-high"><span className="block h-full bg-teal" style={{ width: `${pct}%` }} /></span>
          <div className="flex items-center justify-between gap-3 text-[13px] text-th-muted">
            <span>{t("progress", { done: board.doneCount, total: board.cardCount })}</span>
            {due && <span>{t("dueOn", { date: due })}</span>}
          </div>
          {archive}
        </li>
      );
    }

    return (
      <li key={board.id} className="flex flex-col gap-3 rounded-[22px] border-2 border-ink bg-white p-5">
        <span aria-hidden="true" className="h-3 w-12 rounded-full border-2 border-ink bg-pink" />
        <Link href={`/app/workspace/${board.id}`} className="font-display text-xl font-bold hover:underline">{board.name}</Link>
        {board.description && <p className="line-clamp-2 text-sm">{board.description}</p>}
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="block h-2.5 flex-1 overflow-hidden rounded-full border-2 border-ink"><span className="block h-full bg-pink" style={{ width: `${pct}%` }} /></span>
          <span className="font-fun text-lg font-bold">{pct}%</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium">
          <span className="rounded-full border-2 border-ink px-2.5 py-0.5">{t("progress", { done: board.doneCount, total: board.cardCount })}</span>
          {due && <span className="rounded-full border-2 border-ink bg-honey px-2.5 py-0.5">{t("dueOn", { date: due })}</span>}
        </div>
        {archive}
      </li>
    );
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader
        variant={theme}
        logo="core"
        kicker={isStaff ? t("allSchools") : groups.keys().next().value}
        title={t("title_projects")}
      />
      <div className="flex flex-col gap-8 px-4 py-6 sm:px-8">
        {creator}
        {boards.length === 0 && (
          <p className="text-th-muted">{canCreate ? t("emptyCanCreate") : t("empty")}</p>
        )}
        {[...groups.entries()].map(([schoolName, items]) => (
          <section key={schoolName} aria-label={schoolName} className="flex flex-col gap-4">
            {(isStaff || groups.size > 1) && (
              <h2 className={`font-display text-lg font-semibold ${theme === "color" ? "" : "text-th-soft"}`}>
                {schoolName}
              </h2>
            )}
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map(tile)}</ul>
          </section>
        ))}
      </div>
    </div>
  );
}
