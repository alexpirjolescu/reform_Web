import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isStaffRole, type Profile } from "@/lib/types";
import { fileKinds, kindOf, type FileKind, type LibraryFile } from "@/lib/library";

export type FolderSummary = {
  id: string;
  name: string;
  space: "shared" | "school";
  schoolId: string | null;
  schoolName: string;
  count: number;
  canWrite: boolean;
  createdBy: string | null;
};

export type LibraryQuery = {
  folder: string | null;
  kind: FileKind | "all";
  q: string;
  sort: "newest" | "name" | "size";
  trash: boolean;
  file: string | null;
};

export type Preview = LibraryFile & { url: string | null; folderName: string; canEdit: boolean };

export type LibraryData = {
  query: LibraryQuery;
  folders: FolderSummary[];
  groups: { key: string; label: string; folders: FolderSummary[] }[];
  current: FolderSummary | null;
  files: LibraryFile[];
  counts: Record<FileKind | "all", number>;
  preview: Preview | null;
  writable: FolderSummary[];
  trashCount: number;
  isStaff: boolean;
  profileId: string;
  schools: { id: string; name: string }[];
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseLibraryQuery(params: Record<string, string | string[] | undefined>): LibraryQuery {
  const one = (key: string) => {
    const value = params[key];
    return typeof value === "string" ? value : undefined;
  };
  const folder = one("folder");
  const file = one("file");
  const kind = one("type");
  const sort = one("sort");
  return {
    folder: folder && uuid.test(folder) ? folder : null,
    file: file && uuid.test(file) ? file : null,
    kind: (fileKinds as readonly string[]).includes(kind ?? "") ? (kind as FileKind) : "all",
    q: (one("q") ?? "").trim().slice(0, 80),
    sort: sort === "name" || sort === "size" ? sort : "newest",
    trash: one("trash") === "1",
  };
}

const fileColumns =
  "id, folder_id, name, description, mime_type, size_bytes, storage_path, external_url, tags, uploaded_by, created_at, deleted_at, profiles(full_name)";

type RawFile = Omit<LibraryFile, "uploaderName"> & { profiles: { full_name: string } | null };

function toFile({ profiles, ...row }: RawFile): LibraryFile {
  return { ...row, uploaderName: profiles?.full_name ?? null };
}

export async function getLibrary(profile: Profile, query: LibraryQuery, sharedLabel: string): Promise<LibraryData> {
  const supabase = await createClient();
  const isStaff = isStaffRole(profile.role);

  const [{ data: folderRows }, { data: schoolRows }] = await Promise.all([
    supabase
      .from("library_folders")
      .select("id, name, space, school_id, created_by, schools(name), library_files(count)")
      .is("library_files.deleted_at", null)
      .order("name"),
    isStaff ? supabase.from("schools").select("id, name").order("name") : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const folders: FolderSummary[] = (folderRows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    space: row.space as "shared" | "school",
    schoolId: row.school_id,
    schoolName: row.schools?.name ?? sharedLabel,
    count: row.library_files[0]?.count ?? 0,
    canWrite: row.space === "shared" ? isStaff : isStaff || row.school_id === profile.school_id,
    createdBy: row.created_by,
  }));

  // The shared re_form library first, then the student's own school, then other schools (staff only).
  const groups = new Map<string, { key: string; label: string; folders: FolderSummary[] }>();
  const groupKey = (f: FolderSummary) => (f.space === "shared" ? "shared" : f.schoolId ?? "school");
  for (const folder of folders) {
    const key = groupKey(folder);
    if (!groups.has(key)) groups.set(key, { key, label: folder.space === "shared" ? sharedLabel : folder.schoolName, folders: [] });
    groups.get(key)?.folders.push(folder);
  }
  const ordered = [...groups.values()].sort((a, b) => {
    const rank = (g: { key: string }) => (g.key === "shared" ? 0 : g.key === profile.school_id ? 1 : 2);
    return rank(a) - rank(b) || a.label.localeCompare(b.label);
  });

  const current = query.folder ? folders.find((f) => f.id === query.folder) ?? null : null;

  let filesRequest = supabase.from("library_files").select(fileColumns).order("created_at", { ascending: false }).limit(300);
  filesRequest = query.trash ? filesRequest.not("deleted_at", "is", null) : filesRequest.is("deleted_at", null);
  if (current && !query.trash) filesRequest = filesRequest.eq("folder_id", current.id);
  if (!current && !query.trash && !query.q) filesRequest = filesRequest.limit(40);

  const trashRequest = supabase.from("library_files").select("id", { count: "exact", head: true }).not("deleted_at", "is", null);

  const [{ data: fileRows }, { count: trashCount }] = await Promise.all([
    filesRequest.overrideTypes<RawFile[], { merge: false }>(),
    trashRequest,
  ]);

  let scoped = (fileRows ?? []).map(toFile);
  if (query.q) {
    const needle = query.q.toLocaleLowerCase("ro");
    scoped = scoped.filter(
      (f) =>
        f.name.toLocaleLowerCase("ro").includes(needle) ||
        f.description.toLocaleLowerCase("ro").includes(needle) ||
        f.tags.some((tag) => tag.toLocaleLowerCase("ro").includes(needle)),
    );
  }

  const counts = { all: scoped.length } as Record<FileKind | "all", number>;
  for (const kind of fileKinds) counts[kind] = scoped.filter((f) => kindOf(f) === kind).length;

  let files = query.kind === "all" ? scoped : scoped.filter((f) => kindOf(f) === query.kind);
  if (query.sort === "name") files = [...files].sort((a, b) => a.name.localeCompare(b.name, "ro"));
  if (query.sort === "size") files = [...files].sort((a, b) => b.size_bytes - a.size_bytes);

  let preview: Preview | null = null;
  const pickedId = query.file ?? (files.length && !query.trash ? files[0].id : null);
  if (pickedId) {
    let picked = scoped.find((f) => f.id === pickedId) ?? null;
    if (!picked) {
      const { data } = await supabase.from("library_files").select(fileColumns).eq("id", pickedId).overrideTypes<RawFile[], { merge: false }>();
      picked = data?.[0] ? toFile(data[0]) : null;
    }
    if (picked) {
      const kind = kindOf(picked);
      let url: string | null = null;
      if (picked.storage_path && ["video", "audio", "images", "pdf"].includes(kind)) {
        const { data } = await supabase.storage.from("library").createSignedUrl(picked.storage_path, 3600);
        url = data?.signedUrl ?? null;
      }
      const folder = folders.find((f) => f.id === picked.folder_id);
      preview = {
        ...picked,
        url,
        folderName: folder?.name ?? "",
        canEdit: isStaff || picked.uploaded_by === profile.id,
      };
    }
  }

  return {
    query,
    folders,
    groups: ordered,
    current,
    files,
    counts,
    preview,
    writable: folders.filter((f) => f.canWrite),
    trashCount: trashCount ?? 0,
    isStaff,
    profileId: profile.id,
    schools: schoolRows ?? [],
  };
}

/** Builds /app/library links that keep the current folder, filter and search unless overridden. */
export function libraryHref(query: LibraryQuery, patch: Partial<Record<"folder" | "type" | "q" | "sort" | "trash" | "file", string | null>>) {
  const params = new URLSearchParams();
  const merged = {
    folder: query.folder,
    type: query.kind === "all" ? null : query.kind,
    q: query.q || null,
    sort: query.sort === "newest" ? null : query.sort,
    trash: query.trash ? "1" : null,
    file: query.file,
    ...patch,
  };
  for (const [key, value] of Object.entries(merged)) if (value) params.set(key, value);
  const search = params.toString();
  return search ? `/app/library?${search}` : "/app/library";
}
