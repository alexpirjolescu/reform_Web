"use client";

// The ways the file viewer shows a file. Every reader library is loaded only when a file of its kind is
// opened. Content from files never becomes HTML in the page: PDFs are drawn on canvases, Word documents are
// laid out inside a sandboxed frame that can't run scripts, and sheets, slides and text become plain React text.

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { parseCsv } from "@/lib/viewer";

type ViewProps = { url: string; zoom: number; onFail: () => void };

/** Pages draw when they come near the screen and again after zooming. */
export function PdfView({ url, zoom, onFail, onPages }: ViewProps & { onPages: (current: number, total: number) => void }) {
  const t = useTranslations("viewer");
  const host = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<import("pdfjs-dist").PDFDocumentProxy | null>(null);
  const [sizes, setSizes] = useState<{ width: number; height: number }[]>([]);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let loading: import("pdfjs-dist").PDFDocumentLoadingTask | null = null;
    (async () => {
      try {
        // The "legacy" build carries polyfills (Map.getOrInsertComputed and friends) for browsers that are not the newest.
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
        }
        // The whole file at once: the links behind files expire after a minute, so no later range requests.
        loading = pdfjs.getDocument({ url, disableRange: true, disableStream: true, enableXfa: false });
        const loaded = await loading.promise;
        const pages = await Promise.all(
          Array.from({ length: loaded.numPages }, (_, i) => loaded.getPage(i + 1).then((page) => page.getViewport({ scale: 1 }))),
        );
        if (cancelled) return;
        setSizes(pages.map((v) => ({ width: v.width, height: v.height })));
        setDoc(loaded);
        onPages(1, loaded.numPages);
      } catch {
        if (!cancelled) onFail();
      }
    })();
    return () => {
      cancelled = true;
      void loading?.destroy();
    };
    // onPages/onFail are stable setters from the viewer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Which page fills most of the screen.
  useEffect(() => {
    const element = host.current;
    if (!element || !doc) return;
    const ratios = new Map<number, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) ratios.set(Number((entry.target as HTMLElement).dataset.page), entry.intersectionRatio);
        const best = [...ratios.entries()].sort((a, b) => b[1] - a[1])[0];
        if (best && best[1] > 0) onPages(best[0], doc.numPages);
      },
      { root: element.parentElement, threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    element.querySelectorAll("[data-page]").forEach((page) => observer.observe(page));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, sizes.length]);

  const fit = Math.max(0, Math.min(width - 24, 900));
  return (
    <div ref={host} className="flex flex-col items-center gap-3 px-3 py-4">
      {!doc && <p className="py-16 text-sm text-th-muted">{t("loading")}</p>}
      {doc &&
        sizes.map((size, index) => (
          <PdfPage key={index} doc={doc} number={index + 1} cssWidth={fit * zoom} ratio={size.height / size.width} label={t("page", { n: index + 1, total: sizes.length })} />
        ))}
    </div>
  );
}

function PdfPage({ doc, number, cssWidth, ratio, label }: { doc: import("pdfjs-dist").PDFDocumentProxy; number: number; cssWidth: number; ratio: number; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const element = canvas.current?.parentElement;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && setNear(true), { rootMargin: "800px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!near || !cssWidth || !canvas.current) return;
    let task: import("pdfjs-dist").RenderTask | null = null;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const page = await doc.getPage(number);
      if (cancelled || !canvas.current) return;
      const base = page.getViewport({ scale: 1 });
      const scale = (cssWidth / base.width) * Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale });
      const target = canvas.current;
      target.width = Math.floor(viewport.width);
      target.height = Math.floor(viewport.height);
      task = page.render({ canvas: target, viewport });
      await task.promise.catch(() => undefined);
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      task?.cancel();
    };
  }, [near, cssWidth, doc, number]);

  return (
    <div data-page={number} className="shrink-0 bg-white shadow-[0_2px_12px_rgb(0_0_0/0.12)]" style={{ width: cssWidth, height: cssWidth * ratio }}>
      <canvas ref={canvas} role="img" aria-label={label} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

const frameStyle =
  "html,body{margin:0;background:#ecebea}.docx-wrapper{background:#ecebea!important;padding:16px!important}.docx-wrapper>section.docx{box-shadow:0 2px 12px rgb(0 0 0 / .12)!important;margin-bottom:16px!important}";

function zoomDocument(doc: Document, zoom: number) {
  doc.body.style.zoom = String(zoom);
}

/** Word (.docx), laid out by docx-preview inside a frame that can't run scripts; pages scale down to fit. */
export function DocxView({ url, zoom, onFail }: ViewProps) {
  const t = useTranslations("viewer");
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      try {
        const [{ renderAsync }, response] = await Promise.all([import("docx-preview"), fetch(url)]);
        if (!response.ok) throw new Error(String(response.status));
        const blob = await response.blob();
        const doc = frame.current?.contentDocument;
        if (cancelled || !doc) return;
        doc.body.replaceChildren();
        await renderAsync(blob, doc.body, doc.head, {
          inWrapper: true,
          ignoreLastRenderedPageBreak: true,
          renderAltChunks: false,
          renderComments: false,
          useBase64URL: true,
          experimental: false,
        });
        // Links open in a new tab, and only web links work.
        doc.querySelectorAll("a").forEach((link) => {
          const href = link.getAttribute("href") ?? "";
          if (/^https?:\/\//i.test(href)) {
            link.target = "_blank";
            link.rel = "noopener noreferrer";
          } else if (!href.startsWith("#")) link.removeAttribute("href");
        });
        doc.querySelectorAll("script, iframe, object, embed").forEach((node) => node.remove());
        // docx-preview writes its own styles into <head>; ours go after them (a light backdrop, page shadows).
        const look = doc.createElement("style");
        look.textContent = frameStyle;
        doc.head.append(look);
        if (!cancelled) setRendered(true);
      } catch {
        if (!cancelled) onFail();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, url]);

  // Fit the page width to the frame, then apply the zoom.
  useEffect(() => {
    const target = frame.current;
    const doc = target?.contentDocument;
    if (!rendered || !target || !doc) return;
    const apply = () => {
      const page = doc.querySelector<HTMLElement>(".docx-wrapper > section");
      const pageWidth = page?.offsetWidth ?? 816;
      const fit = Math.min(1, (target.clientWidth - 24) / (pageWidth + 32));
      zoomDocument(doc, fit * zoom);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(target);
    return () => observer.disconnect();
  }, [rendered, zoom]);

  return (
    <div className="relative h-full min-h-[60vh] w-full">
      {!rendered && <p className="absolute inset-x-0 top-16 text-center text-sm text-th-muted">{t("loading")}</p>}
      <iframe
        ref={frame}
        title={t("documentFrame")}
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>${frameStyle}</style></head><body></body></html>`}
        onLoad={() => setReady(true)}
        className={`absolute inset-0 h-full w-full border-0 ${rendered ? "" : "opacity-0"}`}
      />
    </div>
  );
}

type Cell = string | number | boolean | Date | null;

/** Excel (.xlsx): each sheet as a table, one tab per sheet. Long sheets show their first rows. */
export function SheetView({ url, onFail }: ViewProps) {
  const t = useTranslations("viewer");
  const [sheets, setSheets] = useState<{ name: string; rows: Cell[][] }[] | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ default: readXlsxFile }, response] = await Promise.all([import("read-excel-file/browser"), fetch(url)]);
        if (!response.ok) throw new Error(String(response.status));
        const result = await readXlsxFile(await response.blob());
        if (!cancelled) setSheets(result.map((sheet) => ({ name: sheet.sheet, rows: sheet.data as Cell[][] })));
      } catch {
        if (!cancelled) onFail();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  if (!sheets) return <p className="py-16 text-center text-sm text-th-muted">{t("loading")}</p>;
  const sheet = sheets[active];
  return (
    <div className="flex min-h-full flex-col gap-3 p-3">
      {sheets.length > 1 && (
        <div role="tablist" aria-label={t("sheets")} className="ui-seg self-start">
          {sheets.map((s, index) => (
            <button key={s.name + index} type="button" role="tab" aria-selected={index === active} onClick={() => setActive(index)}>
              {s.name}
            </button>
          ))}
        </div>
      )}
      <Table rows={sheet?.rows ?? []} />
    </div>
  );
}

function cellText(value: Cell) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}

function Table({ rows }: { rows: Cell[][] }) {
  const t = useTranslations("viewer");
  const shown = rows.slice(0, 1000);
  const columns = Math.min(60, Math.max(0, ...shown.map((r) => r.length)));
  return (
    <div className="overflow-auto rounded-[12px] bg-th-card shadow-[0_1px_4px_rgb(0_0_0/0.08)]">
      <table className="min-w-full border-collapse text-[13px]">
        <tbody>
          {shown.map((row, r) => (
            <tr key={r} className={r === 0 ? "bg-th-fill font-semibold" : ""}>
              <th scope="row" className="sticky left-0 border-r border-b border-th-sep bg-th-sunk px-2 py-1 text-right font-normal text-th-muted">{r + 1}</th>
              {Array.from({ length: columns }, (_, c) => (
                <td key={c} className="max-w-[320px] truncate border-b border-r border-th-sep px-2 py-1 align-top whitespace-nowrap">{cellText(row[c] ?? null)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > shown.length && <p className="px-3 py-2 text-xs text-th-muted">{t("moreRows", { n: rows.length - shown.length })}</p>}
    </div>
  );
}

/** Text and CSV files (up to 2 MB). */
export function TextView({ url, csv, onFail }: ViewProps & { csv?: boolean }) {
  const t = useTranslations("viewer");
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(String(response.status));
        const body = await response.text();
        if (!cancelled) setText(body.length > 2_000_000 ? `${body.slice(0, 2_000_000)}\n…` : body);
      } catch {
        if (!cancelled) onFail();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  if (text === null) return <p className="py-16 text-center text-sm text-th-muted">{t("loading")}</p>;
  if (csv) return <div className="p-3"><Table rows={parseCsv(text)} /></div>;
  return <pre className="mx-auto max-w-[900px] p-4 font-mono text-[13px] leading-relaxed break-words whitespace-pre-wrap sm:p-6">{text}</pre>;
}

type Slide = { title: string; paragraphs: string[]; images: string[] };

/**
 * PowerPoint (.pptx): a simplified preview, slide by slide, with each slide's titles, text and pictures read
 * straight from the file (the exact layout, animations and charts need the file itself).
 */
export function SlidesView({ url, onFail }: ViewProps) {
  const t = useTranslations("viewer");
  const [slides, setSlides] = useState<Slide[] | null>(null);
  const [ratio, setRatio] = useState(9 / 16);

  useEffect(() => {
    let cancelled = false;
    const blobs: string[] = [];
    (async () => {
      try {
        const [{ default: JSZip }, response] = await Promise.all([import("jszip"), fetch(url)]);
        if (!response.ok) throw new Error(String(response.status));
        const zip = await JSZip.loadAsync(await response.arrayBuffer());
        const xml = async (path: string) => {
          const file = zip.file(path);
          return file ? new DOMParser().parseFromString(await file.async("text"), "application/xml") : null;
        };
        const rels = async (path: string) => {
          const doc = await xml(path);
          const map = new Map<string, string>();
          doc?.querySelectorAll("Relationship").forEach((r) => map.set(r.getAttribute("Id") ?? "", r.getAttribute("Target") ?? ""));
          return map;
        };
        const presentation = await xml("ppt/presentation.xml");
        const size = presentation?.getElementsByTagName("p:sldSz")[0];
        if (size) setRatio(Number(size.getAttribute("cy")) / Number(size.getAttribute("cx")) || 9 / 16);
        const presentationRels = await rels("ppt/_rels/presentation.xml.rels");
        const order = [...(presentation?.getElementsByTagName("p:sldId") ?? [])].map((s) => presentationRels.get(s.getAttribute("r:id") ?? "") ?? "");
        const result: Slide[] = [];
        for (const target of order.filter(Boolean)) {
          const path = `ppt/${target.replace(/^\/?ppt\//, "")}`;
          const doc = await xml(path);
          if (!doc) continue;
          const slideRels = await rels(path.replace(/slides\/(slide\d+\.xml)$/, "slides/_rels/$1.rels"));
          const slide: Slide = { title: "", paragraphs: [], images: [] };
          for (const shape of doc.getElementsByTagName("p:sp")) {
            const placeholder = shape.getElementsByTagName("p:ph")[0]?.getAttribute("type");
            const lines = [...shape.getElementsByTagName("a:p")]
              .map((p) => [...p.getElementsByTagName("a:t")].map((r) => r.textContent ?? "").join(""))
              .filter((line) => line.trim());
            if ((placeholder === "title" || placeholder === "ctrTitle") && !slide.title) slide.title = lines.join(" ");
            else slide.paragraphs.push(...lines);
          }
          for (const blip of doc.getElementsByTagName("a:blip")) {
            const target = slideRels.get(blip.getAttribute("r:embed") ?? "");
            const media = target && zip.file(`ppt/${target.replace(/^\.\.\//, "")}`);
            const type = target && /\.(png|jpe?g|gif|webp)$/i.exec(target)?.[1].toLowerCase();
            if (media && type) {
              const blob = new Blob([await media.async("arraybuffer")], { type: `image/${type === "jpg" ? "jpeg" : type}` });
              const objectUrl = URL.createObjectURL(blob);
              blobs.push(objectUrl);
              slide.images.push(objectUrl);
            }
          }
          result.push(slide);
        }
        if (!cancelled) setSlides(result);
      } catch {
        if (!cancelled) onFail();
      }
    })();
    return () => {
      cancelled = true;
      blobs.forEach((b) => URL.revokeObjectURL(b));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  if (!slides) return <p className="py-16 text-center text-sm text-th-muted">{t("loading")}</p>;
  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-4 p-3 sm:p-5">
      <p className="text-center text-xs text-th-muted">{t("slidesNote")}</p>
      {slides.map((slide, index) => (
        <section key={index} aria-label={t("slide", { n: index + 1 })} className="relative overflow-hidden rounded-[14px] bg-white text-[#221f20] shadow-[0_2px_12px_rgb(0_0_0/0.12)]">
          <div className="flex flex-col gap-3 p-5 sm:p-8" style={{ minHeight: `min(${ratio * 100}vw, ${ratio * 880}px)` }}>
            {slide.title && <h3 className="font-display text-xl font-bold sm:text-2xl">{slide.title}</h3>}
            {slide.paragraphs.length > 0 && (
              <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-relaxed">
                {slide.paragraphs.map((line, i) => <li key={i}>{line}</li>)}
              </ul>
            )}
            {slide.images.length > 0 && (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {slide.images.map((src, i) => <img key={i} src={src} alt="" className="max-h-[360px] w-full rounded-[8px] object-contain" />)}
              </div>
            )}
          </div>
          <span className="absolute right-3 bottom-2 text-xs text-[#5f5b5d]">{index + 1}</span>
        </section>
      ))}
    </div>
  );
}
