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
        className={`mt-4 max-w-2xl p-5 ${theme === "dark" ? "bg-night-2" : theme === "color" ? "rounded-[22px] border-2 border-ink bg-sand" : "border border-ink"}`}
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
        <button type="submit" className={`min-h-11 text-[13px] underline underline-offset-4 ${theme === "dark" ? "text-night-muted hover:text-white" : "text-muted hover:text-ink"}`}>
          {t("archive")}
        </button>
      </form>
    );

    if (theme === "dark") {
      return (
        <li key={board.id} className="flex flex-col gap-3 bg-night-2 p-5">
          <Link href={`/app/workspace/${board.id}`} className="font-display text-xl font-semibold hover:text-teal">{board.name}</Link>
          {board.description && <p className="line-clamp-2 text-sm text-night-soft">{board.description}</p>}
          <span aria-hidden="true" className="block h-1 bg-night-5"><span className="block h-full bg-teal" style={{ width: `${pct}%` }} /></span>
          <div className="flex items-center justify-between gap-3 text-[13px] text-night-muted">
            <span>{t("progress", { done: board.doneCount, total: board.cardCount })}</span>
            {due && <span>{t("dueOn", { date: due })}</span>}
          </div>
          {archive}
        </li>
      );
    }

    if (theme === "color") {
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
    }

    return (
      <li key={board.id} className="grid gap-2 border-b border-line py-4 sm:grid-cols-[1fr_160px_140px_auto] sm:items-center sm:gap-6">
        <div>
          <Link href={`/app/workspace/${board.id}`} className="font-display text-lg font-bold hover:underline">{board.name}</Link>
          {board.description && <p className="line-clamp-1 text-sm text-muted">{board.description}</p>}
        </div>
        <span className="text-sm">
          <span className="font-medium">{board.doneCount}/{board.cardCount}</span> <span className="text-muted">{t("doneShort")}</span>
          <span aria-hidden="true" className="mt-1 block h-1 bg-line"><span className="block h-full bg-teal" style={{ width: `${pct}%` }} /></span>
        </span>
        <span className="text-sm text-muted">{due ? t("dueOn", { date: due }) : "—"}</span>
        {archive || <span />}
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
      <div className={`flex flex-col gap-8 px-4 py-6 ${theme === "white" ? "sm:px-7" : "sm:px-8"}`}>
        {creator}
        {boards.length === 0 && (
          <p className={theme === "dark" ? "text-night-muted" : "text-muted"}>{canCreate ? t("emptyCanCreate") : t("empty")}</p>
        )}
        {[...groups.entries()].map(([schoolName, items]) => (
          <section key={schoolName} aria-label={schoolName} className="flex flex-col gap-4">
            {(isStaff || groups.size > 1) && (
              <h2 className={`font-display text-lg font-semibold ${theme === "dark" ? "text-night-soft" : ""}`}>
                {schoolName}
              </h2>
            )}
            <ul className={theme === "white" ? "border-t-2 border-ink" : "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"}>{items.map(tile)}</ul>
          </section>
        ))}
      </div>
    </div>
  );
}
