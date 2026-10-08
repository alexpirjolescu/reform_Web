"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/avatar";
import { createClient } from "@/lib/supabase/client";
import type { Theme } from "@/lib/theme-shared";
import { labelColors, type LabelColor } from "@/lib/types";
import { labelHex, stageColor, stages, type BoardCard, type BoardColumn, type Member, type Stage } from "@/lib/workspace";

type MapNode = {
  id: string;
  kind: "stage" | "concept" | "card";
  stage: Stage | null;
  card_id: string | null;
  label: string;
  note: string;
  color: LabelColor | null;
  x: number | null;
  y: number | null;
};
type LinkColor = LabelColor | "ink" | "white";
type MapLink = { id: string; from_node: string; to_node: string; label: string; label_bg: LinkColor | null; label_fg: LinkColor | null };
/** Colours a linking phrase can take: the brand palette plus ink and white. */
const linkColors: LinkColor[] = [...labelColors, "ink", "white"];
const linkHex = (color: LinkColor) => (color === "ink" ? "#221f20" : color === "white" ? "#ffffff" : labelHex[color].bg);
/** A text colour that reads on a background, for when only the background was picked. */
const inkOn = (color: LinkColor) => (color === "ink" || color === "lavender" ? "#ffffff" : "#221f20");
type Selection = { type: "node" | "link"; id: string } | null;
type Point = { x: number; y: number };

// Geometry of the canvas: one lane per story step, left to right.
const LANE = 300;
const HEAD = 64;
const STAGE_TOP = HEAD + 8;
const NODE_W = 240;
const STAGE_W = 196; // narrower than a lane, so the phrase joining two steps fits between them
const width = LANE * stages.length;

// Controls (fields, buttons) are the iOS-style "ui-" kit in every theme; the map itself keeps each design's look.
const studio = {
  frame: "border-th-line",
  inspector: "border-th-line bg-th-card",
  input: "ui-field ui-sm",
  select: "ui-field ui-select ui-sm",
  button: "ui-btn ui-filled ui-sm",
  ghost: "ui-btn ui-gray ui-neutral ui-sm",
  danger: "ui-btn ui-tinted ui-danger ui-sm",
  muted: "text-th-muted",
  heading: "font-display text-base font-semibold text-th-heading",
  card: "rounded-th border border-th-edge bg-th-card text-th-fg",
  linkLabel: "rounded-th border border-th-line bg-th-card text-th-fg",
  line: "var(--th-muted)",
};

const ui: Record<Theme, typeof studio> = {
  dark: studio,
  white: studio,
  color: {
    frame: "border-ink",
    inspector: "border-ink bg-white",
    input: "ui-field ui-sm",
    select: "ui-field ui-select ui-sm",
    button: "ui-btn ui-filled ui-sm",
    ghost: "ui-btn ui-gray ui-neutral ui-sm",
    danger: "ui-btn ui-tinted ui-danger ui-sm",
    muted: "text-muted",
    heading: "font-display text-base font-extrabold",
    card: "rounded-2xl border-2 border-ink bg-white text-ink",
    linkLabel: "rounded-full border-[1.5px] border-ink bg-white text-ink",
    line: "#221f20",
  },
};

/** Where a line from a box's centre towards `towards` leaves the box. */
function edgePoint(center: Point, size: { w: number; h: number }, towards: Point): Point {
  const dx = towards.x - center.x;
  const dy = towards.y - center.y;
  if (!dx && !dy) return center;
  const scale = Math.min(dx ? size.w / 2 / Math.abs(dx) : Infinity, dy ? size.h / 2 / Math.abs(dy) : Infinity);
  return { x: center.x + dx * scale, y: center.y + dy * scale };
}

const laneOf = (x: number) => stages[Math.max(0, Math.min(stages.length - 1, Math.floor(x / LANE)))];

/**
 * The project's concept map: the story from the need to the impact. Each step is a lane with the
 * team's own statement; tasks sit in the lane of their step; the team adds ideas and labelled links
 * between anything ("formularul — adună → răspunsurile"), like in CmapTools.
 */
export function ProjectMap({
  boardId,
  cards,
  columns,
  members,
  variant,
  onOpenCard,
  onCardsChanged,
}: {
  boardId: string;
  cards: BoardCard[];
  columns: BoardColumn[];
  members: Member[];
  variant: Theme;
  onOpenCard: (id: string) => void;
  onCardsChanged: () => void;
}) {
  const t = useTranslations("workspace");
  const s = ui[variant];
  const supabase = useMemo(() => createClient(), []);
  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [links, setLinks] = useState<MapLink[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selection>(null);
  // Drawing a new link: first the concept it leaves from (null until picked), then the one it reaches.
  const [linking, setLinking] = useState<{ from: string | null } | null>(null);
  const connectFrom = linking?.from ?? null;
  // The link whose phrase is being typed right on the map.
  const [editingLink, setEditingLink] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [viewHeight, setViewHeight] = useState(0);
  const [mode, setMode] = useState<"map" | "story">("map");
  const [sizes, setSizes] = useState<Record<string, { w: number; h: number }>>({});
  const [dragPos, setDragPos] = useState<Record<string, Point>>({});
  const drag = useRef<{ id: string; start: Point; origin: Point; moved: boolean } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const elements = useRef(new Map<string, HTMLElement>());

  const cardMap = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const doneColumns = useMemo(() => new Set(columns.filter((c) => c.is_done).map((c) => c.id)), [columns]);
  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const load = useCallback(async () => {
    if (drag.current) return;
    const [n, l] = await Promise.all([
      supabase.from("board_map_nodes").select("id, kind, stage, card_id, label, note, color, x, y").eq("board_id", boardId),
      supabase.from("board_map_links").select("id, from_node, to_node, label, label_bg, label_fg").eq("board_id", boardId),
    ]);
    if (n.error || l.error) {
      setError(n.error?.message ?? l.error?.message ?? "");
      return;
    }
    setNodes((n.data ?? []) as MapNode[]);
    setLinks((l.data ?? []) as MapLink[]);
    setLoaded(true);
  }, [boardId, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on open
    void load();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void load(), 250);
    };
    const channel = supabase
      .channel(`map:${boardId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "board_map_nodes", filter: `board_id=eq.${boardId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "board_map_links", filter: `board_id=eq.${boardId}` }, refresh)
      .subscribe();
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [boardId, load, supabase]);

  // Tasks on the map: only those that still have a step (a task leaves the map by losing its step).
  const visible = useMemo(
    () => nodes.filter((n) => n.kind !== "card" || (n.card_id && cardMap.get(n.card_id)?.stage)),
    [nodes, cardMap],
  );
  const stageOfNode = useCallback(
    (n: MapNode): Stage | null => (n.kind === "card" ? (n.card_id && cardMap.get(n.card_id)?.stage) || null : n.kind === "stage" ? n.stage : null),
    [cardMap],
  );

  // Measure every box so links start and end at their edges.
  const measure = useCallback((id: string) => (el: HTMLElement | null) => {
    if (!observer.current) {
      observer.current = new ResizeObserver((entries) => {
        setSizes((prev) => {
          const next = { ...prev };
          for (const entry of entries) {
            const key = (entry.target as HTMLElement).dataset.node!;
            next[key] = { w: (entry.target as HTMLElement).offsetWidth, h: (entry.target as HTMLElement).offsetHeight };
          }
          return next;
        });
      });
    }
    const previous = elements.current.get(id);
    if (previous && previous !== el) observer.current.unobserve(previous);
    if (el) {
      elements.current.set(id, el);
      observer.current.observe(el);
    } else elements.current.delete(id);
  }, []);
  useEffect(() => () => observer.current?.disconnect(), []);

  // Positions: saved ones, or stacked under their step's statement.
  const positions = useMemo(() => {
    const out: Record<string, Point> = {};
    const stack: Record<string, number> = {};
    for (const n of visible.filter((v) => v.kind === "stage")) {
      const lane = stages.indexOf(n.stage!);
      out[n.id] = { x: lane * LANE + (LANE - STAGE_W) / 2, y: STAGE_TOP };
      stack[n.stage!] = STAGE_TOP + (sizes[n.id]?.h ?? 120) + 36;
    }
    const auto = visible
      .filter((n) => n.kind !== "stage" && (n.x === null || n.y === null))
      .sort((a, b) => (cardMap.get(a.card_id ?? "")?.position ?? 0) - (cardMap.get(b.card_id ?? "")?.position ?? 0));
    for (const n of visible) if (n.kind !== "stage" && n.x !== null && n.y !== null) out[n.id] = { x: Math.min(Math.max(0, n.x), width - NODE_W), y: Math.max(HEAD, n.y) };
    for (const n of auto) {
      const stage = stageOfNode(n) ?? "need";
      const lane = stages.indexOf(stage);
      const y = stack[stage] ?? STAGE_TOP + 160;
      out[n.id] = { x: lane * LANE + (LANE - NODE_W) / 2, y };
      stack[stage] = y + (sizes[n.id]?.h ?? 72) + 18;
    }
    for (const [id, p] of Object.entries(dragPos)) out[id] = p;
    return out;
  }, [visible, sizes, dragPos, cardMap, stageOfNode]);

  const height = Math.max(640, Math.floor((viewHeight - 2) / zoom), ...visible.map((n) => (positions[n.id]?.y ?? 0) + (sizes[n.id]?.h ?? 80) + 120));
  const center = (id: string): Point | null => {
    const p = positions[id];
    const size = sizes[id];
    return p && size ? { x: p.x + size.w / 2, y: p.y + size.h / 2 } : null;
  };

  const labelOf = useCallback(
    (n: MapNode | undefined) => {
      if (!n) return "";
      if (n.kind === "stage") return t(`stages.${n.stage}.name`);
      if (n.kind === "card") return cardMap.get(n.card_id ?? "")?.title ?? "";
      return n.label || t("map.untitledIdea");
    },
    [cardMap, t],
  );
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  async function run(action: PromiseLike<{ error: { message: string } | null }>) {
    const { error: actionError } = await action;
    if (actionError) setError(actionError.message);
    await load();
  }

  // Moving a task to another step changes the task itself, so the board refreshes too.
  async function setStage(cardId: string, stage: Stage | null) {
    const { error: stageError } = await supabase.from("cards").update({ stage }).eq("id", cardId);
    if (stageError) setError(stageError.message);
    onCardsChanged();
    await load();
  }

  // ---- pointer: drag to move, click to select or to finish a link -----------

  function onPointerDown(event: React.PointerEvent, node: MapNode) {
    if ((event.target as HTMLElement).closest("[data-no-drag]") || event.button !== 0) return;
    const origin = positions[node.id];
    if (!origin) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    drag.current = { id: node.id, start: { x: event.clientX, y: event.clientY }, origin, moved: false };
  }

  function onPointerMove(event: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = (event.clientX - d.start.x) / zoom;
    const dy = (event.clientY - d.start.y) / zoom;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    const node = nodeById.get(d.id);
    if (node?.kind === "stage") return; // steps stay at the top of their lane
    d.moved = true;
    setDragPos({ [d.id]: { x: Math.max(0, Math.min(width - NODE_W, d.origin.x + dx)), y: Math.max(HEAD, d.origin.y + dy) } });
  }

  async function onPointerUp(node: MapNode) {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) {
      setDragPos({});
      return void clickNode(node);
    }
    const p = dragPos[node.id];
    if (!p) return;
    // A task dropped in another lane moves to that step (then keeps the spot it was dropped on).
    const stage = laneOf(p.x + NODE_W / 2);
    if (node.kind === "card" && node.card_id && cardMap.get(node.card_id)?.stage !== stage) {
      await setStage(node.card_id, stage);
    }
    await run(supabase.from("board_map_nodes").update({ x: Math.round(p.x), y: Math.round(p.y) }).eq("id", node.id));
    setDragPos({});
  }

  async function clickNode(node: MapNode) {
    if (linking && !linking.from) {
      // New link, first click: where it starts.
      setLinking({ from: node.id });
      setSelected({ type: "node", id: node.id });
      return;
    }
    if (linking?.from && linking.from !== node.id) {
      // Second click: where it ends. Then the phrase box opens on the map, ready for typing.
      const from = linking.from;
      setLinking(null);
      const { data, error: linkError } = await supabase
        .from("board_map_links")
        .insert({ board_id: boardId, from_node: from, to_node: node.id, label: "" })
        .select("id")
        .single();
      if (linkError) setError(linkError.code === "23505" ? t("map.linkExists") : linkError.message);
      await load();
      if (data) {
        setSelected({ type: "link", id: data.id });
        setEditingLink(data.id);
      }
      return;
    }
    setLinking(null);
    setSelected({ type: "node", id: node.id });
  }

  /** Starts a new link: from the given concept, or the next click picks where it starts. */
  const startLinking = useCallback((from?: string | null) => {
    setEditingLink(null);
    setMode("map");
    setLinking({ from: from ?? null });
  }, []);

  async function saveLinkLabel(link: MapLink, value: string) {
    setEditingLink(null);
    if (value.trim() !== link.label) await run(supabase.from("board_map_links").update({ label: value.trim() }).eq("id", link.id));
  }

  function nudge(event: React.KeyboardEvent, node: MapNode) {
    const step = event.shiftKey ? 40 : 10;
    const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (node.kind === "card" && node.card_id && event.key === "Enter" && event.shiftKey) return onOpenCard(node.card_id);
      return void clickNode(node);
    }
    if (!move || node.kind === "stage") return;
    event.preventDefault();
    const p = positions[node.id];
    void run(supabase.from("board_map_nodes").update({ x: Math.max(0, p.x + move[0]), y: Math.max(HEAD, p.y + move[1]) }).eq("id", node.id));
  }

  // Keyboard: L starts a new link (from the selected concept, if any); Escape cancels it.
  const selectedNodeId = selected?.type === "node" ? selected.id : null;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLinking(null);
        setEditingLink(null);
        return;
      }
      const target = event.target as HTMLElement | null;
      const typing = target?.closest("input, textarea, select, [contenteditable=true]");
      if (typing || event.ctrlKey || event.metaKey || event.altKey || event.key.toLowerCase() !== "l") return;
      if (document.querySelector("[role=dialog]")) return; // a task window is open on top
      event.preventDefault();
      startLinking(selectedNodeId);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedNodeId, startLinking]);

  // A new idea goes under everything else in the lane in the middle of the screen, then comes into view.
  async function addIdea() {
    const box = scroller.current;
    const middle = box ? (box.scrollLeft + box.clientWidth / 2) / zoom : LANE / 2;
    const lane = Math.max(0, Math.min(stages.length - 1, Math.floor(middle / LANE)));
    const inLane = visible.filter((n) => {
      const p = positions[n.id];
      return p && p.x < (lane + 1) * LANE && p.x + (sizes[n.id]?.w ?? NODE_W) > lane * LANE;
    });
    const x = lane * LANE + (LANE - NODE_W) / 2;
    const y = Math.max(STAGE_TOP + 160, ...inLane.map((n) => positions[n.id].y + (sizes[n.id]?.h ?? 72))) + 28;
    const { data, error: addError } = await supabase
      .from("board_map_nodes")
      .insert({ board_id: boardId, kind: "concept", label: t("map.newIdea"), color: "teal", x: Math.round(x), y: Math.round(y) })
      .select("id")
      .single();
    if (addError) setError(addError.message);
    await load();
    if (!data) return;
    setSelected({ type: "node", id: data.id });
    requestAnimationFrame(() => box?.scrollTo({ left: Math.max(0, x * zoom - box.clientWidth / 2 + (NODE_W * zoom) / 2), top: Math.max(0, y * zoom - box.clientHeight / 2), behavior: "smooth" }));
  }

  // Start zoomed to fit the screen, but never so small that the text can't be read.
  useLayoutEffect(() => {
    const box = scroller.current;
    if (!box || box.clientWidth >= width) return;
    const fit = Math.floor((box.clientWidth / width) * 20) / 20;
    setZoom(Math.max(box.clientWidth < 640 ? 0.5 : 0.75, fit));
  }, []);

  // The lanes reach the bottom of the visible area.
  useEffect(() => {
    const box = scroller.current;
    if (!box) return;
    const watch = new ResizeObserver(() => setViewHeight(box.clientHeight));
    watch.observe(box);
    return () => watch.disconnect();
  }, [mode]);

  const selectedNode = selected?.type === "node" ? nodeById.get(selected.id) : undefined;
  const selectedLink = selected?.type === "link" ? links.find((l) => l.id === selected.id) : undefined;
  const unstaged = cards.filter((c) => !c.stage);
  const tasksIn = (stage: Stage) => cards.filter((c) => c.stage === stage);

  // ---- rendering -------------------------------------------------------------

  const nodeView = (node: MapNode) => {
    const p = positions[node.id];
    if (!p) return null;
    const isSelected = selected?.type === "node" && selected.id === node.id;
    const ring = isSelected ? "outline outline-3 outline-offset-2 outline-teal" : connectFrom === node.id ? "outline outline-3 outline-dashed outline-offset-2 outline-teal" : "";
    const common = {
      "data-node": node.id,
      ref: measure(node.id),
      role: "button",
      tabIndex: 0,
      onPointerDown: (e: React.PointerEvent) => onPointerDown(e, node),
      onPointerMove,
      onPointerUp: () => void onPointerUp(node),
      onKeyDown: (e: React.KeyboardEvent) => nudge(e, node),
      style: { left: p.x, top: p.y, width: node.kind === "stage" ? STAGE_W : NODE_W, touchAction: "none" as const },
    };

    if (node.kind === "stage") {
      const stage = node.stage!;
      const color = stageColor[stage];
      return (
        <div key={node.id} {...common} aria-label={`${t(`stages.${stage}.name`)}: ${node.label || t(`stages.${stage}.prompt`)}`}
          className={`absolute flex cursor-pointer flex-col overflow-hidden select-none ${s.card} ${ring}`} style={{ ...common.style, borderColor: color.bg, borderWidth: 3 }}>
          <span className="px-3 py-1.5 font-display text-sm font-bold" style={{ background: color.bg, color: color.fg }}>
            {stages.indexOf(stage) + 1}. {t(`stages.${stage}.name`)}
          </span>
          <span className={`px-3 py-2.5 text-sm leading-snug ${node.label ? "" : `italic ${s.muted}`}`}>{node.label || t(`stages.${stage}.prompt`)}</span>
        </div>
      );
    }

    if (node.kind === "card") {
      const card = cardMap.get(node.card_id ?? "");
      if (!card) return null;
      const done = doneColumns.has(card.column_id);
      const column = columns.find((c) => c.id === card.column_id);
      return (
        <div key={node.id} {...common} aria-label={`${t("task")}: ${card.title}${done ? `, ${t("done")}` : ""}`} onDoubleClick={() => onOpenCard(card.id)}
          className={`absolute flex cursor-grab flex-col gap-1.5 px-3 py-2.5 select-none active:cursor-grabbing ${s.card} ${ring}`}
          style={{ ...common.style, borderLeft: `6px solid ${card.stage ? stageColor[card.stage].bg : "transparent"}` }}>
          <span className={`text-sm leading-snug font-medium ${done ? "line-through opacity-70" : ""}`}>{card.title}</span>
          <span className={`flex items-center gap-2 text-xs ${s.muted}`}>
            {done ? `✓ ${t("done")}` : column?.name}
            {card.checklistTotal > 0 && <span>· {card.checklistDone}/{card.checklistTotal}</span>}
            <span className="ml-auto flex">
              {card.assignees.slice(0, 3).map((id, i) => <Avatar key={id} id={id} name={memberMap.get(id)?.full_name ?? "?"} size={20} className={i ? "-ml-1" : ""} />)}
            </span>
          </span>
        </div>
      );
    }

    const color = node.color ? labelHex[node.color] : labelHex.teal;
    return (
      <div key={node.id} {...common} aria-label={`${t("map.idea")}: ${labelOf(node)}`}
        className={`absolute cursor-grab rounded-[22px] border-2 px-4 py-3 text-center text-sm leading-snug font-semibold select-none active:cursor-grabbing ${ring}`}
        style={{ ...common.style, background: color.bg, color: color.fg, borderColor: variant === "color" ? "#221f20" : color.bg }}>
        {labelOf(node)}
      </div>
    );
  };

  const linkView = (link: MapLink) => {
    const a = center(link.from_node);
    const b = center(link.to_node);
    const sa = sizes[link.from_node];
    const sb = sizes[link.to_node];
    if (!a || !b || !sa || !sb) return null;
    if (!visible.some((n) => n.id === link.from_node) || !visible.some((n) => n.id === link.to_node)) return null;
    const p1 = edgePoint(a, sa, b);
    const p2 = edgePoint(b, sb, a);
    return { link, p1, p2, mid: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 } };
  };
  const drawn = links.map(linkView).filter((v): v is NonNullable<ReturnType<typeof linkView>> => Boolean(v));

  /** The phrase box's own colours, when the team picked some. */
  const linkLook = (link: MapLink): React.CSSProperties => ({
    ...(link.label_bg && { background: linkHex(link.label_bg), borderColor: variant === "color" ? "#221f20" : linkHex(link.label_bg) }),
    ...((link.label_fg || link.label_bg) && { color: link.label_fg ? linkHex(link.label_fg) : inkOn(link.label_bg!) }),
  });

  const canvas = (
    <div style={{ width: width * zoom, height: height * zoom }}>
      <div className="relative origin-top-left" style={{ width, height, transform: `scale(${zoom})` }}>
        {stages.map((stage, i) => (
          <div key={stage} aria-hidden="true" className={`absolute top-0 bottom-0 border-r ${s.frame}`} style={{ left: i * LANE, width: LANE, background: `${stageColor[stage].bg}14` }}>
            <div className="flex items-baseline justify-between px-4 pt-3">
              <span className="font-display text-sm font-bold">{i + 1}. {t(`stages.${stage}.name`)}</span>
              <span className={`text-xs ${s.muted}`}>{t("map.laneProgress", { done: tasksIn(stage).filter((c) => doneColumns.has(c.column_id)).length, total: tasksIn(stage).length })}</span>
            </div>
          </div>
        ))}
        <svg className="pointer-events-none absolute inset-0" width={width} height={height} aria-hidden="true">
          <defs>
            <marker id={`arrow-${boardId}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={s.line} />
            </marker>
          </defs>
          {drawn.map(({ link, p1, p2 }) => (
            <line key={link.id} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={selected?.id === link.id ? "#77bfb2" : s.line} strokeWidth={selected?.id === link.id ? 3 : 1.6} markerEnd={`url(#arrow-${boardId})`} />
          ))}
        </svg>
        {visible.map(nodeView)}
        {/* Linking phrases sit on top: they are what turns two concepts into a sentence. */}
        {drawn.map(({ link, mid }) => {
          const look = linkLook(link);
          if (editingLink === link.id) {
            return (
              <input
                key={link.id}
                autoFocus
                defaultValue={link.label}
                maxLength={80}
                aria-label={t("map.linkPhraseFor", { from: labelOf(nodeById.get(link.from_node)), to: labelOf(nodeById.get(link.to_node)) })}
                placeholder={t("map.linkPlaceholderShort")}
                onBlur={(e) => void saveLinkLabel(link, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    setEditingLink(null);
                  }
                }}
                className="ui-field ui-sm absolute w-44 -translate-x-1/2 -translate-y-1/2 bg-th-card text-center"
                style={{ left: mid.x, top: mid.y, ...look }}
              />
            );
          }
          return (
            <button
              key={link.id}
              type="button"
              onClick={() => setSelected({ type: "link", id: link.id })}
              onDoubleClick={() => setEditingLink(link.id)}
              aria-label={`${t("map.link")}: ${labelOf(nodeById.get(link.from_node))} ${link.label || "→"} ${labelOf(nodeById.get(link.to_node))}`}
              className={`absolute max-w-24 -translate-x-1/2 -translate-y-1/2 px-1.5 py-0.5 text-center text-[11px] leading-tight ${s.linkLabel} ${selected?.id === link.id ? "outline outline-2 outline-teal" : ""} ${link.label ? "" : "opacity-60"}`}
              style={{ left: mid.x, top: mid.y, ...look }}
            >
              {link.label || "…"}
            </button>
          );
        })}
      </div>
    </div>
  );

  // ---- inspector ------------------------------------------------------------

  const startLink = (id: string) => (
    <button type="button" onClick={() => startLinking(id)} className="ui-btn ui-tinted ui-sm">↗ {t("map.connect")}</button>
  );

  // Colour pickers stay swatches: round, a hairline so ink and white show on any panel, a ring when chosen.
  const swatch = (on: boolean) =>
    `size-8 shrink-0 rounded-full inset-ring-1 inset-ring-th-sep transition-transform active:scale-90 ${on ? "ring-2 ring-th-fg ring-offset-2 ring-offset-th-card" : ""}`;

  const paint = (field: "label_bg" | "label_fg", color: LinkColor | null) =>
    run(supabase.from("board_map_links").update(field === "label_bg" ? { label_bg: color } : { label_fg: color }).eq("id", selectedLink!.id));

  const swatches = (legend: string, value: LinkColor | null, field: "label_bg" | "label_fg") => (
    <fieldset className="flex flex-col gap-1.5">
      <legend className={`mb-1 text-sm ${s.muted}`}>{legend}</legend>
      <div className="flex flex-wrap gap-2.5">
        <button type="button" aria-pressed={value === null} aria-label={t("map.colorDefault")} title={t("map.colorDefault")}
          onClick={() => paint(field, null)}
          className={`grid place-items-center bg-th-fill text-xs text-th-muted ${swatch(value === null)}`}>
          ⌀
        </button>
        {linkColors.map((color) => (
          <button key={color} type="button" aria-pressed={value === color} aria-label={t(`map.colors.${color}`)} title={t(`map.colors.${color}`)}
            onClick={() => paint(field, color)}
            className={swatch(value === color)}
            style={{ background: linkHex(color) }} />
        ))}
      </div>
    </fieldset>
  );

  let inspector: React.ReactNode;
  if (selectedLink) {
    const from = nodeById.get(selectedLink.from_node);
    const to = nodeById.get(selectedLink.to_node);
    inspector = (
      <div className="flex flex-col gap-3">
        <h3 className={s.heading}>{t("map.link")}</h3>
        <p className="text-sm"><strong>{labelOf(from)}</strong></p>
        <label className="flex flex-col gap-1 text-sm">
          <span className={s.muted}>{t("map.linkPhrase")}</span>
          <input key={`${selectedLink.id}-${selectedLink.label}`} defaultValue={selectedLink.label} maxLength={80} placeholder={t("map.linkPlaceholder")} className={s.input}
            onBlur={(e) => e.target.value.trim() !== selectedLink.label && run(supabase.from("board_map_links").update({ label: e.target.value.trim() }).eq("id", selectedLink.id))}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
        </label>
        <p className="text-sm">→ <strong>{labelOf(to)}</strong></p>
        {swatches(t("map.linkBackground"), selectedLink.label_bg, "label_bg")}
        {swatches(t("map.linkText"), selectedLink.label_fg, "label_fg")}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={s.ghost} onClick={() => run(supabase.from("board_map_links").update({ from_node: selectedLink.to_node, to_node: selectedLink.from_node }).eq("id", selectedLink.id))}>
            ⇄ {t("map.reverse")}
          </button>
          <button type="button" className={s.danger} onClick={async () => { await run(supabase.from("board_map_links").delete().eq("id", selectedLink.id)); setSelected(null); }}>
            {t("map.removeLink")}
          </button>
        </div>
      </div>
    );
  } else if (selectedNode?.kind === "stage") {
    const stage = selectedNode.stage!;
    inspector = (
      <div className="flex flex-col gap-3">
        <h3 className={s.heading}>{stages.indexOf(stage) + 1}. {t(`stages.${stage}.name`)}</h3>
        <label className="flex flex-col gap-1 text-sm">
          <span className={s.muted}>{t(`stages.${stage}.prompt`)}</span>
          <textarea key={selectedNode.id} rows={4} maxLength={300} defaultValue={selectedNode.label} className={s.input}
            onBlur={(e) => e.target.value !== selectedNode.label && run(supabase.from("board_map_nodes").update({ label: e.target.value.trim() }).eq("id", selectedNode.id))} />
        </label>
        <p className={`text-xs ${s.muted}`}>{t(`stages.${stage}.hint`)}</p>
        {startLink(selectedNode.id)}
        <div className="flex flex-col gap-1">
          <span className={`text-xs ${s.muted}`}>{t("map.tasksInStep", { count: tasksIn(stage).length })}</span>
          {tasksIn(stage).map((c) => (
            <button key={c.id} type="button" onClick={() => onOpenCard(c.id)} className="text-left text-sm underline-offset-4 hover:underline">
              {doneColumns.has(c.column_id) ? "✓ " : ""}{c.title}
            </button>
          ))}
        </div>
      </div>
    );
  } else if (selectedNode?.kind === "card") {
    const card = cardMap.get(selectedNode.card_id ?? "");
    inspector = card && (
      <div className="flex flex-col gap-3">
        <h3 className={s.heading}>{card.title}</h3>
        <label className="flex flex-col gap-1 text-sm">
          <span className={s.muted}>{t("stage")}</span>
          <select value={card.stage ?? ""} onChange={(e) => void setStage(card.id, (e.target.value || null) as Stage | null)} className={s.select}>
            <option value="">{t("map.offMap")}</option>
            {stages.map((st) => <option key={st} value={st}>{t(`stages.${st}.name`)}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={s.button} onClick={() => onOpenCard(card.id)}>{t("map.openTask")}</button>
          {startLink(selectedNode.id)}
        </div>
      </div>
    );
  } else if (selectedNode?.kind === "concept") {
    inspector = (
      <div className="flex flex-col gap-3">
        <h3 className={s.heading}>{t("map.idea")}</h3>
        <label className="flex flex-col gap-1 text-sm">
          <span className={s.muted}>{t("map.ideaLabel")}</span>
          <input key={`${selectedNode.id}-l`} autoFocus defaultValue={selectedNode.label} maxLength={300} className={s.input}
            onBlur={(e) => e.target.value !== selectedNode.label && run(supabase.from("board_map_nodes").update({ label: e.target.value.trim() }).eq("id", selectedNode.id))}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className={s.muted}>{t("map.ideaNote")}</span>
          <textarea key={`${selectedNode.id}-n`} rows={3} maxLength={2000} defaultValue={selectedNode.note} className={s.input}
            onBlur={(e) => e.target.value !== selectedNode.note && run(supabase.from("board_map_nodes").update({ note: e.target.value }).eq("id", selectedNode.id))} />
        </label>
        <fieldset className="flex flex-col gap-1.5">
          <legend className={`mb-1 text-sm ${s.muted}`}>{t("labelColor")}</legend>
          <div className="flex flex-wrap gap-2.5">
            {labelColors.map((color) => (
              <button key={color} type="button" aria-pressed={selectedNode.color === color} aria-label={t(`colors.${color}`)}
                onClick={() => run(supabase.from("board_map_nodes").update({ color }).eq("id", selectedNode.id))}
                className={swatch(selectedNode.color === color)} style={{ background: labelHex[color].bg }} />
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap gap-2">
          {startLink(selectedNode.id)}
          <button type="button" className={s.danger} onClick={async () => { await run(supabase.from("board_map_nodes").delete().eq("id", selectedNode.id)); setSelected(null); }}>
            {t("map.removeIdea")}
          </button>
        </div>
      </div>
    );
  } else {
    inspector = (
      <div className="flex flex-col gap-3 text-sm">
        <h3 className={s.heading}>{t("map.howTitle")}</h3>
        <ul className={`flex list-disc flex-col gap-1.5 pl-4 ${s.muted}`}>
          <li>{t("map.how1")}</li>
          <li>{t("map.how2")}</li>
          <li>{t("map.how3")}</li>
          <li>{t("map.how4")}</li>
        </ul>
        {unstaged.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className={s.heading}>{t("map.unstaged", { count: unstaged.length })}</h3>
            {unstaged.map((c) => (
              <label key={c.id} className="flex flex-col gap-1">
                <span className="text-sm">{c.title}</span>
                <select value="" aria-label={t("map.placeTask", { title: c.title })} onChange={(e) => e.target.value && void setStage(c.id, e.target.value as Stage)} className={s.select}>
                  <option value="">{t("map.pickStep")}</option>
                  {stages.map((st) => <option key={st} value={st}>{t(`stages.${st}.name`)}</option>)}
                </select>
              </label>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---- the story, in words ------------------------------------------------

  const story = (
    <article className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-8">
      {stages.map((stage, i) => {
        const node = nodes.find((n) => n.kind === "stage" && n.stage === stage);
        const tasks = tasksIn(stage);
        return (
          <section key={stage} className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 font-display text-xl font-bold">
              <span aria-hidden="true" className="size-3 rounded-full" style={{ background: stageColor[stage].bg }} />
              {i + 1}. {t(`stages.${stage}.name`)}
            </h3>
            <p className={node?.label ? "text-base leading-relaxed" : `italic ${s.muted}`}>{node?.label || t("map.notWritten")}</p>
            {tasks.length > 0 && (
              <ul className="flex flex-col gap-1 text-sm">
                {tasks.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => onOpenCard(c.id)} className="text-left underline-offset-4 hover:underline">
                      {doneColumns.has(c.column_id) ? "✓" : "○"} {c.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      {links.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="font-display text-xl font-bold">{t("map.propositions")}</h3>
          <ul className="flex flex-col gap-1 text-sm leading-relaxed">
            {links
              .filter((l) => visible.some((n) => n.id === l.from_node) && visible.some((n) => n.id === l.to_node))
              .map((l) => (
                <li key={l.id}>
                  <strong>{labelOf(nodeById.get(l.from_node))}</strong> {l.label || "→"} <strong>{labelOf(nodeById.get(l.to_node))}</strong>.
                </li>
              ))}
          </ul>
        </section>
      )}
    </article>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={`flex shrink-0 flex-wrap items-center gap-2.5 border-b px-4 py-2.5 sm:px-8 ${s.frame}`}>
        <div role="tablist" aria-label={t("map.modes")} className="ui-seg">
          {(["map", "story"] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}>
              {t(`map.mode_${m}`)}
            </button>
          ))}
        </div>
        {mode === "map" && (
          <>
            <button type="button" onClick={addIdea} className="ui-btn ui-filled ui-sm">+ {t("map.addIdea")}</button>
            <button type="button" onClick={() => (linking ? setLinking(null) : startLinking(selectedNodeId))} aria-pressed={Boolean(linking)} aria-keyshortcuts="L"
              title={t("map.newLinkHint")} className={`ui-btn ui-sm ${linking ? "ui-filled" : "ui-tinted"}`}>
              ↗ {t("map.newLink")} <kbd className="rounded-md bg-current/15 px-1.5 py-px text-[11px] leading-4 font-semibold">L</kbd>
            </button>
            <div className="ml-auto flex items-center rounded-full bg-th-fill p-0.5" aria-label={t("map.zoom")}>
              <button type="button" className="ui-btn ui-plain ui-icon ui-sm ui-neutral text-lg font-normal" aria-label={t("map.zoomOut")} onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}>−</button>
              <span className="w-12 text-center text-sm tabular-nums">{Math.round(zoom * 100)}%</span>
              <button type="button" className="ui-btn ui-plain ui-icon ui-sm ui-neutral text-lg font-normal" aria-label={t("map.zoomIn")} onClick={() => setZoom((z) => Math.min(1.5, Math.round((z + 0.1) * 10) / 10))}>+</button>
            </div>
          </>
        )}
      </div>
      {linking && (
        <p role="status" className="shrink-0 bg-teal/30 px-4 py-2 text-sm sm:px-8">
          {connectFrom ? t("map.connecting", { name: labelOf(nodeById.get(connectFrom)) }) : t("map.pickStart")}{" "}
          <button type="button" onClick={() => setLinking(null)} className="ui-btn ui-plain ui-sm ui-neutral ml-1">{t("cancel")}</button>
        </p>
      )}
      {error && (
        <p role="alert" className="shrink-0 bg-vermilion/20 px-4 py-2 text-sm sm:px-8">
          {error} <button type="button" onClick={() => setError(null)} className="ui-btn ui-plain ui-sm ui-neutral ml-1">{t("dismiss")}</button>
        </p>
      )}
      {mode === "story" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">{story}</div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div ref={scroller} className="min-h-[60vh] flex-1 overflow-auto lg:min-h-0" onClick={(e) => {
            // A click on empty space clears the selection (and a link in progress).
            if (!(e.target as HTMLElement).closest("[data-node], button, input")) {
              setSelected(null);
              setLinking(null);
            }
          }}>
            {loaded ? canvas : <p className={`p-6 ${s.muted}`}>{t("loading")}</p>}
          </div>
          <aside aria-label={t("map.details")} className={`shrink-0 overflow-y-auto border-t p-5 lg:w-72 lg:border-t-0 lg:border-l ${s.inspector}`}>
            {inspector}
          </aside>
        </div>
      )}
    </div>
  );
}
