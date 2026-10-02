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
});

/** New folder. Students create folders in their school's space; staff choose the shared library or a school. */
export async function createFolder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireProfile();
  const parsed = folderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "library.errors.invalidFolder" };

  let space: "shared" | "school" = "school";
  let schoolId = profile.school_id;
  if (isStaffRole(profile.role)) {
    if (parsed.data.target === "shared") {
      space = "shared";
      schoolId = null;
    } else {
      const school = z.uuid().safeParse(parsed.data.target);
      if (!school.success) return { error: "library.errors.pickSpace" };
      schoolId = school.data;
    }
  }
  if (space === "school" && !schoolId) return { error: "library.errors.pickSpace" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("library_folders")
    .insert({ name: parsed.data.name, space, school_id: schoolId, created_by: profile.id });
  if (error) return { error: "library.errors.saveFailed" };

  revalidatePath("/app/library");
  return { message: "library.folderCreated", done: Date.now() };
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

/** Staff only (RLS): removes the stored object and the row for good. */
export async function deleteFileForever(formData: FormData) {
  const profile = await requireProfile();
  if (!isStaffRole(profile.role)) return;
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  const { data: file } = await supabase.from("library_files").select("storage_path").eq("id", id.data).maybeSingle();
  if (file?.storage_path) await supabase.storage.from("library").remove([file.storage_path]);
  await supabase.from("library_files").delete().eq("id", id.data);
  revalidatePath("/app/library");
}

/** Staff can delete an empty folder (files, including the trash, must be moved or deleted first). */
export async function deleteFolder(formData: FormData) {
  const profile = await requireProfile();
  if (!isStaffRole(profile.role)) return;
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  const { count } = await supabase.from("library_files").select("id", { count: "exact", head: true }).eq("folder_id", id.data);
  if (count) return;
  await supabase.from("library_folders").delete().eq("id", id.data);
  revalidatePath("/app/library");
}
