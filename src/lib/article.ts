// A news article as blocks: headings, text, media (photos, videos, files, links, social posts),
// quotes, boxes, buttons and dividers, in any order, with media placed across the page, beside the
// text (left or right) or side by side. Shared by the editor, the save action and the public page.
// Client-safe: no server imports.

import type { MediaItem } from "./media";

export type TextStyle = "normal" | "lead" | "quote" | "note";
/** Where a media block sits on the paper. */
export type Placement = "full" | "left" | "right" | "row";
/** "s" a third, "m" half (beside text) or two thirds (across), "l" the full width. */
export type Width = "s" | "m" | "l";

export const placements: Placement[] = ["full", "left", "right", "row"];
export const textStyles: TextStyle[] = ["normal", "lead", "quote", "note"];

/** Stored in activities.layout. Media blocks point at the post's media by position (1, 2, …). */
export type StoredBlock =
  | { type: "heading"; text: string; hint?: string }
  | { type: "text"; body: string; style: TextStyle; hint?: string }
  | { type: "media"; items: number[]; place: Placement; width: Width; hint?: string }
  | { type: "divider" }
  | { type: "button"; label: string; url: string; hint?: string };

export type StoredLayout = { v: 1; blocks: StoredBlock[] };

/** In the editor, media blocks hold the items themselves; `key` keeps React and drag-and-drop stable. */
export type EditorBlock =
  | { key: string; type: "heading"; text: string; hint?: string }
  | { key: string; type: "text"; body: string; style: TextStyle; hint?: string }
  | { key: string; type: "media"; items: MediaItem[]; place: Placement; width: Width; hint?: string }
  | { key: string; type: "divider" }
  | { key: string; type: "button"; label: string; url: string; hint?: string };

export type BlockType = EditorBlock["type"];

let counter = 0;
export const newKey = () => `b${Date.now().toString(36)}${(counter++).toString(36)}`;

export function blankBlock(type: BlockType): EditorBlock {
  const key = newKey();
  switch (type) {
    case "heading":
      return { key, type, text: "" };
    case "text":
      return { key, type, body: "", style: "normal" };
    case "media":
      return { key, type, items: [], place: "full", width: "l" };
    case "divider":
      return { key, type };
    case "button":
      return { key, type, label: "", url: "" };
  }
}

/** What the editor saves: the media in block order, and the layout pointing at them. */
export function toStored(blocks: EditorBlock[]): { media: MediaItem[]; layout: StoredLayout; body: string } {
  const media: MediaItem[] = [];
  const stored = blocks.map((block): StoredBlock => {
    const { key: _key, ...rest } = block;
    void _key;
    if (rest.type !== "media") return rest;
    // push returns the new length, which is the item's position (1, 2, …) in the saved media.
    const items = rest.items.map((item) => media.push(item));
    return { ...rest, items };
  });
  return { media, layout: { v: 1, blocks: stored }, body: plainText(blocks) };
}

/** The article's words as one Markdown text (search, previews, and posts read without the layout). */
export function plainText(blocks: (EditorBlock | StoredBlock)[]): string {
  return blocks
    .map((b) => (b.type === "heading" ? (b.text.trim() ? `## ${b.text.trim()}` : "") : b.type === "text" ? (b.style === "quote" && b.body.trim() ? `> ${b.body.trim()}` : b.body.trim()) : ""))
    .filter(Boolean)
    .join("\n\n");
}

/** Posts written before blocks existed: the text, then photos together and everything else on its own. */
export function legacyBlocks(body: string, kinds: MediaItem["kind"][]): StoredBlock[] {
  const out: StoredBlock[] = [];
  if (body.trim()) out.push({ type: "text", body, style: "normal" });
  kinds.forEach((kind, index) => {
    const last = out.at(-1);
    if (kind === "image" && last?.type === "media" && last.place === "row" && kinds[last.items[0] - 1] === "image") last.items.push(index + 1);
    else out.push({ type: "media", items: [index + 1], place: kind === "image" && kinds[index + 1] === "image" ? "row" : "full", width: "l" });
  });
  return out;
}

/** The positions a block may show: existing ones, each only once in the whole article. */
function claim(positions: number[], used: Set<number>, count: number) {
  const out: number[] = [];
  for (const n of positions) {
    if (Number.isInteger(n) && n >= 1 && n <= count && !used.has(n)) {
      used.add(n);
      out.push(n);
    }
  }
  return out;
}

/** Stored layout → editor blocks (media items looked up by position). Unplaced media go at the end. */
export function toEditor(layout: StoredLayout | null, body: string, media: MediaItem[]): EditorBlock[] {
  const blocks = layout?.blocks ?? legacyBlocks(body, media.map((m) => m.kind));
  const used = new Set<number>();
  const out = blocks.map((block): EditorBlock => {
    if (block.type !== "media") return { ...block, key: newKey() } as EditorBlock;
    return { ...block, key: newKey(), items: claim(block.items, used, media.length).map((n) => media[n - 1]) };
  });
  media.forEach((item, index) => {
    if (!used.has(index + 1)) out.push({ key: newKey(), type: "media", items: [item], place: "full", width: "l" });
  });
  return out;
}

/** Stored layout → blocks with their media resolved, for the public page. */
export function resolveLayout<M>(layout: StoredLayout | null, body: string, media: (M & { kind: MediaItem["kind"] })[]) {
  type Resolved =
    | Exclude<StoredBlock, { type: "media" }>
    | { type: "media"; items: M[]; place: Placement; width: Width };
  const blocks = layout?.blocks ?? legacyBlocks(body, media.map((m) => m.kind));
  const used = new Set<number>();
  const out: Resolved[] = blocks.map((block) => {
    if (block.type !== "media") return block;
    return { type: "media", place: block.place, width: block.width, items: claim(block.items, used, media.length).map((n) => media[n - 1]) };
  });
  media.forEach((item, index) => {
    if (!used.has(index + 1)) out.push({ type: "media", place: "full", width: "l", items: [item] });
  });
  return out;
}

export function isStoredLayout(value: unknown): value is StoredLayout {
  return typeof value === "object" && value !== null && (value as StoredLayout).v === 1 && Array.isArray((value as StoredLayout).blocks);
}
