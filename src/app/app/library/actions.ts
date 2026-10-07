"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/form";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isStaffRole } from "@/lib/types";

const tagList = z
  .string()
  .default("")
  .transform((v) =>
    [...new Set(v.split(",").map((tag) => tag.trim().toLocaleLowerCase("ro")).filter(Boolean))].slice(0, 10).map((tag) => tag.slice(0, 30)),
  );

const folderSchema = z.object({
  name: z.string().trim().min(1).max(80),
  target: z.string().default(""),
  parent: z.union([z.literal(""), z.uuid()]).default(""),
});

/**
 * New folder: inside the open folder (it takes that folder's space), or at the top of a space:
 * one's personal space, the school's space, or (staff) the shared library or any school.
 */
export async function createFolder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireProfile();
  const parsed = folderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "library.errors.invalidFolder" };
  const supabase = await createClient();

  if (parsed.data.parent) {
    // The database copies the parent's space; RLS checks the person may write there.
    const { data: parent } = await supabase.from("library_folders").select("space, school_id, owner_id").eq("id", parsed.data.parent).maybeSingle();
    if (!parent) return { error: "library.errors.pickSpace" };
    const { error } = await supabase.from("library_folders").insert({
      name: parsed.data.name,
      parent_id: parsed.data.parent,
      space: parent.space,
      school_id: parent.school_id,
      owner_id: parent.owner_id,
      created_by: profile.id,
    });
    if (error) return { error: "library.errors.saveFailed" };
    revalidatePath("/app/library");
    return { message: "library.folderCreated", done: Date.now() };
  }

  let row: { space: "shared" | "school" | "personal"; school_id: string | null; owner_id: string | null };
  if (parsed.data.target === "personal") row = { space: "personal", school_id: null, owner_id: profile.id };
  else if (isStaffRole(profile.role)) {
    if (parsed.data.target === "shared") row = { space: "shared", school_id: null, owner_id: null };
    else {
      const school = z.uuid().safeParse(parsed.data.target);
      if (!school.success) return { error: "library.errors.pickSpace" };
      row = { space: "school", school_id: school.data, owner_id: null };
    }
  } else {
    if (!profile.school_id) return { error: "library.errors.pickSpace" };
    row = { space: "school", school_id: profile.school_id, owner_id: null };
  }

  const { error } = await supabase.from("library_folders").insert({ name: parsed.data.name, ...row, created_by: profile.id });
  if (error) return { error: "library.errors.saveFailed" };

  revalidatePath("/app/library");
  return { message: "library.folderCreated", done: Date.now() };
}

const moveSchema = z.object({
  kind: z.enum(["file", "folder"]),
  id: z.uuid(),
  to: z.union([z.literal("root"), z.uuid()]),
});

/**
 * Drag and drop (or "move to…"): a file into another folder, or a folder into another folder (or to
 * the top of its space). Personal folders can move into the shared or school spaces with their content.
 */
export async function moveItem(input: { kind: "file" | "folder"; id: string; to: string }): Promise<{ error?: string }> {
  await requireProfile();
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { error: "library.errors.moveFailed" };
  const supabase = await createClient();
  const { kind, id, to } = parsed.data;

  if (kind === "file") {
    if (to === "root") return { error: "library.errors.moveFailed" };
    const { data, error } = await supabase.from("library_files").update({ folder_id: to }).eq("id", id).select("id");
    if (error?.hint === "quota" || error?.message.includes("personal storage is full")) return { error: "library.errors.quota" };
    if (error || !data?.length) return { error: "library.errors.moveFailed" };
  } else {
    if (to === id) return { error: "library.errors.moveFailed" };
    const { error } = await supabase.rpc("move_library_folder", { target: id, new_parent: (to === "root" ? null : to) as string });
    if (error?.message.includes("inside itself")) return { error: "library.errors.moveInside" };
    if (error?.message.includes("only personal folders")) return { error: "library.errors.moveSpace" };
    if (error) return { error: "library.errors.moveFailed" };
  }
  revalidatePath("/app/library");
  return {};
}

/** The same as moveItem, from the "move to…" form in the preview and folder tools. */
export async function moveItemForm(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await moveItem({ kind: String(formData.get("kind")) as "file" | "folder", id: String(formData.get("id")), to: String(formData.get("to")) });
  return result.error ? { error: result.error } : { message: "library.moved", done: Date.now() };
}

const shareSchema = z.object({
  kind: z.enum(["file", "folder"]),
  id: z.uuid(),
  people: z.array(z.uuid()).min(1).max(50),
});

/** Shares a file or folder of one's personal space with people (read-only for them). */
export async function shareItem(input: { kind: "file" | "folder"; id: string; people: string[] }): Promise<{ error?: string }> {
  await requireProfile();
  const parsed = shareSchema.safeParse(input);
  if (!parsed.success) return { error: "library.errors.shareFailed" };
  const supabase = await createClient();
  const rows = parsed.data.people.map((profile_id) => (parsed.data.kind === "file" ? { file_id: parsed.data.id, profile_id } : { folder_id: parsed.data.id, profile_id }));
  const { error } = await supabase.from("library_shares").upsert(rows, { onConflict: parsed.data.kind === "file" ? "file_id,profile_id" : "folder_id,profile_id", ignoreDuplicates: true });
  if (error) return { error: "library.errors.shareFailed" };
  revalidatePath("/app/library");
  return {};
}

export async function unshareItem(formData: FormData) {
  await requireProfile();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from("library_shares").delete().eq("id", id.data);
  revalidatePath("/app/library");
}

const linkSchema = z.object({
  folderId: z.uuid(),
  name: z.string().trim().min(1).max(200),
  url: z.url({ protocol: /^https$/ }).max(2000),
  description: z.string().trim().max(2000).default(""),
  tags: tagList,
});

/** A link instead of an upload, for long recordings kept on YouTube or Drive (storage caps files at 50 MB). */
export async function addLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireProfile();
  const parsed = linkSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "library.errors.invalidLink" };

  const supabase = await createClient();
  const { error } = await supabase.from("library_files").insert({
    folder_id: parsed.data.folderId,
    name: parsed.data.name,
    external_url: parsed.data.url,
    description: parsed.data.description,
    tags: parsed.data.tags,
    mime_type: "text/uri-list",
    uploaded_by: profile.id,
  });
  if (error) return { error: "library.errors.saveFailed" };

  revalidatePath("/app/library");
  return { message: "library.linkAdded", done: Date.now() };
}

const fileSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).default(""),
  tags: tagList,
});

export async function updateFile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile();
  const parsed = fileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "library.errors.invalidFile" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("library_files")
    .update({ name: parsed.data.name, description: parsed.data.description, tags: parsed.data.tags })
    .eq("id", parsed.data.id)
    .select("id");
  if (error || !data?.length) return { error: "library.errors.saveFailed" };

  revalidatePath("/app/library");
  return { message: "library.saved", done: Date.now() };
}

const idSchema = z.uuid();

/** Soft delete (LIB-6): the file waits 30 days in the trash. */
export async function trashFile(formData: FormData) {
  await requireProfile();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from("library_files").update({ deleted_at: new Date().toISOString() }).eq("id", id.data);
  revalidatePath("/app/library");
}

export async function restoreFile(formData: FormData) {
  await requireProfile();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from("library_files").update({ deleted_at: null }).eq("id", id.data);
  revalidatePath("/app/library");
}

/** Staff, or the owner of a personal file (RLS decides): removes the stored object and the row for good. */
export async function deleteFileForever(formData: FormData) {
  await requireProfile();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  const { data: file } = await supabase.from("library_files").select("storage_path").eq("id", id.data).maybeSingle();
  const { data: deleted } = await supabase.from("library_files").delete().eq("id", id.data).select("id");
  if (deleted?.length && file?.storage_path) await supabase.storage.from("library").remove([file.storage_path]);
  revalidatePath("/app/library");
}

/** Staff, or the owner of a personal folder, delete an empty folder (no files, trash included, and no folders inside). */
export async function deleteFolder(formData: FormData) {
  await requireProfile();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  const [{ count }, { count: children }] = await Promise.all([
    supabase.from("library_files").select("id", { count: "exact", head: true }).eq("folder_id", id.data),
    supabase.from("library_folders").select("id", { count: "exact", head: true }).eq("parent_id", id.data),
  ]);
  if (count || children) return;
  await supabase.from("library_folders").delete().eq("id", id.data);
  revalidatePath("/app/library");
}
