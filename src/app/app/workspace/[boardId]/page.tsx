import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { Board } from "@/components/workspace/board";
import { requireProfile } from "@/lib/auth";
import { getTheme } from "@/lib/theme";
import { getBoard } from "@/lib/workspace-server";

export async function generateMetadata({ params }: PageProps<"/app/workspace/[boardId]">) {
  const { boardId } = await params;
  if (!z.uuid().safeParse(boardId).success) return {};
  const profile = await requireProfile();
  const data = await getBoard(boardId, profile);
  return { title: data?.board.name };
}

export default async function BoardPage({ params }: PageProps<"/app/workspace/[boardId]">) {
  const { boardId } = await params;
  if (!z.uuid().safeParse(boardId).success) notFound();
  const profile = await requireProfile();
  const [data, theme, locale] = await Promise.all([getBoard(boardId, profile), getTheme(profile.theme), getLocale()]);
  if (!data) notFound();

  return <Board initial={data} variant={theme} currentUserId={profile.id} locale={locale} />;
}
