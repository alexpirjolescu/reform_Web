import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import {
  messageColumns,
  type ChatMessage,
  type ConversationSummary,
  type GroupMember,
  type MessageKind,
  type Person,
  type Poll,
  type Reaction,
  type Resource,
  type SelectedConversation,
} from "@/lib/messages";

type RawParticipant = {
  profile_id: string;
  role?: "admin" | "member";
  muted?: boolean;
  profiles: { id: string; full_name: string; role: Person["role"]; school_id: string | null; schools: { name: string } | null } | null;
};

const toPerson = (p: RawParticipant): Person => ({
  id: p.profile_id,
  full_name: p.profiles?.full_name ?? "—",
  role: p.profiles?.role ?? "student",
  schoolName: p.profiles?.schools?.name ?? null,
});

const nobody: Person = { id: "", full_name: "—", role: "student", schoolName: null };

/** Short-lived links to group photos (private "messages" bucket). */
async function signPhotos(supabase: Awaited<ReturnType<typeof createClient>>, paths: string[]) {
  if (!paths.length) return new Map<string, string>();
  const { data } = await supabase.storage.from("messages").createSignedUrls(paths, 3600);
  return new Map((data ?? []).flatMap((row) => (row.path && row.signedUrl ? [[row.path, row.signedUrl] as const] : [])));
}

/** The signed-in person's chats and groups, newest first, with the last message and unread count. */
export async function getInbox(profile: Profile): Promise<ConversationSummary[]> {
  const supabase = await createClient();
  const [{ data: mine }, { data: unread }] = await Promise.all([
    supabase
      .from("conversation_participants")
      .select(
        "conversation_id, muted, conversations(id, kind, title, photo_path, last_message_at, conversation_participants(profile_id, profiles(id, full_name, role, school_id, schools(name))))",
      )
      .eq("profile_id", profile.id),
    supabase.rpc("unread_counts"),
  ]);

  const ids = (mine ?? []).map((row) => row.conversation_id);
  const { data: recent } = ids.length
    ? await supabase
        .from("messages")
        .select("conversation_id, body, attachment_name, sender_id, created_at, deleted_at, kind")
        .in("conversation_id", ids)
        .order("created_at", { ascending: false })
        .limit(Math.min(800, ids.length * 20))
    : { data: [] };

  const last = new Map<string, NonNullable<typeof recent>[number]>();
  for (const message of recent ?? []) if (!last.has(message.conversation_id)) last.set(message.conversation_id, message);
  const unreadBy = new Map((unread ?? []).map((row) => [row.conversation_id, Number(row.unread)]));
  const photos = await signPhotos(supabase, (mine ?? []).flatMap((row) => (row.conversations?.photo_path ? [row.conversations.photo_path] : [])));

  return (mine ?? [])
    .flatMap((row) => {
      const conversation = row.conversations;
      if (!conversation) return [];
      const participants = conversation.conversation_participants as RawParticipant[];
      const others = participants.filter((p) => p.profile_id !== profile.id).map(toPerson);
      const lastMessage = last.get(conversation.id);
      const group = conversation.kind === "group";
      const sender = lastMessage ? participants.find((p) => p.profile_id === lastMessage.sender_id) : undefined;
      return [
        {
          id: conversation.id,
          kind: group ? ("group" as const) : ("direct" as const),
          title: group ? conversation.title ?? "—" : others[0]?.full_name ?? "—",
          other: others[0] ?? nobody,
          photoUrl: conversation.photo_path ? photos.get(conversation.photo_path) ?? null : null,
          memberCount: participants.length,
          lastAt: lastMessage?.created_at ?? conversation.last_message_at,
          lastText: lastMessage ? (lastMessage.deleted_at ? null : lastMessage.body || lastMessage.attachment_name) : null,
          lastKind: (lastMessage?.kind as MessageKind | undefined) ?? null,
          lastSender: group && sender ? sender.profiles?.full_name.split(" ")[0] ?? null : null,
          lastMine: lastMessage?.sender_id === profile.id,
          unread: unreadBy.get(conversation.id) ?? 0,
          hasMessages: Boolean(lastMessage),
          muted: row.muted,
        },
      ];
    })
    .sort((a, b) => Date.parse(b.lastAt) - Date.parse(a.lastAt));
}

/** One chat or group: messages, members, reactions, polls, files from the library, block status. */
export async function getConversation(id: string, profile: Profile, inbox: ConversationSummary[]): Promise<SelectedConversation | null> {
  const summary = inbox.find((c) => c.id === id);
  if (!summary) return null;
  const supabase = await createClient();
  const other = summary.other;
  const group = summary.kind === "group";

  const [{ data: conversation }, { data: messages }, { data: block }, { data: polls }, { data: canPost }, { data: canEdit }] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, title, description, photo_path, only_admins_send, only_admins_edit, conversation_participants(profile_id, role, muted, profiles(id, full_name, role, school_id, schools(name)))")
      .eq("id", id)
      .single(),
    supabase.from("messages").select(messageColumns).eq("conversation_id", id).order("created_at", { ascending: false }).limit(300),
    group || !other.id
      ? Promise.resolve({ data: null })
      : supabase.from("user_blocks").select("blocked_id").eq("blocker_id", profile.id).eq("blocked_id", other.id).maybeSingle(),
    supabase.from("polls").select("id, message_id, question, multiple, closed_at, created_by, poll_options(id, label, position), poll_votes(option_id, profile_id)").eq("conversation_id", id),
    supabase.rpc("can_post", { target_conversation: id }),
    group ? supabase.rpc("can_edit_group", { target: id }) : Promise.resolve({ data: false }),
  ]);
  if (!conversation) return null;

  const list = [...((messages ?? []) as unknown as ChatMessage[])].reverse();
  const messageIds = list.map((m) => m.id);
  const fileIds = [...new Set(list.flatMap((m) => (m.library_file_id ? [m.library_file_id] : [])))];

  const [{ data: reactions }, { data: resources }, { data: myCards }, { data: theirCards }] = await Promise.all([
    messageIds.length ? supabase.from("message_reactions").select("message_id, profile_id, emoji").in("message_id", messageIds) : Promise.resolve({ data: [] as Reaction[] }),
    fileIds.length ? supabase.from("library_files").select("id, name, mime_type, external_url, size_bytes").in("id", fileIds) : Promise.resolve({ data: [] as Resource[] }),
    group ? Promise.resolve({ data: [] as { card_id: string }[] }) : supabase.from("card_assignees").select("card_id").eq("profile_id", profile.id),
    group || !other.id ? Promise.resolve({ data: [] as { card_id: string }[] }) : supabase.from("card_assignees").select("card_id").eq("profile_id", other.id),
  ]);

  const shared = new Set((myCards ?? []).map((c) => c.card_id));
  const sharedIds = (theirCards ?? []).map((c) => c.card_id).filter((cardId) => shared.has(cardId)).slice(0, 8);
  const { data: tasks } = sharedIds.length
    ? await supabase.from("cards").select("id, title, board_id").in("id", sharedIds)
    : { data: [] as { id: string; title: string; board_id: string }[] };

  const participants = conversation.conversation_participants as RawParticipant[];
  const members: GroupMember[] = participants
    .map((p) => ({ ...toPerson(p), groupRole: p.role ?? "member" }))
    .sort((a, b) => (a.groupRole === b.groupRole ? a.full_name.localeCompare(b.full_name, "ro") : a.groupRole === "admin" ? -1 : 1));
  const me = participants.find((p) => p.profile_id === profile.id);
  // People who wrote or were named in notes but are no longer in the group still need a name.
  const known = new Set(members.map((m) => m.id));
  const missing = [...new Set(list.flatMap((m) => [m.sender_id, ...(m.system?.targets ?? [])]))].filter((pid) => pid && !known.has(pid));
  const [photos, { data: former }] = await Promise.all([
    signPhotos(supabase, conversation.photo_path ? [conversation.photo_path] : []),
    missing.length ? supabase.from("profiles").select("id, full_name").in("id", missing) : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);

  return {
    id,
    kind: summary.kind,
    title: summary.title,
    description: conversation.description,
    photoUrl: conversation.photo_path ? photos.get(conversation.photo_path) ?? null : null,
    other,
    members,
    people: Object.fromEntries([...(former ?? []).map((p) => [p.id, p.full_name]), ...members.map((m) => [m.id, m.full_name])]),
    myRole: me?.role ?? "member",
    onlyAdminsSend: conversation.only_admins_send,
    onlyAdminsEdit: conversation.only_admins_edit,
    muted: me?.muted ?? false,
    canPost: Boolean(canPost),
    canEdit: Boolean(canEdit),
    messages: list,
    reactions: (reactions ?? []) as Reaction[],
    polls: (polls ?? []).map(
      (p): Poll => ({
        id: p.id,
        message_id: p.message_id,
        question: p.question,
        multiple: p.multiple,
        closed_at: p.closed_at,
        created_by: p.created_by,
        options: [...p.poll_options].sort((a, b) => a.position - b.position),
        votes: p.poll_votes,
      }),
    ),
    resources: Object.fromEntries((resources ?? []).map((r) => [r.id, r as Resource])),
    blockedByMe: Boolean(block),
    files: list.filter((m) => m.attachment_path && !m.deleted_at).map((m) => ({ id: m.id, name: m.attachment_name ?? "", path: m.attachment_path as string, at: m.created_at })).reverse(),
    tasks: tasks ?? [],
  };
}
