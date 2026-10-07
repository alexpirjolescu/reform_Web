// What a news post (activity) can carry, shared by the editor, the save action and the public page.
// Client-safe: no server imports.

export type MediaKind = "image" | "video" | "audio" | "file" | "embed" | "link";
export type EmbedProvider = "instagram" | "facebook" | "youtube" | "vimeo" | "tiktok" | "spotify" | "drive";

export type MediaItem = {
  kind: MediaKind;
  /** Uploaded kinds: path in the public "media" bucket. */
  path?: string | null;
  /** Embeds and links: the address as pasted (normalised). */
  url?: string | null;
  provider?: EmbedProvider | null;
  /** File name, or the link's title. */
  title: string;
  caption: string;
  mime_type?: string | null;
  size_bytes?: number | null;
};

export const uploadKinds = ["image", "video", "audio", "file"] as const;

const types: Record<"image" | "video" | "audio" | "file", string[]> = {
  image: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
  audio: ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/ogg", "audio/wav", "audio/webm"],
  file: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/msword",
    "application/vnd.ms-powerpoint",
    "application/vnd.ms-excel",
  ],
};

/** Everything the "media" bucket accepts (same list as the 20261007120000 migration). */
export const acceptedMediaTypes = Object.values(types).flat();

/** Per-file limits. 50 MB is Supabase's default upload limit; use YouTube or Vimeo for longer videos. */
export const maxImageBytes = 10 * 1024 * 1024;
export const maxMediaBytes = 50 * 1024 * 1024;

export function kindOfMime(mime: string): MediaItem["kind"] | null {
  for (const [kind, list] of Object.entries(types)) if (list.includes(mime)) return kind as MediaItem["kind"];
  return null;
}

/** Photos and videos can show students, so they need the consent box ticked before publishing. */
export function needsConsent(items: Pick<MediaItem, "kind">[]) {
  return items.some((item) => item.kind === "image" || item.kind === "video");
}

export function fileLabel(item: Pick<MediaItem, "title" | "mime_type" | "path">) {
  const name = item.title || item.path?.split("/").pop() || "";
  const ext = name.includes(".") ? name.split(".").pop()!.toUpperCase().slice(0, 4) : "";
  if (ext) return ext;
  if (item.mime_type === "application/pdf") return "PDF";
  return "FILE";
}
