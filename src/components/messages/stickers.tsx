"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { GifResult } from "@/lib/giphy";

// The re_form sticker pack: drawn here in the brand colours with the ink outline of the colour
// design, so they look the same in every theme and nothing loads from elsewhere.

const ink = "#221f20";
const C = { teal: "#77bfb2", honey: "#e1b345", lavender: "#79569a", vermilion: "#dd6937", lime: "#abca54", pink: "#e28ba3", white: "#ffffff" };

function Word({ y, children, size = 22, fill = ink }: { y: number; children: string; size?: number; fill?: string }) {
  return (
    <text x="60" y={y} textAnchor="middle" fontSize={size} fontWeight={800} fill={fill} stroke="none" style={{ fontFamily: "var(--font-display), sans-serif" }}>
      {children}
    </text>
  );
}

const eyes = (y = 50, gap = 16) => (
  <>
    <circle cx={60 - gap} cy={y} r="5" fill={ink} stroke="none" />
    <circle cx={60 + gap} cy={y} r="5" fill={ink} stroke="none" />
  </>
);

function star(points: number, outer: number, inner: number, cx = 60, cy = 60) {
  return Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 ? inner : outer;
    const a = (Math.PI * i) / points - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
}

export const stickers: Record<string, { art: ReactNode }> = {
  bravo: { art: <><polygon points={star(12, 56, 44)} fill={C.lime} /><Word y={68}>bravo!</Word></> },
  mersi: {
    art: (
      <>
        <path d="M60 104 C20 78 6 56 14 36 C22 16 48 14 60 34 C72 14 98 16 106 36 C114 56 100 78 60 104 Z" fill={C.pink} />
        <Word y={64}>mersi!</Word>
      </>
    ),
  },
  super: { art: <><circle cx="60" cy="60" r="52" fill={C.honey} />{eyes(44)}<path d="M38 60 Q60 80 82 60" fill="none" strokeLinecap="round" /><Word y={98} size={20}>super</Word></> },
  hai: {
    art: (
      <>
        <rect x="10" y="30" width="100" height="60" rx="18" fill={C.teal} transform="rotate(-6 60 60)" />
        <Word y={68} size={26}>hai! →</Word>
      </>
    ),
  },
  idee: {
    art: (
      <>
        <path d="M60 10 C34 10 22 30 22 46 C22 62 36 70 40 82 L80 82 C84 70 98 62 98 46 C98 30 86 10 60 10 Z" fill={C.honey} />
        <rect x="42" y="86" width="36" height="14" rx="5" fill={C.white} />
        <path d="M60 2 L60 -6 M14 20 L8 14 M106 20 L112 14" />
        <Word y={52} size={20}>idee!</Word>
      </>
    ),
  },
  gata: { art: <><rect x="12" y="12" width="96" height="96" rx="26" fill={C.lime} /><path d="M34 56 L52 74 L86 38" fill="none" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" /><Word y={100} size={16}>gata</Word></> },
  wow: { art: <><polygon points={star(9, 56, 38)} fill={C.lavender} /><Word y={68} size={26} fill={C.white}>wow</Word></> },
  haha: {
    art: (
      <>
        <circle cx="60" cy="60" r="52" fill={C.honey} />
        <path d="M36 48 Q44 40 52 48 M68 48 Q76 40 84 48" fill="none" strokeLinecap="round" />
        <path d="M34 62 Q60 100 86 62 Z" fill={ink} />
        <path d="M44 72 Q60 84 76 72" fill={C.pink} stroke="none" />
      </>
    ),
  },
  of: {
    art: (
      <>
        <circle cx="60" cy="60" r="52" fill={C.teal} />
        {eyes(50)}
        <path d="M40 84 Q60 66 80 84" fill="none" strokeLinecap="round" />
        <path d="M84 58 Q90 70 84 74 Q78 70 84 58 Z" fill="#9fd6ff" strokeWidth="2.5" />
      </>
    ),
  },
  cool: {
    art: (
      <>
        <circle cx="60" cy="60" r="52" fill={C.vermilion} />
        <path d="M22 46 L98 46 L94 60 Q84 70 72 60 L66 50 L54 50 L48 60 Q36 70 26 60 Z" fill={ink} />
        <path d="M42 80 Q60 92 80 76" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  pauza: {
    art: (
      <>
        <path d="M22 40 L86 40 L80 96 Q78 104 70 104 L38 104 Q30 104 28 96 Z" fill={C.vermilion} />
        <path d="M86 52 Q104 52 102 66 Q100 80 82 80" fill="none" />
        <path d="M42 30 Q38 22 44 14 M56 30 Q52 22 58 14 M70 30 Q66 22 72 14" fill="none" strokeLinecap="round" />
        <Word y={78} size={17}>pauză</Word>
      </>
    ),
  },
  plus1: { art: <><circle cx="60" cy="60" r="50" fill={C.white} /><circle cx="60" cy="60" r="38" fill={C.teal} /><Word y={72} size={34}>+1</Word></> },
  love: {
    art: (
      <>
        <circle cx="60" cy="60" r="52" fill={C.pink} />
        <path d="M30 50 C30 40 44 38 46 48 C48 38 62 40 62 50 C62 58 46 66 46 66 C46 66 30 58 30 50 Z" fill={C.vermilion} strokeWidth="3" transform="translate(-4 -6) scale(0.95)" />
        <path d="M62 50 C62 40 76 38 78 48 C80 38 94 40 94 50 C94 58 78 66 78 66 C78 66 62 58 62 50 Z" fill={C.vermilion} strokeWidth="3" transform="translate(-2 -6) scale(0.95)" />
        <path d="M38 78 Q60 98 82 78" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  reform: {
    art: (
      <>
        <rect x="8" y="26" width="104" height="68" rx="20" fill={C.white} transform="rotate(4 60 60)" />
        <Word y={66} size={30}>re</Word>
        <rect x="70" y="58" width="26" height="8" fill={C.lime} stroke="none" />
      </>
    ),
  },
};

export const stickerIds = Object.keys(stickers);

/** One sticker; unknown ids (from a newer version) show nothing rather than break. */
export function Sticker({ id, size = 120, label }: { id: string; size?: number; label: string }) {
  const sticker = stickers[id];
  if (!sticker) return null;
  return (
    <svg width={size} height={size} viewBox="-4 -10 128 128" role="img" aria-label={label} stroke={ink} strokeWidth="4" strokeLinejoin="round">
      {sticker.art}
    </svg>
  );
}

/** Stickers and GIFs (GIPHY, G-rated) in one panel above the composer. */
export function StickerPicker({
  onSticker,
  onGif,
  onClose,
}: {
  onSticker: (id: string) => void;
  onGif: (gif: GifResult) => void;
  onClose: () => void;
}) {
  const t = useTranslations("messages");
  const locale = useLocale();
  const [tab, setTab] = useState<"stickers" | "gifs">("stickers");
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<GifResult[] | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "off" | "error">("idle");
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    const onDown = (event: PointerEvent) => !panel.current?.contains(event.target as Node) && onClose();
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (tab !== "gifs") return;
    const timer = setTimeout(async () => {
      setStatus("loading");
      try {
        const response = await fetch(`/api/giphy?q=${encodeURIComponent(query)}&lang=${locale}`);
        if (response.status === 503) return setStatus("off");
        if (!response.ok) return setStatus("error");
        setGifs(((await response.json()) as { gifs: GifResult[] }).gifs);
        setStatus("idle");
      } catch {
        setStatus("error");
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [tab, query, locale]);

  return (
    <div ref={panel} role="dialog" aria-label={t("stickersAndGifs")} className="ui-menu absolute bottom-full left-0 z-30 mb-2 flex max-h-[360px] w-[min(380px,calc(100vw-2rem))] origin-bottom-left flex-col gap-2 p-3">
      <div role="tablist" className="ui-seg shrink-0">
        {(["stickers", "gifs"] as const).map((name) => (
          <button key={name} type="button" role="tab" aria-selected={tab === name} onClick={() => setTab(name)}>
            {t(name)}
          </button>
        ))}
      </div>
      {tab === "stickers" ? (
        <ul className="grid grid-cols-4 gap-1 overflow-y-auto">
          {stickerIds.map((id) => (
            <li key={id}>
              <button type="button" onClick={() => onSticker(id)} aria-label={t(`stickerNames.${id}`)} className="grid w-full place-items-center rounded-xl p-1 hover:bg-black/5">
                <Sticker id={id} size={68} label={t(`stickerNames.${id}`)} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <input type="search" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("searchGifs")} aria-label={t("searchGifs")}
            className="ui-field ui-sm ui-search" />
          {status === "off" && <p className="text-sm">{t("gifsOff")}</p>}
          {status === "error" && <p className="text-sm">{t("gifsError")}</p>}
          {status === "loading" && !gifs && <p className="text-sm">{t("loading")}</p>}
          {gifs && status !== "off" && (
            <ul className="grid grid-cols-3 gap-1.5 overflow-y-auto">
              {gifs.map((gif) => (
                <li key={gif.id}>
                  <button type="button" onClick={() => onGif(gif)} aria-label={gif.title || "GIF"} className="block w-full overflow-hidden rounded-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element -- GIPHY media, animated */}
                    <img src={gif.preview} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-right text-[10px] font-semibold tracking-wide uppercase opacity-70">{t("poweredByGiphy")}</p>
        </>
      )}
    </div>
  );
}
