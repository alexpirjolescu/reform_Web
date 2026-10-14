// What the in-site file viewer (components/viewer) needs to show a file, and how it decides how to show it.
// Client-safe: no server imports.

export type ViewerFile = {
  name: string;
  mime?: string | null;
  size?: number | null;
  /** A URL the browser can load the file from as it is (same-origin route or a short-lived signed URL). */
  url: () => Promise<string | null>;
  /** A URL that downloads the file under its own name. */
  download?: () => Promise<string | null>;
};

export type ViewKind = "pdf" | "image" | "video" | "audio" | "text" | "csv" | "docx" | "xlsx" | "pptx" | "other";

const byExtension: Record<string, ViewKind> = {
  pdf: "pdf",
  png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image", avif: "image",
  mp4: "video", webm: "video", mov: "video", m4v: "video",
  mp3: "audio", m4a: "audio", wav: "audio", ogg: "audio", aac: "audio",
  txt: "text", md: "text", json: "text", log: "text",
  csv: "csv",
  docx: "docx",
  xlsx: "xlsx",
  pptx: "pptx",
};

/** How a file is shown, from its type and, when the type is vague, its name. Old binary Office files (.doc, .xls, .ppt) can't be read in the browser. */
export function viewKind(name: string, mime?: string | null): ViewKind {
  const type = (mime ?? "").toLowerCase();
  const ext = /\.([a-z0-9]{1,5})$/i.exec(name)?.[1]?.toLowerCase() ?? "";
  if (type === "application/pdf") return "pdf";
  if (type.startsWith("image/") && type !== "image/svg+xml" && type !== "image/tiff") return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  if (type === "text/csv") return "csv";
  if (type.includes("wordprocessingml")) return "docx";
  if (type.includes("spreadsheetml")) return "xlsx";
  if (type.includes("presentationml")) return "pptx";
  if (type.startsWith("text/") || type === "application/json") return byExtension[ext] === "csv" ? "csv" : "text";
  return byExtension[ext] ?? "other";
}

/** A file in the resource library: the app route checks access and redirects to a short-lived link. */
export function libraryFileSource(file: { id: string; name: string; mime_type?: string | null; size_bytes?: number | null }): ViewerFile {
  return {
    name: file.name,
    mime: file.mime_type,
    size: file.size_bytes,
    url: async () => `/app/library/file/${file.id}`,
    download: async () => `/app/library/file/${file.id}?download=1`,
  };
}

/** A file behind a fixed URL (public article media, a handed-in file route). */
export function urlSource(file: { name: string; mime?: string | null; size?: number | null; url: string; download?: string }): ViewerFile {
  return { name: file.name, mime: file.mime, size: file.size, url: async () => file.url, download: async () => file.download ?? file.url };
}

type Signer = {
  storage: {
    from(bucket: string): {
      createSignedUrl(path: string, expiresIn: number, options?: { download?: string | boolean }): Promise<{ data: { signedUrl: string } | null }>;
    };
  };
};

/** A file in a private storage bucket, signed in the browser (RLS on storage decides). */
export function storageSource(supabase: Signer, bucket: string, path: string, name: string, mime?: string | null): ViewerFile {
  const sign = async (download?: string) => (await supabase.storage.from(bucket).createSignedUrl(path, 600, download ? { download } : undefined)).data?.signedUrl ?? null;
  return { name, mime, url: () => sign(), download: () => sign(name) };
}

/** Splits CSV text into rows; handles quotes and picks "," or ";" (spreadsheets in Romanian often use ";"). */
export function parseCsv(text: string, maxRows = 2000): string[][] {
  const firstLine = text.slice(0, text.indexOf("\n") === -1 ? text.length : text.indexOf("\n"));
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      if (rows.length >= maxRows) return rows;
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
