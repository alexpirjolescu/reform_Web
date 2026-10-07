import { getTranslations } from "next-intl/server";
import { DownloadIcon } from "@/components/icons";
import { embedPlayer, providerNames } from "@/lib/embeds";
import { fileSize } from "@/lib/format";
import { fileLabel } from "@/lib/media";
import type { ActivityMedia } from "@/lib/news";
import type { Theme } from "@/lib/theme";
import { EmbedFrame } from "./embed-frame";
import { paperFor } from "./paper";

type Block = { kind: "gallery"; items: ActivityMedia[] } | { kind: "single"; item: ActivityMedia };

/** Photos next to each other become one gallery; everything else keeps its own place, in the editor's order. */
function blocks(media: ActivityMedia[]): Block[] {
  const out: Block[] = [];
  for (const item of media) {
    const last = out.at(-1);
    if (item.kind === "image" && last?.kind === "gallery") last.items.push(item);
    else out.push(item.kind === "image" ? { kind: "gallery", items: [item] } : { kind: "single", item });
  }
  return out;
}

/** The media of a news post: photo galleries, videos, audio, documents, links and social posts. */
export async function ActivityMediaList({ media, theme, locale }: { media: ActivityMedia[]; theme: Theme; locale: string }) {
  const t = await getTranslations("news");
  const p = paperFor(theme);
  const frame = p.media; // rounded and outlined in the colour theme
  const card = `flex items-center gap-4 p-4 ${p.panel}`;
  const caption = (text: string) => text && <figcaption className={`text-sm ${p.muted}`}>{text}</figcaption>;

  return (
    <div className="flex flex-col gap-8">
      {blocks(media).map((block) => {
        if (block.kind === "gallery") {
          const one = block.items.length === 1;
          return (
            <div key={block.items[0].id} className={one ? "" : "grid grid-cols-2 gap-3 sm:grid-cols-3"}>
              {block.items.map((photo) => (
                <figure key={photo.id} className="flex flex-col gap-1.5">
                  <a href={photo.url} target="_blank" rel="noopener noreferrer" aria-label={t("openImage")}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- public images from Supabase Storage, any size */}
                    <img src={photo.url} alt={photo.caption} loading="lazy" className={`w-full object-cover ${one ? "max-h-[70vh]" : "aspect-[4/3]"} ${frame}`} />
                  </a>
                  {caption(photo.caption)}
                </figure>
              ))}
            </div>
          );
        }

        const item = block.item;
        switch (item.kind) {
          case "video":
            return (
              <figure key={item.id} className="flex flex-col gap-1.5">
                <video controls preload="metadata" playsInline src={item.url} aria-label={item.caption || item.title} className={`max-h-[75vh] w-full bg-ink ${frame}`} />
                {caption(item.caption)}
              </figure>
            );
          case "audio":
            return (
              <figure key={item.id} className={`flex flex-col gap-3 p-4 ${p.panel}`}>
                <span className="font-display font-semibold">{item.caption || item.title}</span>
                <audio controls preload="metadata" src={item.url} className="w-full" />
              </figure>
            );
          case "file":
            return (
              <a key={item.id} href={item.url} download={item.title || true} target="_blank" rel="noopener noreferrer" className={`${card} self-start hover:underline`}>
                <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center bg-vermilion font-display text-xs font-bold text-ink">{fileLabel({ title: item.title, mime_type: item.mimeType, path: item.url })}</span>
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium break-words">{item.caption || item.title}</span>
                  <span className={`text-xs ${p.muted}`}>
                    {item.caption ? `${item.title} · ` : ""}{item.sizeBytes ? fileSize(item.sizeBytes, locale) : ""}
                  </span>
                </span>
                <DownloadIcon size={18} className="ml-2 shrink-0" />
              </a>
            );
          case "link": {
            const host = item.url.replace(/^https:\/\/(www\.)?/, "").split("/")[0];
            return (
              <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className={`${card} self-start hover:underline`}>
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
              <figure key={item.id} className="flex flex-col gap-1.5">
                <EmbedFrame
                  player={player}
                  provider={name}
                  url={item.url}
                  title={item.caption || t("embedTitle", { provider: name })}
                  boxClass={p.panel}
                  buttonClass={p.login}
                  labels={{
                    load: t("embedLoad"),
                    open: t("embedOpen", { provider: name }),
                    notice: t("embedNotice", { company: player.company }),
                  }}
                />
                {caption(item.caption)}
              </figure>
            );
          }
          default:
            return null;
        }
      })}
    </div>
  );
}
