import { useTranslations } from "next-intl";
import { DownloadIcon } from "@/components/icons";
import { embedPlayer, providerNames } from "@/lib/embeds";
import { fileSize } from "@/lib/format";
import { fileLabel } from "@/lib/media";
import type { ActivityMedia } from "@/lib/news";
import type { Theme } from "@/lib/theme-shared";
import { EmbedFrame } from "./embed-frame";
import { paperFor } from "./paper";

/**
 * One item of a news post: a photo, video, audio, document, link card or a post from another site.
 * Not async, so it renders on the server (public page) and in the browser (the editor's preview).
 * `fill` makes photos and videos cover their box (side by side); otherwise they keep their shape.
 */
export function MediaView({ item, theme, locale, fill = false }: { item: ActivityMedia; theme: Theme; locale: string; fill?: boolean }) {
  const t = useTranslations("news");
  const p = paperFor(theme);
  const frame = p.media; // rounded and outlined in the colour theme
  const card = `flex items-center gap-4 p-4 ${p.panel}`;
  const caption = item.caption && <figcaption className={`text-sm ${p.muted}`}>{item.caption}</figcaption>;

  switch (item.kind) {
    case "image":
      return (
        <figure className="flex flex-col gap-1.5">
          <a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={t("openImage")}>
            {/* eslint-disable-next-line @next/next/no-img-element -- public images from Supabase Storage, any size */}
            <img src={item.url} alt={item.caption} loading="lazy" className={`w-full object-cover ${fill ? "aspect-[4/3]" : "max-h-[75vh]"} ${frame}`} />
          </a>
          {caption}
        </figure>
      );
    case "video":
      return (
        <figure className="flex flex-col gap-1.5">
          <video controls preload="metadata" playsInline src={item.url} aria-label={item.caption || item.title} className={`w-full bg-ink ${fill ? "aspect-video object-cover" : "max-h-[75vh]"} ${frame}`} />
          {caption}
        </figure>
      );
    case "audio":
      return (
        <figure className={`flex flex-col gap-3 p-4 ${p.panel}`}>
          <span className="font-display font-semibold">{item.caption || item.title}</span>
          <audio controls preload="metadata" src={item.url} className="w-full" />
        </figure>
      );
    case "file":
      return (
        <a href={item.url} download={item.title || true} target="_blank" rel="noopener noreferrer" className={`${card} hover:underline`}>
          <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center bg-vermilion font-display text-xs font-bold text-ink">{fileLabel({ title: item.title, mime_type: item.mimeType, path: item.url })}</span>
          <span className="flex min-w-0 flex-col">
            <span className="font-medium break-words">{item.caption || item.title}</span>
            <span className={`text-xs ${p.muted}`}>
              {item.caption ? `${item.title} · ` : ""}{item.sizeBytes ? fileSize(item.sizeBytes, locale) : ""}
            </span>
          </span>
          <DownloadIcon size={18} className="ml-auto shrink-0" />
        </a>
      );
    case "link": {
      const host = item.url.replace(/^https:\/\/(www\.)?/, "").split("/")[0];
      return (
        <a href={item.url} target="_blank" rel="noopener noreferrer" className={`${card} hover:underline`}>
          <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center bg-teal font-display text-xs font-bold text-ink">LINK</span>
          <span className="flex min-w-0 flex-col">
            <span className="font-medium break-words">{item.caption || item.title || host}</span>
            <span className={`text-xs ${p.muted}`}>{host} ↗</span>
          </span>
        </a>
      );
    }
    case "embed": {
      const player = item.provider ? embedPlayer(item.provider, item.url) : null;
      if (!item.provider || !player) return null;
      const name = providerNames[item.provider];
      return (
        <figure className="flex flex-col gap-1.5">
          <EmbedFrame
            player={player}
            provider={name}
            url={item.url}
            title={item.caption || t("embedTitle", { provider: name })}
            boxClass={p.panel}
            buttonClass={p.login}
            labels={{ load: t("embedLoad"), open: t("embedOpen", { provider: name }), notice: t("embedNotice", { company: player.company }) }}
          />
          {caption}
        </figure>
      );
    }
    default:
      return null;
  }
}
