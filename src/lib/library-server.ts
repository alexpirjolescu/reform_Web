import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isStaffRole, type Profile } from "@/lib/types";
import { fileKinds, kindOf, type FileKind, type LibraryFile } from "@/lib/library";

export type Space = "shared" | "school" | "personal";

export type FolderSummary = {
  id: string;
  name: string;
  space: Space;
  schoolId: string | null;
  schoolName: string;
  ownerId: string | null;
  parentId: string | null;
  count: number;
  canWrite: boolean;
  /** Rename, move, delete when empty: staff, whoever made it, or the owner of a personal folder. */
  canManage: boolean;
  createdBy: string | null;
  /** A folder of the person's own personal space. */
  mine: boolean;
  /** Someone else's personal folder, shared with this person (read-only). */
  sharedWithMe: boolean;
};

export type Share = { id: string; profileId: string; name: string };

export type LibraryQuery = {
  folder: string | null;
  kind: FileKind | "all";
  q: string;
  sort: "newest" | "name" | "size";
  trash: boolean;
  /** Files other people shared with this person. */
  shared: boolean;
  file: string | null;
};

export type Preview = LibraryFile & {
  url: string | null;
  folderName: string;
  canEdit: boolean;
  /** A file of one's own personal space: it can be shared and deleted for good. */
  canShare: boolean;
  shares: Share[];
};

export type LibraryData = {
  query: LibraryQuery;
  folders: FolderSummary[];
  groups: { key: string; label: string; folders: FolderSummary[]; tree: { folder: FolderSummary; depth: number }[] }[];
  current: FolderSummary | null;
  /** From the top of the space down to the open folder. */
  path: FolderSummary[];
  subfolders: FolderSummary[];
  currentShares: Share[];
  usage: { used: number; quota: number };
  sharedFileCount: number;
  /** Where a file or folder can be moved, with full paths. */
  moveTargets: { id: string; label: string; space: Space }[];
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
    shared: one("shared") === "1",
  };
}

const fileColumns =
  "id, folder_id, name, description, mime_type, size_bytes, storage_path, external_url, tags, uploaded_by, created_at, deleted_at, profiles(full_name)";

type RawFile = Omit<LibraryFile, "uploaderName"> & { profiles: { full_name: string } | null };

function toFile({ profiles, ...row }: RawFile): LibraryFile {
  return { ...row, uploaderName: profiles?.full_name ?? null };
}

export type LibraryLabels = { shared: string; mine: string; sharedWithMe: string };

export async function getLibrary(profile: Profile, query: LibraryQuery, labels: LibraryLabels): Promise<LibraryData> {
  const supabase = await createClient();
  const isStaff = isStaffRole(profile.role);

  const [{ data: folderRows }, { data: schoolRows }, { data: storage }, { data: shareRows }] = await Promise.all([
    supabase
      .from("library_folders")
      .select("id, name, space, school_id, owner_id, parent_id, created_by, schools(name), library_files(count)")
      .is("library_files.deleted_at", null)
      .order("name"),
    isStaff ? supabase.from("schools").select("id, name").order("name") : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    supabase.rpc("my_personal_storage"),
    supabase.from("library_shares").select("id, folder_id, file_id, profile_id, shared_by, profiles!library_shares_profile_id_fkey(full_name)"),
  ]);

  const folders: FolderSummary[] = (folderRows ?? []).map((row) => {
    const mine = row.space === "personal" && row.owner_id === profile.id;
    return {
      id: row.id,
      name: row.name,
      space: row.space as Space,
      schoolId: row.school_id,
      schoolName: row.schools?.name ?? (row.space === "personal" ? (mine ? labels.mine : labels.sharedWithMe) : labels.shared),
      ownerId: row.owner_id,
      parentId: row.parent_id,
      count: row.library_files[0]?.count ?? 0,
      canWrite: row.space === "shared" ? isStaff : row.space === "school" ? isStaff || row.school_id === profile.school_id : mine,
      canManage: mine || (row.space !== "personal" && (isStaff || row.created_by === profile.id)),
      createdBy: row.created_by,
      mine,
      sharedWithMe: row.space === "personal" && !mine,
    };
  });
  const byId = new Map(folders.map((f) => [f.id, f]));

  // My space first, then what others shared with me, the re_form library, my school, other schools (staff).
  const groupKey = (f: FolderSummary) => (f.space === "personal" ? (f.mine ? "mine" : "sharedWithMe") : f.space === "shared" ? "shared" : f.schoolId ?? "school");
  const groupLabel = (f: FolderSummary) => (f.space === "personal" ? (f.mine ? labels.mine : labels.sharedWithMe) : f.space === "shared" ? labels.shared : f.schoolName);
  const groups = new Map<string, { key: string; label: string; folders: FolderSummary[]; tree: { folder: FolderSummary; depth: number }[] }>();
  for (const folder of folders) {
    const key = groupKey(folder);
    if (!groups.has(key)) groups.set(key, { key, label: groupLabel(folder), folders: [], tree: [] });
    groups.get(key)?.folders.push(folder);
  }
  if (!groups.has("mine")) groups.set("mine", { key: "mine", label: labels.mine, folders: [], tree: [] });
  // Each group as an indented tree: a folder whose parent isn't visible starts at the top.
  for (const group of groups.values()) {
    const inGroup = new Set(group.folders.map((f) => f.id));
    const walk = (parent: string | null, depth: number) => {
      for (const folder of group.folders.filter((f) => (parent ? f.parentId === parent : !f.parentId || !inGroup.has(f.parentId)))) {
        group.tree.push({ folder, depth });
        if (depth < 12) walk(folder.id, depth + 1);
      }
    };
    walk(null, 0);
  }
  const rank = (g: { key: string }) => (g.key === "mine" ? 0 : g.key === "sharedWithMe" ? 1 : g.key === "shared" ? 2 : g.key === profile.school_id ? 3 : 4);
  const ordered = [...groups.values()].sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label));

  const pathOf = (folder: FolderSummary | undefined) => {
    const out: FolderSummary[] = [];
    for (let f = folder; f && out.length < 32; f = f.parentId ? byId.get(f.parentId) : undefined) out.unshift(f);
    return out;
  };

  const shares = (shareRows ?? []).map((row) => ({
    id: row.id,
    folderId: row.folder_id,
    fileId: row.file_id,
    profileId: row.profile_id,
    sharedBy: row.shared_by,
    name: row.profiles?.full_name ?? "",
  }));
  const sharedFileIds = shares.filter((s) => s.fileId && s.profileId === profile.id).map((s) => s.fileId as string);
  const toShare = (s: (typeof shares)[number]): Share => ({ id: s.id, profileId: s.profileId, name: s.name });

  const current = query.folder ? folders.find((f) => f.id === query.folder) ?? null : null;

  let filesRequest = supabase.from("library_files").select(fileColumns).order("created_at", { ascending: false }).limit(300);
  filesRequest = query.trash ? filesRequest.not("deleted_at", "is", null) : filesRequest.is("deleted_at", null);
  if (query.shared && !query.trash) filesRequest = filesRequest.in("id", sharedFileIds.length ? sharedFileIds : ["00000000-0000-0000-0000-000000000000"]);
  else if (current && !query.trash) filesRequest = filesRequest.eq("folder_id", current.id);
  if (!current && !query.trash && !query.q && !query.shared) filesRequest = filesRequest.limit(40);

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
      const canShare = Boolean(folder?.mine);
      preview = {
        ...picked,
        url,
        folderName: folder?.name ?? "",
        canEdit: isStaff || picked.uploaded_by === profile.id,
        canShare,
        shares: canShare ? shares.filter((s) => s.fileId === picked.id).map(toShare) : [],
      };
    }
  }

  const label = (folder: FolderSummary) => {
    const path = pathOf(folder);
    return `${groupLabel(path[0] ?? folder)} / ${path.map((f) => f.name).join(" / ")}`;
  };

  return {
    query,
    folders,
    groups: ordered,
    current,
    path: pathOf(current ?? undefined),
    subfolders: current ? folders.filter((f) => f.parentId === current.id) : [],
    currentShares: current?.mine ? shares.filter((s) => s.folderId === current.id).map(toShare) : [],
    usage: { used: Number(storage?.[0]?.used ?? 0), quota: Number(storage?.[0]?.quota ?? 209715200) },
    sharedFileCount: sharedFileIds.length,
    moveTargets: folders.filter((f) => f.canWrite).map((f) => ({ id: f.id, label: label(f), space: f.space })).sort((a, b) => a.label.localeCompare(b.label, "ro")),
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
export function libraryHref(query: LibraryQuery, patch: Partial<Record<"folder" | "type" | "q" | "sort" | "trash" | "shared" | "file", string | null>>) {
  const params = new URLSearchParams();
  const merged = {
    folder: query.folder,
    type: query.kind === "all" ? null : query.kind,
    q: query.q || null,
    sort: query.sort === "newest" ? null : query.sort,
    trash: query.trash ? "1" : null,
    shared: query.shared ? "1" : null,
    file: query.file,
    ...patch,
  };
  for (const [key, value] of Object.entries(merged)) if (value) params.set(key, value);
  const search = params.toString();
  return search ? `/app/library?${search}` : "/app/library";
}
