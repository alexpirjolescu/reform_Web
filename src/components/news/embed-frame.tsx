"use client";

import { useEffect, useRef, useState } from "react";
import type { EmbedPlayer } from "@/lib/embeds";

/**
 * A post or player from another site (Instagram, Facebook, YouTube…). Nothing from that site loads
 * until the reader presses the button: those players can set cookies and track visitors, and many
 * readers are minors (GDPR). The link to the original always works.
 */
export function EmbedFrame({
  player,
  provider,
  url,
  title,
  labels,
  boxClass,
  buttonClass,
  autoLoad = false,
}: {
  player: EmbedPlayer;
  provider: string;
  url: string;
  title: string;
  labels: { load: string; open: string; notice: string };
  boxClass: string;
  buttonClass: string;
  /** Load at once (players that set no cookies until played, inside the private platform). */
  autoLoad?: boolean;
}) {
  const [loaded, setLoaded] = useState(autoLoad);
  const [height, setHeight] = useState(player.height);
  const frame = useRef<HTMLIFrameElement>(null);

  // Instagram's embed reports its real height to the page that shows it.
  useEffect(() => {
    if (!loaded || !player.src.startsWith("https://www.instagram.com/")) return;
    function onMessage(event: MessageEvent) {
      if (event.origin !== "https://www.instagram.com" || event.source !== frame.current?.contentWindow) return;
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        const reported = Number(data?.details?.height);
        if (data?.type === "MEASURE" && reported > 100 && reported < 5000) setHeight(Math.ceil(reported));
      } catch {
        // Other messages from the embed are not ours to read.
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [loaded, player.src]);

  const size = player.aspect ? { aspectRatio: player.aspect } : { height };

  if (!loaded) {
    return (
      <div className={`flex w-full flex-col items-start justify-center gap-3 p-5 ${boxClass}`} style={{ maxWidth: player.maxWidth, minHeight: 220, ...(player.aspect ? { aspectRatio: player.aspect } : {}) }}>
        <span className="font-display text-lg font-bold">{provider}</span>
        <p className="max-w-[46ch] text-sm leading-relaxed">{labels.notice}</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
          <button type="button" onClick={() => setLoaded(true)} className={buttonClass}>
            {labels.load}
          </button>
          <a href={url} target="_blank" rel="noopener noreferrer" className="ui-btn ui-plain">
            {labels.open} ↗
          </a>
        </div>
      </div>
    );
  }

  return (
    <iframe
      ref={frame}
      src={player.src}
      title={title}
      loading="lazy"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture; web-share"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation allow-forms"
      className="block w-full border-0 bg-white"
      style={{ maxWidth: player.maxWidth, ...size }}
    />
  );
}
