// Uploading into the resource library from the browser: the upload button, files dropped on a
// folder, and files dropped on the open folder all use this. Client-side only.

import type { SupabaseClient } from "@supabase/supabase-js";
import { acceptedTypes, maxUploadBytes, storageSafeName } from "./library";

type Translate = (key: string, values?: Record<string, string | number>) => string;

/**
 * Stores each file in the private "library" bucket, then records it. A file that fails doesn't stop
 * the rest. When a personal space is full the database refuses the record; the stored copy is removed.
 */
export async function uploadToLibrary(
  supabase: SupabaseClient,
  folderId: string,
  files: File[],
  profileId: string,
  t: Translate,
  onProgress?: (current: number, total: number) => void,
): Promise<{ saved: number; problems: string[] }> {
  const problems: string[] = [];
  let saved = 0;
  for (const [index, file] of files.entries()) {
    onProgress?.(index + 1, files.length);
    if (file.size > maxUploadBytes) {
      problems.push(t("tooLarge", { name: file.name }));
      continue;
    }
    if (!acceptedTypes.includes(file.type)) {
      problems.push(t("badType", { name: file.name }));
      continue;
    }
    const path = `${folderId}/${crypto.randomUUID()}-${storageSafeName(file.name)}`;
    const stored = await supabase.storage.from("library").upload(path, file, { contentType: file.type });
    if (stored.error) {
      problems.push(/row-level security/i.test(stored.error.message) ? t("quotaFull", { name: file.name }) : `${file.name}: ${stored.error.message}`);
      continue;
    }
    const row = await supabase.from("library_files").insert({
      folder_id: folderId,
      name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      storage_path: path,
      uploaded_by: profileId,
    });
    if (row.error) {
      await supabase.storage.from("library").remove([path]);
      problems.push(row.error.hint === "quota" || /personal storage is full/.test(row.error.message) ? t("quotaFull", { name: file.name }) : `${file.name}: ${row.error.message}`);
    } else saved += 1;
  }
  return { saved, problems };
}
