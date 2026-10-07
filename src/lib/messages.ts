// Client-safe types for messages (PRD module 5): one-to-one chats and groups.
import type { AppRole } from "@/lib/types";

export type Person = { id: string; full_name: string; role: AppRole; schoolName: string | null };

export type MessageKind = "text" | "sticker" | "gif" | "poll" | "system" | "resource";

export type ConversationSummary = {
  id: string;
  kind: "direct" | "group";
  /** The group's name, or the other person's name. */
  title: string;
  /** One-to-one: the other person. Groups: the first other member (for colours). */
  other: Person;
  photoUrl: string | null;
  memberCount: number;
  lastAt: string;
  lastText: string | null;
  lastKind: MessageKind | null;
  /** Groups: who wrote the last message. */
  lastSender: string | null;
  lastMine: boolean;
  unread: number;
  hasMessages: boolean;
  muted: boolean;
};

export type Gif = { id: string; url: string; width: number; height: number; title: string };

export type SystemEvent = {
  event: "created" | "added" | "removed" | "left" | "admin" | "notAdmin" | "title" | "description" | "photo" | "settings";
  targets?: string[];
  title?: string;
  value?: string;
  only_admins_send?: boolean;
  only_admins_edit?: boolean;
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
  kind: MessageKind;
  reply_to: string | null;
  library_file_id: string | null;
  gif: Gif | null;
  sticker: string | null;
  system: SystemEvent | null;
  pinned_at: string | null;
};

/** Columns read for a message, wherever messages are loaded. */
export const messageColumns =
  "id, sender_id, body, attachment_path, attachment_name, created_at, edited_at, deleted_at, kind, reply_to, library_file_id, gif, sticker, system, pinned_at";

export type Reaction = { message_id: string; profile_id: string; emoji: string };

export type Poll = {
  id: string;
  message_id: string;
  question: string;
  multiple: boolean;
  closed_at: string | null;
  created_by: string | null;
  options: { id: string; label: string; position: number }[];
  votes: { option_id: string; profile_id: string }[];
};

export type GroupMember = Person & { groupRole: "admin" | "member" };

export type Resource = { id: string; name: string; mime_type: string; external_url: string | null; size_bytes: number };

export type SelectedConversation = {
  id: string;
  kind: "direct" | "group";
  title: string;
  description: string;
  photoUrl: string | null;
  /** One-to-one: the other person. */
  other: Person;
  members: GroupMember[];
  /** Names of everyone who appears in the chat, including people who have left. */
  people: Record<string, string>;
  myRole: "admin" | "member";
  onlyAdminsSend: boolean;
  onlyAdminsEdit: boolean;
  muted: boolean;
  canPost: boolean;
  canEdit: boolean;
  messages: ChatMessage[];
  reactions: Reaction[];
  polls: Poll[];
  resources: Record<string, Resource>;
  blockedByMe: boolean;
  files: { id: string; name: string; path: string; at: string }[];
  tasks: { id: string; title: string; board_id: string }[];
};

export const messageAttachmentTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
export const maxMessageAttachment = 10 * 1024 * 1024;

/** Quick reactions, as on WhatsApp. */
export const quickReactions = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
