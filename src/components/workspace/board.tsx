"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Avatar } from "@/components/avatar";
import { Logo } from "@/components/logo";
import { createClient } from "@/lib/supabase/client";
import type { Theme } from "@/lib/theme-shared";
import { cardSelect, positionBetween, toBoardCard, type BoardCard, type BoardColumn, type BoardData, type Member, type RawCard } from "@/lib/workspace";
import { CardDetail } from "./card-detail";
import { CardVisual, type CardState } from "./card-visual";

type View = "board" | "list" | "calendar";

function todayIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest" }).format(new Date());
}

// Studio (dark and white) columns sit a step below the page; colour uses rounded sand columns.
const studio: Record<string, string> = {
  root: "bg-th-bg text-th-fg",
  column: "flex w-[260px] shrink-0 flex-col gap-2.5 bg-th-sunk p-3 md:w-auto md:flex-[1_0_224px]",
  columnTitle: "font-display text-base font-semibold",
  count: "text-[13px] text-th-muted",
  addCard: "border border-dashed border-th-edge p-2.5 text-left text-[13px] text-th-muted hover:text-th-fg",
  input: "w-full rounded-th border border-th-edge bg-th-bg px-3 py-2 text-sm text-th-fg",
  primary: "inline-flex min-h-11 items-center gap-2 rounded-th bg-teal px-[18px] font-display text-[15px] font-semibold text-ink",
  ghost: "min-h-11 rounded-th border border-th-edge px-3 text-[13px] text-th-fg hover:border-th-fg",
  muted: "text-th-muted",
};

const styles: Record<Theme, Record<string, string>> = {
  dark: studio,
  white: studio,
  color: {
    root: "bg-white text-ink",
    column: "flex w-[250px] shrink-0 flex-col gap-2.5 rounded-[22px] bg-sand p-3 md:w-auto md:flex-[1_0_226px]",
    columnTitle: "font-display text-[17px] font-bold",
    count: "rounded-full border-2 border-ink bg-white px-[9px] font-fun text-sm font-bold",
    addCard: "rounded-2xl border-2 border-dashed border-ink p-2.5 text-[13px] font-medium",
    input: "w-full rounded-xl border-2 border-ink bg-white px-3 py-2 text-sm",
    primary: "inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-ink bg-pink px-[22px] font-display text-[15px] font-bold",
    ghost: "min-h-11 rounded-full border-2 border-ink px-4 text-sm font-medium",
    muted: "text-muted",
  },
};

export function Board({
  initial,
  variant,
  currentUserId,
  locale,
}: {
  initial: BoardData;
  variant: Theme;
  currentUserId: string;
  locale: string;
}) {
  const t = useTranslations("workspace");
  const s = styles[variant];
  const supabase = useMemo(() => createClient(), []);
  const [columns, setColumns] = useState<BoardColumn[]>(initial.columns);
  const [cards, setCards] = useState<BoardCard[]>(initial.cards);
  const [view, setView] = useState<View>("board");
  const [onlyMine, setOnlyMine] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dragging = useRef(false);
  const boardId = initial.board.id;
  const members = useMemo(() => new Map(initial.members.map((m) => [m.id, m])), [initial.members]);
  const today = todayIso();
  const doneColumns = useMemo(() => new Set(columns.filter((c) => c.is_done).map((c) => c.id)), [columns]);

  const reload = useCallback(async () => {
    if (dragging.current) return;
    const [cols, rows] = await Promise.all([
      supabase.from("board_columns").select("id, name, position, is_done").eq("board_id", boardId).order("position"),
      supabase.from("cards").select(cardSelect).eq("board_id", boardId).order("position").overrideTypes<RawCard[], { merge: false }>(),
    ]);
    if (cols.data) setColumns(cols.data);
    if (rows.data) setCards(rows.data.map(toBoardCard));
  }, [boardId, supabase]);

  // Live updates (WS-9): any change on this board, by anyone, refreshes it.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void reload(), 250);
    };
    const channel = supabase
      .channel(`board:${boardId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "cards", filter: `board_id=eq.${boardId}` }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "board_columns", filter: `board_id=eq.${boardId}` }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "checklist_items" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "card_labels" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "card_assignees" }, schedule)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "card_comments" }, schedule)
      .subscribe();
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [boardId, reload, supabase]);

  const visible = onlyMine ? cards.filter((c) => c.assignees.includes(currentUserId)) : cards;
  const byColumn = useMemo(() => {
    const map = new Map<string, BoardCard[]>(columns.map((c) => [c.id, []]));
    for (const card of [...visible].sort((a, b) => a.position - b.position)) map.get(card.column_id)?.push(card);
    return map;
  }, [columns, visible]);

  const stateOf = (card: BoardCard): CardState => {
    const done = doneColumns.has(card.column_id);
    return { done, late: !done && !!card.due_date && card.due_date < today, today: !done && card.due_date === today };
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const columnOf = (id: string) => (columns.some((c) => c.id === id) ? id : cards.find((c) => c.id === id)?.column_id);

  function onDragStart(event: DragStartEvent) {
    dragging.current = true;
    setActiveId(String(event.active.id));
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const from = columnOf(String(active.id));
    const to = columnOf(String(over.id));
    if (!from || !to || from === to) return;
    // Show the card in the new column while dragging.
    setCards((prev) => prev.map((c) => (c.id === active.id ? { ...c, column_id: to } : c)));
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    dragging.current = false;
    if (!over) return void reload();
    const cardId = String(active.id);
    const to = columnOf(String(over.id));
    if (!to) return;

    const siblings = cards
      .filter((c) => c.column_id === to && c.id !== cardId)
      .sort((a, b) => a.position - b.position);
    let index = siblings.findIndex((c) => c.id === over.id);
    if (index === -1) index = siblings.length;
    const overCard = siblings[index];
    // Dropping on a card below the dragged one places it after that card.
    const original = cards.find((c) => c.id === cardId);
    if (overCard && original && original.column_id === to && original.position < overCard.position) index += 1;
    const position = positionBetween(siblings[index - 1]?.position, siblings[index]?.position);

    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, column_id: to, position } : c)));
    const { error: moveError } = await supabase.from("cards").update({ column_id: to, position }).eq("id", cardId);
    if (moveError) {
      setError(moveError.message);
      void reload();
    }
  }

  async function addCard(columnId: string, title: string) {
    const last = byColumn.get(columnId)?.at(-1)?.position ?? 0;
    const { error: addError } = await supabase.from("cards").insert({ board_id: boardId, column_id: columnId, title, position: last + 1, created_by: currentUserId });
    if (addError) setError(addError.message);
    await reload();
  }

  async function addColumn(name: string) {
    const last = columns.at(-1)?.position ?? 0;
    const { error: addError } = await supabase.from("board_columns").insert({ board_id: boardId, name, position: last + 1 });
    if (addError) setError(addError.message);
    await reload();
  }

  async function renameColumn(column: BoardColumn, name: string) {
    if (!name.trim() || name === column.name) return;
    await supabase.from("board_columns").update({ name: name.trim() }).eq("id", column.id);
    await reload();
  }

  async function deleteColumn(column: BoardColumn) {
    if ((byColumn.get(column.id)?.length ?? 0) > 0) return setError(t("columnNotEmpty"));
    await supabase.from("board_columns").delete().eq("id", column.id);
    await reload();
  }

  const total = cards.length;
  const done = cards.filter((c) => doneColumns.has(c.column_id)).length;
  const activeCard = activeId ? cards.find((c) => c.id === activeId) : null;
  const firstColumn = columns[0]?.id;

  const header = (
    <BoardHeader
      variant={variant}
      data={initial}
      members={initial.members}
      view={view}
      setView={setView}
      onlyMine={onlyMine}
      setOnlyMine={setOnlyMine}
      total={total}
      done={done}
      onNewTask={() => firstColumn && setAdding(firstColumn)}
      today={today}
    />
  );

  const boardBody = (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
      <div className={`flex min-h-0 flex-1 items-start gap-3.5 overflow-auto px-4 pb-6 sm:px-8 ${variant === "color" ? "pt-0" : "pt-5"}`}>
        {columns.map((column) => (
          <ColumnView
            key={column.id}
            column={column}
            cards={byColumn.get(column.id) ?? []}
            variant={variant}
            adding={adding === column.id}
            setAdding={(on) => setAdding(on ? column.id : null)}
            onAdd={(title) => addCard(column.id, title)}
            onRename={(name) => renameColumn(column, name)}
            onDelete={() => deleteColumn(column)}
            renderCard={(card) => (
              <SortableCard key={card.id} id={card.id} onOpen={() => setSelected(card.id)} label={card.title}>
                <CardVisual card={card} variant={variant} members={members} state={stateOf(card)} locale={locale} selected={selected === card.id} />
              </SortableCard>
            )}
          />
        ))}
        <AddColumn variant={variant} onAdd={addColumn} />
      </div>
      <DragOverlay>
        {activeCard ? (
          <div className="w-[230px] rotate-2">
            <CardVisual card={activeCard} variant={variant} members={members} state={stateOf(activeCard)} locale={locale} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );

  const list = (
    <div className="min-h-0 flex-1 overflow-auto px-4 py-5 sm:px-8">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className={variant === "color" ? "border-b-2 border-ink" : "border-b border-th-line text-th-muted"}>
            <th scope="col" className="py-2 pr-4 font-medium">{t("title")}</th>
            <th scope="col" className="py-2 pr-4 font-medium">{t("status")}</th>
            <th scope="col" className="py-2 pr-4 font-medium">{t("due")}</th>
            <th scope="col" className="py-2 font-medium">{t("assignees")}</th>
          </tr>
        </thead>
        <tbody>
          {[...visible].sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")).map((card) => (
            <tr key={card.id} className={variant === "color" ? "border-b border-line" : "border-b border-th-rule"}>
              <td className="py-3 pr-4">
                <button type="button" onClick={() => setSelected(card.id)} className="text-left font-medium underline-offset-4 hover:underline">{card.title}</button>
              </td>
              <td className="py-3 pr-4">{columns.find((c) => c.id === card.column_id)?.name}</td>
              <td className={`py-3 pr-4 ${stateOf(card).late ? "font-medium text-vermilion" : ""}`}>{card.due_date ?? "—"}</td>
              <td className="py-3">{card.assignees.map((id) => members.get(id)?.full_name).filter(Boolean).join(", ") || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const calendar = (
    <div className="min-h-0 flex-1 overflow-auto px-4 py-5 sm:px-8">
      {(() => {
        const dated = visible.filter((c) => c.due_date).sort((a, b) => (a.due_date as string).localeCompare(b.due_date as string));
        if (!dated.length) return <p className={s.muted}>{t("noDueDates")}</p>;
        const groups = new Map<string, BoardCard[]>();
        for (const card of dated) groups.set(card.due_date as string, [...(groups.get(card.due_date as string) ?? []), card]);
        return (
          <ol className="flex flex-col gap-5">
            {[...groups.entries()].map(([day, items]) => (
              <li key={day} className="grid gap-3 sm:grid-cols-[160px_1fr]">
                <span className={`font-display text-lg font-bold ${day < today ? "text-vermilion" : ""}`}>
                  {new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ro-RO", { weekday: "short", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`))}
                </span>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((card) => (
                    <button key={card.id} type="button" onClick={() => setSelected(card.id)} className="text-left">
                      <CardVisual card={card} variant={variant} members={members} state={stateOf(card)} locale={locale} />
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        );
      })()}
    </div>
  );

  const detail = selected ? (
    <CardDetail
      key={selected}
      cardId={selected}
      boardId={boardId}
      schoolId={initial.board.school_id}
      columns={columns}
      members={initial.members}
      currentUserId={currentUserId}
      variant={variant}
      locale={locale}
      onClose={() => setSelected(null)}
      onChanged={reload}
    />
  ) : null;

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${s.root}`}>
      {header}
      {error && (
        <p role="alert" className="mx-4 mb-2 bg-vermilion/20 px-3 py-2 text-sm sm:mx-8">
          {error} <button type="button" onClick={() => setError(null)} className="ml-2 underline">{t("dismiss")}</button>
        </p>
      )}
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{view === "board" ? boardBody : view === "list" ? list : calendar}</div>
      </div>
      {detail}
    </div>
  );
}

function SortableCard({ id, children, onOpen, label }: { id: string; children: ReactNode; onOpen: () => void; label: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
      {...attributes}
      {...listeners}
      aria-label={label}
      onClick={onOpen}
      onKeyDown={(event) => {
        listeners?.onKeyDown?.(event);
        if (event.key === "Enter") onOpen();
      }}
      className="cursor-grab touch-manipulation active:cursor-grabbing"
    >
      {children}
    </div>
  );
}

function ColumnView({
  column,
  cards,
  variant,
  adding,
  setAdding,
  onAdd,
  onRename,
  onDelete,
  renderCard,
}: {
  column: BoardColumn;
  cards: BoardCard[];
  variant: Theme;
  adding: boolean;
  setAdding: (on: boolean) => void;
  onAdd: (title: string) => Promise<void>;
  onRename: (name: string) => Promise<void>;
  onDelete: () => Promise<void>;
  renderCard: (card: BoardCard) => ReactNode;
}) {
  const t = useTranslations("workspace");
  const s = styles[variant];
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const [title, setTitle] = useState("");
  const [editing, setEditing] = useState(false);

  return (
    <section
      ref={setNodeRef}
      aria-label={column.name}
      className={`${s.column} ${isOver ? "outline-2 outline-teal outline-dashed" : ""}`}
    >
      <div className="flex items-center gap-2 px-1 pb-1">
        {editing ? (
          <input
            autoFocus
            defaultValue={column.name}
            aria-label={t("renameColumn")}
            onBlur={(e) => {
              setEditing(false);
              void onRename(e.target.value);
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className={s.input}
          />
        ) : (
          <h2 className={s.columnTitle}>
            <button type="button" onClick={() => setEditing(true)} title={t("renameColumn")}>{column.name}</button>
          </h2>
        )}
        <span className={s.count}>{cards.length}</span>
        {cards.length === 0 && !editing && (
          <button type="button" onClick={() => void onDelete()} aria-label={t("deleteColumn", { name: column.name })} className={`ml-auto grid size-8 place-items-center text-lg ${s.muted}`}>
            ×
          </button>
        )}
      </div>
      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-6 flex-col gap-2.5">{cards.map(renderCard)}</div>
      </SortableContext>
      {adding ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!title.trim()) return;
            await onAdd(title.trim());
            setTitle("");
          }}
          className="flex flex-col gap-2"
        >
          <label className="sr-only" htmlFor={`new-card-${column.id}`}>{t("newCardTitle")}</label>
          <textarea
            id={`new-card-${column.id}`}
            autoFocus
            rows={2}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                (e.target as HTMLTextAreaElement).form?.requestSubmit();
              }
              if (e.key === "Escape") setAdding(false);
            }}
            placeholder={t("newCardTitle")}
            className={s.input}
          />
          <div className="flex gap-2">
            <button type="submit" className={s.primary}>{t("add")}</button>
            <button type="button" onClick={() => setAdding(false)} className={s.ghost}>{t("cancel")}</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={s.addCard}>+ {t("addTask")}</button>
      )}
    </section>
  );
}

function AddColumn({ variant, onAdd }: { variant: Theme; onAdd: (name: string) => Promise<void> }) {
  const t = useTranslations("workspace");
  const s = styles[variant];
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${s.addCard} w-[200px] shrink-0 self-start`}>
        + {t("addColumn")}
      </button>
    );
  }
  return (
    <form
      className="flex w-[220px] shrink-0 flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        await onAdd(name.trim());
        setName("");
        setOpen(false);
      }}
    >
      <label className="sr-only" htmlFor="new-column">{t("addColumn")}</label>
      <input id="new-column" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t("columnName")} className={s.input} />
      <div className="flex gap-2">
        <button type="submit" className={s.primary}>{t("add")}</button>
        <button type="button" onClick={() => setOpen(false)} className={s.ghost}>{t("cancel")}</button>
      </div>
    </form>
  );
}

function BoardHeader({
  variant,
  data,
  members,
  view,
  setView,
  onlyMine,
  setOnlyMine,
  total,
  done,
  onNewTask,
  today,
}: {
  variant: Theme;
  data: BoardData;
  members: Member[];
  view: View;
  setView: (view: View) => void;
  onlyMine: boolean;
  setOnlyMine: (on: boolean) => void;
  total: number;
  done: number;
  onNewTask: () => void;
  today: string;
}) {
  const t = useTranslations("workspace");
  const s = styles[variant];
  const views: View[] = ["board", "calendar", "list"];
  const students = members.filter((m) => m.role === "student" || m.role === "core_lead");
  const daysLeft = data.board.due_date
    ? Math.round((Date.parse(`${data.board.due_date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
    : null;
  const mineToggle = (
    <label className={`inline-flex min-h-11 items-center gap-2 text-[13px] ${variant === "color" ? "font-medium" : ""}`}>
      <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} className={`size-4 ${variant === "color" ? "accent-ink" : "accent-th-link"}`} />
      {t("onlyMine")}
    </label>
  );

  if (variant !== "color") {
    return (
      <div className="shrink-0">
        <div className="flex flex-wrap items-end justify-between gap-5 px-4 pt-[26px] sm:px-8">
          <div>
            <div className="mb-1.5 text-[13px] text-th-muted">
              <Link href="/app/workspace" className="hover:text-th-link">{t("title_projects")}</Link> / {data.board.schoolName}
            </div>
            <h1 className="font-display text-[34px] font-bold tracking-[-0.01em]">{data.board.name}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex" aria-label={t("members")}>
              {students.slice(0, 5).map((m, i) => <Avatar key={m.id} id={m.id} name={m.full_name} size={32} ring="var(--th-bg)" className={i ? "-ml-2" : ""} />)}
            </div>
            <button type="button" onClick={onNewTask} className={s.primary}>+ {t("newTask")}</button>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-b border-th-line px-4 sm:px-8">
          <div role="tablist" aria-label={t("views")} className="flex gap-6 text-[15px]">
            {views.map((v) => (
              <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
                className={`border-b-[3px] py-3 ${view === v ? "border-teal text-th-fg" : "border-transparent text-th-muted"}`}>
                {t(`view_${v}`)}
              </button>
            ))}
          </div>
          {mineToggle}
        </div>
      </div>
    );
  }

  return (
    <div className="shrink-0">
      <div className="flex flex-wrap items-center justify-between gap-5 px-4 pt-6 pb-[18px] sm:px-7">
        <div className="flex flex-col gap-2.5">
          <Logo name="core" height={30} />
          <h1 className="font-display text-[36px] font-extrabold tracking-[-0.02em]">{data.board.name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-[190px] flex-col gap-2 rounded-[18px] border-2 border-ink px-4 py-2.5">
            <span className="text-[13px] font-medium">{t("progress", { done, total })}</span>
            <span aria-hidden="true" className="block h-2.5 overflow-hidden rounded-full border-2 border-ink">
              <span className="block h-full bg-pink" style={{ width: `${total ? Math.round((100 * done) / total) : 0}%` }} />
            </span>
          </div>
          {daysLeft !== null && daysLeft >= 0 && (
            <div className="flex items-center gap-2.5 rounded-[18px] border-2 border-ink bg-honey px-4 py-2">
              <span className="font-fun text-[34px] leading-none font-bold">{daysLeft}</span>
              <span className="text-[13px] leading-tight font-medium whitespace-pre-line">{t("daysLeft")}</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-4 sm:px-7">
        <div role="tablist" aria-label={t("views")} className="flex flex-wrap gap-1.5">
          {views.map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
              className={`h-10 rounded-full border-2 border-ink px-[18px] text-sm ${view === v ? "bg-ink font-medium text-white" : "bg-white"}`}>
              {t(`view_${v}`)}
            </button>
          ))}
          {mineToggle}
        </div>
        <button type="button" onClick={onNewTask} className={s.primary}>+ {t("newTask")}</button>
      </div>
    </div>
  );
}
