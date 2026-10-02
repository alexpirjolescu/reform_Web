// Client-safe types for direct messages (PRD module 5).
import type { AppRole } from "@/lib/types";

export type Person = { id: string; full_name: string; role: AppRole; schoolName: string | null };

export type ConversationSummary = {
  id: string;
  other: Person;
  lastAt: string;
  lastText: string | null;
  lastMine: boolean;
  unread: number;
  hasMessages: boolean;
};

export type ChatMessage = {
  id: string;
  sender_id: string;
  body: string;
  attachment_path: string | null;
  attachment_name: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
};

export type SelectedConversation = {
  id: string;
  other: Person;
  messages: ChatMessage[];
  blockedByMe: boolean;
  files: { id: string; name: string; path: string; at: string }[];
  tasks: { id: string; title: string; board_id: string }[];
};

export const messageAttachmentTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
export const maxMessageAttachment = 10 * 1024 * 1024;
