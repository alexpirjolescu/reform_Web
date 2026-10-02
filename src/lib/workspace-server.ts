import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isStaffRole, type Profile } from "@/lib/types";
import { cardSelect, toBoardCard, type BoardData, type RawCard } from "@/lib/workspace";

export async function listBoards(profile: Profile) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("boards")
    .select("id, name, description, due_date, school_id, schools(name), board_columns(id, is_done), cards(id, column_id)")
    .is("archived_at", null)
    .order("created_at");
  return (data ?? []).map((board) => {
    const doneColumns = new Set(board.board_columns.filter((c) => c.is_done).map((c) => c.id));
    return {
      id: board.id,
      name: board.name,
      description: board.description,
      dueDate: board.due_date,
      schoolId: board.school_id,
      schoolName: board.schools?.name ?? "",
      cardCount: board.cards.length,
      doneCount: board.cards.filter((card) => doneColumns.has(card.column_id)).length,
      mine: board.school_id === profile.school_id,
    };
  });
}

export const getBoard = cache(async (boardId: string, profile: Profile): Promise<BoardData | null> => {
  const supabase = await createClient();
  const { data: board } = await supabase
    .from("boards")
    .select("id, name, description, due_date, school_id, schools(name)")
    .eq("id", boardId)
    .maybeSingle();
  if (!board) return null;

  const [{ data: columns }, { data: cards }, { data: members }] = await Promise.all([
    supabase.from("board_columns").select("id, name, position, is_done").eq("board_id", boardId).order("position"),
    supabase.from("cards").select(cardSelect).eq("board_id", boardId).order("position").overrideTypes<RawCard[], { merge: false }>(),
    supabase
      .from("profiles")
      .select("id, full_name, role")
      .is("deactivated_at", null)
      .or(`school_id.eq.${board.school_id},role.in.(staff,admin)`)
      .order("full_name"),
  ]);

  return {
    board: {
      id: board.id,
      name: board.name,
      description: board.description,
      due_date: board.due_date,
      school_id: board.school_id,
      schoolName: board.schools?.name ?? "",
    },
    columns: columns ?? [],
    cards: (cards ?? []).map(toBoardCard),
    members: members ?? [],
    canManage: isStaffRole(profile.role) || (profile.role === "core_lead" && profile.school_id === board.school_id),
  };
});
