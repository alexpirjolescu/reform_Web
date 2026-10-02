// Client-safe helpers for the resource library (PRD module 3).

export const fileKinds = ["video", "pdf", "docs", "images", "audio", "links"] as const;
export type FileKind = (typeof fileKinds)[number];

export const maxUploadBytes = 50 * 1024 * 1024;

/** Must match allowed_mime_types on the "library" bucket (supabase/migrations/*_library.sql). */
export const acceptedTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
];

export type LibraryFile = {
  id: string;
  folder_id: string;
  name: string;
  description: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string | null;
  external_url: string | null;
  tags: string[];
  uploaded_by: string | null;
  created_at: string;
  deleted_at: string | null;
  uploaderName: string | null;
};

export function kindOf(file: Pick<LibraryFile, "mime_type" | "external_url">): FileKind {
  if (file.external_url) return "links";
  const mime = file.mime_type;
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("image/")) return "images";
  if (mime === "application/pdf") return "pdf";
  return "docs";
}

function extension(name: string) {
  const match = /\.([a-z0-9]{1,5})$/i.exec(name);
  return match ? match[1].toUpperCase() : null;
}

/** The coloured type badge from the mockups: PDF vermilion, video lavender, docs teal, slides honey, images lime, audio pink. */
export function badgeOf(file: Pick<LibraryFile, "name" | "mime_type" | "external_url">) {
  const kind = kindOf(file);
  const ext = extension(file.name);
  if (kind === "links") {
    const video = file.external_url && /youtube\.com|youtu\.be|vimeo\.com/.test(file.external_url);
    return { label: video ? "VIDEO" : "LINK", bg: video ? "#79569a" : "#3a978a", fg: "#ffffff" };
  }
  if (kind === "pdf") return { label: "PDF", bg: "#dd6937", fg: "#221f20" };
  if (kind === "video") return { label: ext ?? "VIDEO", bg: "#79569a", fg: "#ffffff" };
  if (kind === "images") return { label: ext ?? "IMG", bg: "#abca54", fg: "#221f20" };
  if (kind === "audio") return { label: ext ?? "AUDIO", bg: "#e28ba3", fg: "#221f20" };
  if (ext === "PPT" || ext === "PPTX") return { label: ext, bg: "#e1b345", fg: "#221f20" };
  return { label: ext ?? "DOC", bg: "#77bfb2", fg: "#221f20" };
}

/** YouTube links play inline in the preview (privacy-enhanced domain). */
export function youtubeEmbed(url: string) {
  const match = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/.exec(url);
  return match ? `https://www.youtube-nocookie.com/embed/${match[1]}` : null;
}

/** Storage keys keep only safe characters; the real name stays in library_files.name. */
export function storageSafeName(name: string) {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-80);
  return cleaned || "file";
}
