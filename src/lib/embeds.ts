// Recognises links to social posts and video/audio platforms, and turns them into their official
// embed players. Client-safe (used by the editor, the save action and the public page).
import type { EmbedProvider } from "@/lib/media";

export type ParsedLink =
  | { kind: "embed"; provider: EmbedProvider; url: string }
  | { kind: "link"; url: string };

export type EmbedPlayer = {
  src: string;
  /** CSS aspect-ratio for players that scale with their width. */
  aspect?: string;
  /** Fixed starting height for players that don't (Instagram then reports its real height). */
  height?: number;
  maxWidth: number;
  /** Who loads content: shown before the person chooses to load it (privacy). */
  company: string;
};

export const providerNames: Record<EmbedProvider, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  vimeo: "Vimeo",
  tiktok: "TikTok",
  spotify: "Spotify",
  drive: "Google Drive",
};

const trackingParams = /^(utm_|fbclid$|mibextid$|igsh$|igshid$|si$|rdid$|share_url$|__cft__|__tn__|ref$|feature$)/;

function clean(url: URL) {
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) if (trackingParams.test(key)) url.searchParams.delete(key);
  return url;
}

function hostIs(url: URL, ...domains: string[]) {
  const host = url.hostname.toLowerCase();
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

/** Reads what someone pasted. Returns null when it isn't a web address. */
export function parseLink(input: string): ParsedLink | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol === "http:") url.protocol = "https:";
  if (url.protocol !== "https:" || !url.hostname.includes(".")) return null;
  url = clean(url);
  const path = url.pathname;

  if (hostIs(url, "instagram.com")) {
    const m = path.match(/^\/(?:[\w.]+\/)?(p|reels?|tv)\/([\w-]+)/);
    if (m) {
      const type = m[1] === "reels" ? "reel" : m[1];
      return { kind: "embed", provider: "instagram", url: `https://www.instagram.com/${type}/${m[2]}/` };
    }
  }

  if (hostIs(url, "facebook.com", "fb.com", "fb.watch")) {
    const post = /\/(posts|videos|reel|photos?|permalink\.php|story\.php|watch|share\/[prv])\b/.test(path) || hostIs(url, "fb.watch");
    if (post) return { kind: "embed", provider: "facebook", url: url.toString() };
  }

  if (hostIs(url, "youtube.com", "youtu.be", "youtube-nocookie.com")) {
    const id = hostIs(url, "youtu.be")
      ? path.slice(1).split("/")[0]
      : url.searchParams.get("v") ?? path.match(/^\/(?:shorts|live|embed)\/([\w-]{11})/)?.[1];
    if (id && /^[\w-]{11}$/.test(id)) {
      const short = path.startsWith("/shorts/");
      const start = url.searchParams.get("t") ?? url.searchParams.get("start");
      const canonical = new URL(short ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`);
      if (start) canonical.searchParams.set("t", start);
      return { kind: "embed", provider: "youtube", url: canonical.toString() };
    }
  }

  if (hostIs(url, "vimeo.com")) {
    const m = path.match(/^\/(?:video\/)?(\d+)(?:\/([\da-f]+))?/);
    if (m) {
      const hash = m[2] ?? url.searchParams.get("h");
      return { kind: "embed", provider: "vimeo", url: `https://vimeo.com/${m[1]}${hash ? `/${hash}` : ""}` };
    }
  }

  if (hostIs(url, "tiktok.com")) {
    const m = path.match(/\/video\/(\d+)/);
    if (m) return { kind: "embed", provider: "tiktok", url: `https://www.tiktok.com${path.split("?")[0]}` };
  }

  if (hostIs(url, "open.spotify.com")) {
    const m = path.match(/^\/(?:intl-[\w-]+\/)?(track|album|playlist|episode|show)\/(\w+)/);
    if (m) return { kind: "embed", provider: "spotify", url: `https://open.spotify.com/${m[1]}/${m[2]}` };
  }

  if (hostIs(url, "drive.google.com", "docs.google.com")) {
    const file = path.match(/^\/file\/d\/([\w-]+)/);
    if (file) return { kind: "embed", provider: "drive", url: `https://drive.google.com/file/d/${file[1]}/view` };
    const doc = path.match(/^\/(presentation|document|spreadsheets)\/d\/([\w-]+)/);
    if (doc) return { kind: "embed", provider: "drive", url: `https://docs.google.com/${doc[1]}/d/${doc[2]}/edit` };
  }

  return { kind: "link", url: url.toString() };
}

function seconds(value: string | null) {
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number(value);
  const m = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m || !m[0]) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

/** The official player for a saved embed, or null if the saved address no longer matches its provider. */
export function embedPlayer(provider: EmbedProvider, address: string): EmbedPlayer | null {
  const parsed = parseLink(address);
  if (!parsed || parsed.kind !== "embed" || parsed.provider !== provider) return null;
  const url = new URL(parsed.url);
  const path = url.pathname;
  const meta = "Meta (Instagram, Facebook)";

  switch (provider) {
    case "instagram":
      return { src: `${url.origin}${path}embed/captioned/`, height: 640, maxWidth: 540, company: meta };
    case "facebook": {
      const video = /\/(videos|reel|watch|share\/[rv])\b/.test(path) || hostIs(url, "fb.watch");
      const href = encodeURIComponent(parsed.url);
      return video
        ? { src: `https://www.facebook.com/plugins/video.php?href=${href}&show_text=false&width=560`, aspect: "16 / 9", maxWidth: 560, company: meta }
        : { src: `https://www.facebook.com/plugins/post.php?href=${href}&show_text=true&width=500`, height: 640, maxWidth: 500, company: meta };
    }
    case "youtube": {
      const short = path.startsWith("/shorts/");
      const id = short ? path.split("/")[2] : url.searchParams.get("v");
      const start = seconds(url.searchParams.get("t"));
      const src = `https://www.youtube-nocookie.com/embed/${id}?rel=0${start ? `&start=${start}` : ""}`;
      return short ? { src, aspect: "9 / 16", maxWidth: 360, company: "Google (YouTube)" } : { src, aspect: "16 / 9", maxWidth: 960, company: "Google (YouTube)" };
    }
    case "vimeo": {
      const [, id, hash] = path.split("/");
      return { src: `https://player.vimeo.com/video/${id}?dnt=1${hash ? `&h=${hash}` : ""}`, aspect: "16 / 9", maxWidth: 960, company: "Vimeo" };
    }
    case "tiktok": {
      const id = path.match(/\/video\/(\d+)/)?.[1];
      return { src: `https://www.tiktok.com/embed/v2/${id}`, height: 740, maxWidth: 340, company: "TikTok" };
    }
    case "spotify": {
      const [, type, id] = path.split("/");
      const compact = type === "track" || type === "episode";
      return { src: `https://open.spotify.com/embed/${type}/${id}`, height: compact ? 152 : 352, maxWidth: 720, company: "Spotify" };
    }
    case "drive": {
      const src = url.hostname === "drive.google.com" ? path.replace(/\/view$/, "/preview") : path.replace(/\/edit$/, path.startsWith("/presentation") ? "/embed" : "/preview");
      return { src: `${url.origin}${src}`, aspect: path.startsWith("/presentation") ? "16 / 9" : "4 / 3", maxWidth: 960, company: "Google" };
    }
  }
}
