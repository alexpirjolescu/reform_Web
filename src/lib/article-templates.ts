// Five starting points for a news article. Every template uses each kind of widget at least once
// somewhere (text, headings, photos, video, social posts, quotes, boxes, buttons); empty blocks carry
// a hint that tells staff what to put there, and empty blocks are never shown to readers.

import { newKey, type EditorBlock } from "./article";

export const templateIds = ["recap", "announcement", "digest", "spotlight", "gallery"] as const;
export type TemplateId = (typeof templateIds)[number];

type Draft =
  | { type: "heading"; text?: string; hint?: number }
  | { type: "text"; style?: "normal" | "lead" | "quote" | "note"; hint: number }
  | { type: "media"; place: "full" | "left" | "right" | "row"; width?: "s" | "m" | "l"; hint: number }
  | { type: "divider" }
  | { type: "button"; hint: number };

// Hint numbers point at adminNews.tpl.<template>.h<n>; heading texts at adminNews.tpl.<template>.t<n>.
const drafts: Record<TemplateId, Draft[]> = {
  recap: [
    { type: "text", style: "lead", hint: 1 },
    { type: "media", place: "full", width: "l", hint: 2 },
    { type: "text", hint: 3 },
    { type: "media", place: "right", width: "m", hint: 4 },
    { type: "text", hint: 5 },
    { type: "text", style: "quote", hint: 6 },
    { type: "media", place: "row", hint: 7 },
    { type: "media", place: "full", width: "l", hint: 8 },
    { type: "button", hint: 9 },
  ],
  announcement: [
    { type: "media", place: "full", width: "l", hint: 1 },
    { type: "text", style: "lead", hint: 2 },
    { type: "heading", text: "t1" },
    { type: "text", hint: 3 },
    { type: "media", place: "left", width: "m", hint: 4 },
    { type: "text", hint: 5 },
    { type: "text", style: "note", hint: 6 },
    { type: "button", hint: 7 },
  ],
  digest: [
    { type: "text", style: "lead", hint: 1 },
    { type: "text", style: "note", hint: 2 },
    { type: "heading", text: "t1" },
    { type: "media", place: "left", width: "s", hint: 3 },
    { type: "text", hint: 4 },
    { type: "media", place: "right", width: "s", hint: 5 },
    { type: "text", hint: 6 },
    { type: "divider" },
    { type: "heading", text: "t2" },
    { type: "media", place: "row", hint: 7 },
    { type: "text", hint: 8 },
    { type: "button", hint: 9 },
  ],
  spotlight: [
    { type: "media", place: "left", width: "m", hint: 1 },
    { type: "text", style: "lead", hint: 2 },
    { type: "text", hint: 3 },
    { type: "text", style: "quote", hint: 4 },
    { type: "heading", text: "t1" },
    { type: "text", hint: 5 },
    { type: "media", place: "full", width: "m", hint: 6 },
    { type: "media", place: "row", hint: 7 },
    { type: "button", hint: 8 },
  ],
  gallery: [
    { type: "text", style: "lead", hint: 1 },
    { type: "media", place: "full", width: "l", hint: 2 },
    { type: "media", place: "row", hint: 3 },
    { type: "text", hint: 4 },
    { type: "media", place: "row", hint: 5 },
    { type: "media", place: "full", width: "l", hint: 6 },
    { type: "text", style: "note", hint: 7 },
    { type: "button", hint: 8 },
  ],
};

/** The template's blocks, with hints (and suggested headings) in the editor's language. */
export function templateBlocks(id: TemplateId, t: (key: string) => string): EditorBlock[] {
  const text = (n: number) => t(`adminNews.tpl.${id}.h${n}`);
  return drafts[id].map((draft): EditorBlock => {
    const key = newKey();
    switch (draft.type) {
      case "heading":
        return { key, type: "heading", text: draft.text ? t(`adminNews.tpl.${id}.${draft.text}`) : "", hint: draft.hint ? text(draft.hint) : undefined };
      case "text":
        return { key, type: "text", body: "", style: draft.style ?? "normal", hint: text(draft.hint) };
      case "media":
        return { key, type: "media", items: [], place: draft.place, width: draft.width ?? (draft.place === "left" || draft.place === "right" ? "m" : "l"), hint: text(draft.hint) };
      case "divider":
        return { key, type: "divider" };
      case "button":
        return { key, type: "button", label: "", url: "", hint: text(draft.hint) };
    }
  });
}

/** Shapes for the small sketch of each template in the picker. */
export function templateSketch(id: TemplateId) {
  return drafts[id].map((d) => ({ type: d.type, style: d.type === "text" ? d.style ?? "normal" : undefined, place: d.type === "media" ? d.place : undefined, width: d.type === "media" ? d.width : undefined }));
}
