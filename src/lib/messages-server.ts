import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import type { ChatMessage, ConversationSummary, Person, SelectedConversation } from "@/lib/messages";

type RawParticipant = {
  profile_id: string;
  profiles: { id: string; full_name: string; role: Person["role"]; school_id: string | null; schools: { name: string } | null } | null;
};

const toPerson = (p: RawParticipant): Person => ({
  id: p.profile_id,
  full_name: p.profiles?.full_name ?? "—",
  role: p.profiles?.role ?? "student",
  schoolName: p.profiles?.schools?.name ?? null,
});

/** The signed-in person's conversations, newest first, with the other person, last message and unread count. */
export async function getInbox(profile: Profile): Promise<ConversationSummary[]> {
  const supabase = await createClient();
  const [{ data: mine }, { data: unread }] = await Promise.all([
    supabase
      .from("conversation_participants")
      .select(
        "conversation_id, conversations(id, last_message_at, conversation_participants(profile_id, profiles(id, full_name, role, school_id, schools(name))))",
      )
      .eq("profile_id", profile.id),
    supabase.rpc("unread_counts"),
  ]);

  const ids = (mine ?? []).map((row) => row.conversation_id);
  const { data: recent } = ids.length
    ? await supabase
        .from("messages")
        .select("conversation_id, body, attachment_name, sender_id, created_at, deleted_at")
        .in("conversation_id", ids)
        .order("created_at", { ascending: false })
        .limit(Math.min(500, ids.length * 20))
    : { data: [] };

  const last = new Map<string, NonNullable<typeof recent>[number]>();
  for (const message of recent ?? []) if (!last.has(message.conversation_id)) last.set(message.conversation_id, message);
  const unreadBy = new Map((unread ?? []).map((row) => [row.conversation_id, Number(row.unread)]));

  return (mine ?? [])
    .flatMap((row) => {
      const conversation = row.conversations;
      if (!conversation) return [];
      const others = (conversation.conversation_participants as RawParticipant[]).filter((p) => p.profile_id !== profile.id).map(toPerson);
      const lastMessage = last.get(conversation.id);
      return [
        {
          id: conversation.id,
          other: others[0] ?? { id: "", full_name: "—", role: "student" as const, schoolName: null },
          lastAt: lastMessage?.created_at ?? conversation.last_message_at,
          lastText: lastMessage ? (lastMessage.deleted_at ? null : lastMessage.body || lastMessage.attachment_name) : null,
          lastMine: lastMessage?.sender_id === profile.id,
          unread: unreadBy.get(conversation.id) ?? 0,
          hasMessages: Boolean(lastMessage),
        },
      ];
    })
    .sort((a, b) => Date.parse(b.lastAt) - Date.parse(a.lastAt));
}

/** One conversation: messages, the other person, shared files and tasks, block status. */
export async function getConversation(id: string, profile: Profile, inbox: ConversationSummary[]): Promise<SelectedConversation | null> {
  const summary = inbox.find((c) => c.id === id);
  if (!summary) return null;
  const supabase = await createClient();
  const other = summary.other;

  const [{ data: messages }, { data: block }, { data: myCards }, { data: theirCards }] = await Promise.all([
    supabase
      .from("messages")
      .select("id, sender_id, body, attachment_path, attachment_name, created_at, edited_at, deleted_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("user_blocks").select("blocked_id").eq("blocker_id", profile.id).eq("blocked_id", other.id).maybeSingle(),
    supabase.from("card_assignees").select("card_id").eq("profile_id", profile.id),
    other.id ? supabase.from("card_assignees").select("card_id").eq("profile_id", other.id) : Promise.resolve({ data: [] as { card_id: string }[] }),
  ]);

  const shared = new Set((myCards ?? []).map((c) => c.card_id));
  const sharedIds = (theirCards ?? []).map((c) => c.card_id).filter((cardId) => shared.has(cardId)).slice(0, 8);
  const { data: tasks } = sharedIds.length
    ? await supabase.from("cards").select("id, title, board_id").in("id", sharedIds)
    : { data: [] as { id: string; title: string; board_id: string }[] };

  const list: ChatMessage[] = [...(messages ?? [])].reverse();
  return {
    id,
    other,
    messages: list,
    blockedByMe: Boolean(block),
    files: list.filter((m) => m.attachment_path && !m.deleted_at).map((m) => ({ id: m.id, name: m.attachment_name ?? "", path: m.attachment_path as string, at: m.created_at })).reverse(),
    tasks: tasks ?? [],
  };
}
