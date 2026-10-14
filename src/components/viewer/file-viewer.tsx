"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { CloseIcon, DownloadIcon } from "@/components/icons";
import { viewKind, type ViewerFile } from "@/lib/viewer";

// The readers load only when a file of their kind is opened.
const PdfView = dynamic(() => import("./views").then((m) => m.PdfView), { ssr: false });
const DocxView = dynamic(() => import("./views").then((m) => m.DocxView), { ssr: false });
const SheetView = dynamic(() => import("./views").then((m) => m.SheetView), { ssr: false });
const SlidesView = dynamic(() => import("./views").then((m) => m.SlidesView), { ssr: false });
const TextView = dynamic(() => import("./views").then((m) => m.TextView), { ssr: false });

const OpenFile = createContext<(file: ViewerFile) => void>(() => {});

/** Opens a file in the viewer laid over the current page (PDF, Word, Excel, PowerPoint, pictures, video, audio, text). */
export const useFileViewer = () => useContext(OpenFile);

export function FileViewerProvider({ children }: { children: ReactNode }) {
  const [file, setFile] = useState<ViewerFile | null>(null);
  return (
    <OpenFile value={setFile}>
      {children}
      {file && <FileViewer key={file.name + String(file.size)} file={file} onClose={() => setFile(null)} />}
    </OpenFile>
  );
}

const zoomSteps = [0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 3];

function FileViewer({ file, onClose }: { file: ViewerFile; onClose: () => void }) {
  const t = useTranslations("viewer");
  const kind = viewKind(file.name, file.mime);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pages, setPages] = useState<{ current: number; total: number } | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const zoomable = kind === "pdf" || kind === "image" || kind === "docx";

  useEffect(() => {
    let cancelled = false;
    file.url().then((resolved) => {
      if (cancelled) return;
      if (resolved) setUrl(resolved);
      else setFailed(true);
    }, () => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [file]);

  // While open: the page behind doesn't scroll, Escape closes, Tab stays inside, focus returns afterwards.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
      if (event.key === "Tab" && dialog.current) {
        const items = [...dialog.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), video, audio, iframe, [tabindex]:not([tabindex="-1"])')];
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      root.style.overflow = overflow;
      document.removeEventListener("keydown", onKey, true);
      before?.focus?.();
    };
  }, [onClose]);

  const fail = useCallback(() => setFailed(true), []);
  const onPages = useCallback((current: number, total: number) => setPages({ current, total }), []);

  async function download() {
    const target = await (file.download ?? file.url)();
    if (!target) return;
    const link = document.createElement("a");
    link.href = target;
    link.download = file.name;
    link.rel = "noopener";
    document.body.append(link);
    link.click();
    link.remove();
  }

  const step = (direction: 1 | -1) =>
    setZoom((current) => {
      const index = zoomSteps.findIndex((z) => z >= current - 0.001);
      return zoomSteps[Math.min(zoomSteps.length - 1, Math.max(0, index + direction))];
    });

  let body: ReactNode = <p className="py-16 text-center text-sm text-th-muted">{t("loading")}</p>;
  if (failed || kind === "other") {
    body = (
      <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <span aria-hidden="true" className="grid size-16 place-items-center rounded-[16px] bg-th-fill font-display text-sm font-bold text-th-muted">
          {/\.([a-z0-9]{1,5})$/i.exec(file.name)?.[1]?.toUpperCase() ?? "FILE"}
        </span>
        <p className="max-w-sm text-[15px]">{failed ? t("failed") : t("noPreview")}</p>
        <button type="button" onClick={() => void download()} className="ui-btn ui-filled">
          <DownloadIcon size={16} /> {t("download")}
        </button>
      </div>
    );
  } else if (url) {
    switch (kind) {
      case "pdf":
        body = <PdfView url={url} zoom={zoom} onFail={fail} onPages={onPages} />;
        break;
      case "docx":
        body = <DocxView url={url} zoom={zoom} onFail={fail} />;
        break;
      case "xlsx":
        body = <SheetView url={url} zoom={zoom} onFail={fail} />;
        break;
      case "pptx":
        body = <SlidesView url={url} zoom={zoom} onFail={fail} />;
        break;
      case "text":
      case "csv":
        body = <TextView url={url} zoom={zoom} onFail={fail} csv={kind === "csv"} />;
        break;
      case "image":
        body = (
          <div className="flex min-h-full items-center justify-center p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={file.name} onError={fail} className="max-w-none object-contain" style={zoom === 1 ? { maxWidth: "100%", maxHeight: "calc(100dvh - 120px)" } : { width: `${zoom * 100}%` }} />
          </div>
        );
        break;
      case "video":
        body = (
          <div className="flex min-h-full items-center justify-center bg-black p-0 sm:p-3">
            <video src={url} controls playsInline autoPlay onError={fail} className="max-h-[calc(100dvh-120px)] w-full max-w-full" />
          </div>
        );
        break;
      case "audio":
        body = (
          <div className="flex min-h-full items-center justify-center p-6">
            <audio src={url} controls autoPlay onError={fail} className="w-full max-w-xl" />
          </div>
        );
        break;
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex bg-black/45 backdrop-blur-[2px] sm:p-5" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={file.name}
        className="mx-auto flex h-full w-full max-w-[1120px] flex-col overflow-hidden bg-th-bg text-th-fg shadow-[0_24px_64px_rgb(0_0_0/0.35)] sm:rounded-[22px]"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-th-sep px-3 py-2 sm:px-4" style={{ paddingTop: "max(8px, env(safe-area-inset-top))" }}>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-display text-[15px] font-semibold">{file.name}</span>
            {pages && kind === "pdf" && !failed && <span className="text-xs text-th-muted">{t("page", { n: pages.current, total: pages.total })}</span>}
          </div>
          {zoomable && !failed && url && (
            <div className="hidden items-center rounded-full bg-th-fill p-0.5 sm:flex">
              <button type="button" onClick={() => step(-1)} aria-label={t("zoomOut")} className="ui-btn ui-plain ui-icon ui-sm ui-neutral">−</button>
              <button type="button" onClick={() => setZoom(1)} aria-label={t("zoomReset")} className="min-w-12 text-center text-xs font-medium tabular-nums">{Math.round(zoom * 100)}%</button>
              <button type="button" onClick={() => step(1)} aria-label={t("zoomIn")} className="ui-btn ui-plain ui-icon ui-sm ui-neutral">+</button>
            </div>
          )}
          <button type="button" onClick={() => void download()} aria-label={t("download")} className="ui-btn ui-tinted ui-sm">
            <DownloadIcon size={15} /> <span className="hidden sm:inline">{t("download")}</span>
          </button>
          <button ref={closeButton} type="button" onClick={onClose} aria-label={t("close")} className="ui-btn ui-gray ui-icon ui-sm ui-neutral">
            <CloseIcon size={16} />
          </button>
        </div>
        <div className={`min-h-0 flex-1 overflow-auto ${kind === "docx" && !failed ? "" : "bg-th-sunk"}`}>{body}</div>
        {zoomable && !failed && url && (
          <div className="flex shrink-0 items-center justify-center gap-1 border-t border-th-sep py-1.5 sm:hidden" style={{ paddingBottom: "max(6px, env(safe-area-inset-bottom))" }}>
            <button type="button" onClick={() => step(-1)} aria-label={t("zoomOut")} className="ui-btn ui-plain ui-icon ui-sm ui-neutral">−</button>
            <button type="button" onClick={() => setZoom(1)} aria-label={t("zoomReset")} className="min-w-14 text-center text-xs font-medium tabular-nums">{Math.round(zoom * 100)}%</button>
            <button type="button" onClick={() => step(1)} aria-label={t("zoomIn")} className="ui-btn ui-plain ui-icon ui-sm ui-neutral">+</button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * A link to a file that opens the viewer instead of leaving the page. It stays a real link (open in a new
 * tab, copy address, download attribute), so server components can use it too.
 */
export function ViewerLink({
  name,
  mime,
  size,
  href,
  downloadHref,
  className,
  children,
  download,
  ariaLabel,
}: {
  name: string;
  mime?: string | null;
  size?: number | null;
  href: string;
  downloadHref?: string;
  className?: string;
  children: ReactNode;
  download?: string | boolean;
  ariaLabel?: string;
}) {
  const open = useFileViewer();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      download={download === true ? "" : download || undefined}
      aria-label={ariaLabel}
      className={className}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        open({ name, mime, size, url: async () => href, download: async () => downloadHref ?? href });
      }}
    >
      {children}
    </a>
  );
}
