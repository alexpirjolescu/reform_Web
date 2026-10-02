import type { LabelColor } from "@/lib/types";

export type BoardColumn = { id: string; name: string; position: number; is_done: boolean };

export type BoardCard = {
  id: string;
  column_id: string;
  title: string;
  due_date: string | null;
  position: number;
  labels: { id: string; name: string; color: LabelColor }[];
  assignees: string[];
  checklistDone: number;
  checklistTotal: number;
  comments: number;
  attachments: number;
};

export type Member = { id: string; full_name: string; role: string };

export type BoardData = {
  board: { id: string; name: string; description: string; due_date: string | null; school_id: string; schoolName: string };
  columns: BoardColumn[];
  cards: BoardCard[];
  members: Member[];
  canManage: boolean;
};

export const labelHex: Record<LabelColor, { bg: string; fg: string }> = {
  teal: { bg: "#77bfb2", fg: "#221f20" },
  honey: { bg: "#e1b345", fg: "#221f20" },
  lavender: { bg: "#79569a", fg: "#ffffff" },
  vermilion: { bg: "#dd6937", fg: "#221f20" },
  lime: { bg: "#abca54", fg: "#221f20" },
  pink: { bg: "#e28ba3", fg: "#221f20" },
};

// The same select is used on the server (first render) and in the browser (live refresh).
export const cardSelect =
  "id, column_id, title, due_date, position, card_labels(id, name, color), card_assignees(profile_id), checklist_items(done), card_comments(count), card_attachments(count)";

type RawCard = {
  id: string;
  column_id: string;
  title: string;
  due_date: string | null;
  position: number;
  card_labels: { id: string; name: string; color: string }[];
  card_assignees: { profile_id: string }[];
  checklist_items: { done: boolean }[];
  card_comments: { count: number }[];
  card_attachments: { count: number }[];
};

export function toBoardCard(raw: RawCard): BoardCard {
  return {
    id: raw.id,
    column_id: raw.column_id,
    title: raw.title,
    due_date: raw.due_date,
    position: raw.position,
    labels: raw.card_labels.map((label) => ({ ...label, color: label.color as LabelColor })),
    assignees: raw.card_assignees.map((a) => a.profile_id),
    checklistDone: raw.checklist_items.filter((item) => item.done).length,
    checklistTotal: raw.checklist_items.length,
    comments: raw.card_comments[0]?.count ?? 0,
    attachments: raw.card_attachments[0]?.count ?? 0,
  };
}

export type { RawCard };

/** Fractional ordering: a position between two neighbours, so a move updates one row only. */
export function positionBetween(before?: number, after?: number) {
  if (before === undefined && after === undefined) return 1;
  if (before === undefined) return (after as number) - 1;
  if (after === undefined) return before + 1;
  return (before + after) / 2;
}
