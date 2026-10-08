"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { DndContext, KeyboardSensor, PointerSensor, closestCorners, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { inputClass } from "@/components/form";
import { GripIcon, ImageIcon, LinkIcon, PlusIcon, TrashIcon, UploadIcon } from "@/components/icons";
import { blankBlock, newKey, placements, textStyles, type BlockType, type EditorBlock, type Placement, type Width } from "@/lib/article";
import { templateBlocks, templateIds, templateSketch, type TemplateId } from "@/lib/article-templates";
import { parseLink, providerNames } from "@/lib/embeds";
import { acceptedMediaTypes, fileLabel, type MediaItem } from "@/lib/media";
import type { ActivityMedia } from "@/lib/news";
import type { Theme } from "@/lib/theme-shared";
import { ArticleBody, type ArticleBlock } from "./article-body";
import { paperFor } from "./paper";

type Setter = (update: (prev: EditorBlock[]) => EditorBlock[]) => void;
type MediaBlock = Extract<EditorBlock, { type: "media" }>;

/** What can be added between blocks. "photos" and "link" both make a media block. */
const addable = ["heading", "text", "lead", "photos", "link", "quote", "note", "button", "divider"] as const;
type Addable = (typeof addable)[number];

/** Turns an editor media item into what the public renderer shows, for the preview. */
export function previewMedia(item: MediaItem, mediaBase: string, id: string): ActivityMedia {
  return {
    id,
    kind: item.kind,
    url: item.path ? `${mediaBase}/${item.path}` : item.url ?? "",
    provider: item.provider ?? null,
    title: item.title,
    caption: item.caption,
    mimeType: item.mime_type ?? null,
    sizeBytes: item.size_bytes ?? null,
  };
}

/**
 * The article as blocks staff can add anywhere, drag into any order and place on the paper:
 * across, beside the text (left or right) or side by side. Starts from one of five templates.
 */
export function BlockEditor({
  blocks,
  setBlocks,
  upload,
  uploading,
  mediaBase,
  theme,
  locale,
  header,
}: {
  blocks: EditorBlock[];
  setBlocks: Setter;
  /** Uploads files to the media bucket; returns the items that made it (errors are shown by the parent). */
  upload: (files: File[]) => Promise<MediaItem[]>;
  uploading: boolean;
  mediaBase: string;
  theme: Theme;
  locale: string;
  header: { title: string; summary: string; coverUrl: string | null };
}) {
  const t = useTranslations("adminNews.blocks");
  const tAll = useTranslations();
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [inserting, setInserting] = useState<number | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [undo, setUndo] = useState<EditorBlock[] | null>(null);
  // A block that should open its file chooser or focus its link field right after being added.
  const [autoAction, setAutoAction] = useState<{ key: string; action: "upload" | "link" } | null>(null);
  const dndId = useId(); // stable aria ids between server and browser render
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const empty = blocks.length === 0;

  const update = (key: string, patch: Partial<EditorBlock>) =>
    setBlocks((prev) => prev.map((b) => (b.key === key ? ({ ...b, ...patch } as EditorBlock) : b)));
  const remove = (key: string) => setBlocks((prev) => prev.filter((b) => b.key !== key));
  const move = (index: number, by: number) => setBlocks((prev) => (index + by < 0 || index + by >= prev.length ? prev : arrayMove(prev, index, index + by)));

  function insert(at: number, kind: Addable) {
    let block: EditorBlock;
    if (kind === "lead" || kind === "quote" || kind === "note") block = { ...blankBlock("text"), style: kind } as EditorBlock;
    else if (kind === "photos" || kind === "link") block = blankBlock("media");
    else block = blankBlock(kind as BlockType);
    setBlocks((prev) => [...prev.slice(0, at), block, ...prev.slice(at)]);
    setInserting(null);
    if (kind === "photos" || kind === "link") setAutoAction({ key: block.key, action: kind === "photos" ? "upload" : "link" });
  }

  /** A template keeps what is already written: texts and media move into its places, in order. */
  function applyTemplate(id: TemplateId | "blank") {
    const before = blocks;
    const next = id === "blank" ? [blankBlock("text")] : templateBlocks(id, (key) => tAll(key));
    const texts = before.filter((b): b is Extract<EditorBlock, { type: "text" }> => b.type === "text" && Boolean(b.body.trim()));
    const items = before.flatMap((b) => (b.type === "media" ? b.items : []));
    for (const block of next) {
      if (block.type === "text" && texts.length) block.body = texts.shift()!.body;
      if (block.type === "media" && items.length) block.items = items.splice(0, block.place === "row" ? 3 : 1);
    }
    for (const text of texts) next.push({ ...text, key: newKey() });
    for (const item of items) next.push({ key: newKey(), type: "media", items: [item], place: "full", width: "l" });
    setBlocks(() => next);
    setUndo(before.length ? before : null);
    setShowTemplates(false);
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setBlocks((prev) => arrayMove(prev, prev.findIndex((b) => b.key === active.id), prev.findIndex((b) => b.key === over.id)));
  }

  const p = paperFor(theme);
  const preview: ArticleBlock[] = blocks.map((block) => {
    if (block.type !== "media") {
      const { key: _key, ...rest } = block;
      void _key;
      return rest as ArticleBlock;
    }
    return { type: "media", place: block.place, width: block.width, items: block.items.map((item, i) => previewMedia(item, mediaBase, `${block.key}-${i}`)) };
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label={t("modes")} className="ui-seg">
          {(["edit", "preview"] as const).map((mode) => (
            <button key={mode} type="button" role="tab" aria-selected={tab === mode} onClick={() => setTab(mode)}>
              {t(`mode_${mode}`)}
            </button>
          ))}
        </div>
        {tab === "edit" && !empty && (
          <button type="button" onClick={() => setShowTemplates((on) => !on)} aria-expanded={showTemplates} className={`ui-btn ui-sm ${showTemplates ? "ui-tinted" : "ui-gray ui-neutral"}`}>
            <GridSketchIcon /> {t("templates")}
          </button>
        )}
      </div>

      {undo && (
        <p role="status" className="flex flex-wrap items-center gap-3 rounded-[14px] bg-th-fill py-2 pr-2 pl-4 text-sm">
          {t("templateApplied")}
          <button type="button" className="ui-btn ui-filled ui-sm" onClick={() => { setBlocks(() => undo); setUndo(null); }}>{t("undo")}</button>
          <button type="button" className="ui-btn ui-plain ui-sm ui-neutral ml-auto" onClick={() => setUndo(null)}>{t("dismiss")}</button>
        </p>
      )}

      {tab === "preview" ? (
        <div className={`rounded-th border-th px-4 py-8 sm:px-10 ${p.page}`}>
          <article className="mx-auto flex max-w-3xl flex-col gap-6">
            <h1 className="font-display text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-5xl">{header.title || t("untitled")}</h1>
            {header.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- preview of the uploaded cover
              <img src={header.coverUrl} alt="" className={`aspect-[2/1] w-full object-cover ${p.media}`} />
            )}
            {header.summary && <p className="text-xl leading-relaxed font-light">{header.summary}</p>}
            <ArticleBody blocks={preview} theme={theme} locale={locale} />
          </article>
        </div>
      ) : (
        <>
          {(empty || showTemplates) && <TemplatePicker onPick={applyTemplate} replacing={!empty} />}
          <DndContext id={dndId} sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
            <SortableContext items={blocks.map((b) => b.key)} strategy={verticalListSortingStrategy}>
              <ol className="flex flex-col" aria-label={t("listLabel")}>
                <Inserter open={inserting === 0} onToggle={(on) => setInserting(on ? 0 : null)} onAdd={(kind) => insert(0, kind)} />
                {blocks.map((block, index) => (
                  <li key={block.key} className="flex flex-col">
                    <BlockCard
                      block={block}
                      index={index}
                      count={blocks.length}
                      onMove={(by) => move(index, by)}
                      onRemove={() => remove(block.key)}
                      onChange={(patch) => update(block.key, patch)}
                      upload={upload}
                      uploading={uploading}
                      mediaBase={mediaBase}
                      autoAction={autoAction?.key === block.key ? autoAction.action : null}
                      onAutoActionDone={() => setAutoAction(null)}
                    />
                    <Inserter open={inserting === index + 1} onToggle={(on) => setInserting(on ? index + 1 : null)} onAdd={(kind) => insert(index + 1, kind)} />
                  </li>
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        </>
      )}
    </div>
  );
}

function GridSketchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="18" height="6" /><rect x="3" y="12" width="8" height="9" /><path d="M14 13h7M14 17h7M14 21h5" />
    </svg>
  );
}

/** The five templates as small sketches of the page, plus "blank". */
function TemplatePicker({ onPick, replacing }: { onPick: (id: TemplateId | "blank") => void; replacing: boolean }) {
  const t = useTranslations("adminNews");
  return (
    <section aria-labelledby="tpl-title" className="flex flex-col gap-3 rounded-th border-th bg-th-sunk p-4">
      <div>
        <h3 id="tpl-title" className="font-display text-lg font-bold">{t("blocks.templatesTitle")}</h3>
        <p className="text-sm text-th-muted">{replacing ? t("blocks.templatesKeep") : t("blocks.templatesIntro")}</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {templateIds.map((id) => (
          <li key={id}>
            <button type="button" onClick={() => onPick(id)} className="flex h-full w-full flex-col gap-2 rounded-th border-th bg-th-card p-3 text-left hover:border-th-fg">
              <Sketch id={id} />
              <span className="font-display font-semibold">{t(`tpl.${id}.name`)}</span>
              <span className="text-xs text-th-muted">{t(`tpl.${id}.description`)}</span>
            </button>
          </li>
        ))}
        {!replacing && (
          <li>
            <button type="button" onClick={() => onPick("blank")} className="flex h-full min-h-32 w-full flex-col items-center justify-center gap-1 rounded-th border-2 border-dashed border-th-edge p-3 text-sm text-th-muted hover:text-th-fg">
              <PlusIcon size={18} />
              {t("blocks.blank")}
            </button>
          </li>
        )}
      </ul>
    </section>
  );
}

/** A tiny drawing of a template: grey boxes for media, lines for text. */
function Sketch({ id }: { id: TemplateId }) {
  const shapes = templateSketch(id);
  return (
    <div aria-hidden="true" className="flow-root h-36 overflow-hidden rounded-[6px] bg-white p-2">
      {shapes.map((shape, i) => {
        if (shape.type === "media") {
          if (shape.place === "row") return <div key={i} className="clear-both mb-1 grid grid-cols-3 gap-0.5">{[0, 1, 2].map((n) => <span key={n} className="h-3 bg-[#9bb9b3]" />)}</div>;
          if (shape.place === "left" || shape.place === "right")
            return <span key={i} className={`mb-0.5 block h-6 bg-[#9bb9b3] ${shape.place === "left" ? "float-left mr-1" : "float-right ml-1"} ${shape.width === "s" ? "w-1/3" : "w-1/2"}`} />;
          return <span key={i} className={`clear-both mb-1 block h-6 bg-[#9bb9b3] ${shape.width === "m" ? "mx-auto w-2/3" : ""}`} />;
        }
        if (shape.type === "heading") return <span key={i} className="clear-both mt-1 mb-0.5 block h-1.5 w-1/2 bg-[#221f20]" />;
        if (shape.type === "divider") return <span key={i} className="clear-both my-1 block h-px bg-[#221f20]" />;
        if (shape.type === "button") return <span key={i} className="clear-both mt-1 block h-2.5 w-1/4 rounded-full bg-[#e28ba3]" />;
        if (shape.style === "quote") return <span key={i} className="mb-1 block h-2 w-3/4 border-l-2 border-[#221f20] bg-[#d9d4cf]" />;
        if (shape.style === "note") return <span key={i} className="mb-1 block h-3 bg-[#f1e3b8]" />;
        return (
          <span key={i} className="mb-1 block">
            <span className={`mb-0.5 block bg-[#cfc9c3] ${shape.style === "lead" ? "h-1.5" : "h-1"}`} />
            <span className="block h-1 w-4/5 bg-[#cfc9c3]" />
          </span>
        );
      })}
    </div>
  );
}

/** A "+" between blocks that opens the list of things to add there. */
function Inserter({ open, onToggle, onAdd }: { open: boolean; onToggle: (on: boolean) => void; onAdd: (kind: Addable) => void }) {
  const t = useTranslations("adminNews.blocks");
  return (
    <div className="group flex flex-col items-center py-1.5">
      <button type="button" onClick={() => onToggle(!open)} aria-expanded={open} aria-label={t("addHere")}
        className={`ui-btn ui-sm ${open ? "ui-tinted" : "ui-plain text-th-muted opacity-80 group-hover:opacity-100 focus-visible:opacity-100"}`}>
        <PlusIcon size={13} /> {t("add")}
      </button>
      {open && (
        <div role="menu" className="ui-menu mt-1.5 grid w-full max-w-2xl grid-cols-2 gap-0.5 sm:grid-cols-3">
          {addable.map((kind) => (
            <button key={kind} type="button" role="menuitem" onClick={() => onAdd(kind)} className="ui-menu-item justify-center text-center leading-tight">
              {t(`kinds.${kind}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BlockCard({
  block,
  index,
  count,
  onMove,
  onRemove,
  onChange,
  upload,
  uploading,
  mediaBase,
  autoAction,
  onAutoActionDone,
}: {
  block: EditorBlock;
  index: number;
  count: number;
  onMove: (by: number) => void;
  onRemove: () => void;
  onChange: (patch: Partial<EditorBlock>) => void;
  upload: (files: File[]) => Promise<MediaItem[]>;
  uploading: boolean;
  mediaBase: string;
  autoAction: "upload" | "link" | null;
  onAutoActionDone: () => void;
}) {
  const t = useTranslations("adminNews.blocks");
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: block.key });
  const id = useId();
  const kindName =
    block.type === "text" ? t(`kinds.${block.style === "normal" ? "text" : block.style}`) : block.type === "media" ? t("kinds.media") : t(`kinds.${block.type}`);

  let body: ReactNode = null;
  if (block.type === "heading") {
    body = (
      <input aria-label={t("headingLabel")} value={block.text} maxLength={200} placeholder={block.hint || t("headingPlaceholder")}
        onChange={(e) => onChange({ text: e.target.value })} className={`${inputClass} font-display text-xl font-bold`} />
    );
  } else if (block.type === "text") {
    body = (
      <div className="flex flex-col gap-2">
        <div className="ui-seg self-start" role="radiogroup" aria-label={t("styleLabel")}>
          {textStyles.map((style) => (
            <button key={style} type="button" role="radio" aria-checked={block.style === style} data-on={block.style === style ? "" : undefined} onClick={() => onChange({ style })}
              className="px-2 sm:px-3.5">
              {t(`styles.${style}`)}
            </button>
          ))}
        </div>
        <textarea aria-label={t("textLabel")} value={block.body} rows={block.style === "normal" ? 5 : 3} maxLength={20000} placeholder={block.hint || t("textPlaceholder")}
          onChange={(e) => onChange({ body: e.target.value })}
          className={`${inputClass} py-3 leading-relaxed ${block.style === "lead" ? "text-lg" : block.style === "quote" ? "font-display text-lg italic" : ""}`} />
        <p className="text-xs text-th-muted">{t("markdown")}</p>
      </div>
    );
  } else if (block.type === "media") {
    body = <MediaBlockEditor block={block} onChange={onChange} upload={upload} uploading={uploading} mediaBase={mediaBase} autoAction={autoAction} onAutoActionDone={onAutoActionDone} />;
  } else if (block.type === "button") {
    body = (
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-th-muted" htmlFor={`${id}-label`}>
          {t("buttonText")}
          <input id={`${id}-label`} value={block.label} maxLength={60} placeholder={block.hint || t("buttonPlaceholder")} onChange={(e) => onChange({ label: e.target.value })} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-th-muted" htmlFor={`${id}-url`}>
          {t("buttonLink")}
          <input id={`${id}-url`} type="url" inputMode="url" value={block.url} maxLength={2000} placeholder="https://" onChange={(e) => onChange({ url: e.target.value.trim() })} className={inputClass} />
        </label>
      </div>
    );
  } else {
    body = <hr className="my-2 border-t-2 border-th-fg" />;
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }}
      className={`flex flex-col gap-3 rounded-th border-th bg-th-card p-3 sm:p-4 ${isDragging ? "opacity-80 shadow-lg" : ""}`}
      aria-label={`${index + 1}. ${kindName}`}
      role="group"
    >
      <div className="flex items-center gap-2">
        <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={t("drag", { n: index + 1 })}
          className="grid size-8 cursor-grab touch-none place-items-center rounded-full text-th-muted hover:bg-th-fill active:cursor-grabbing active:bg-th-fill-2">
          <GripIcon size={16} />
        </button>
        <span className="text-sm font-semibold">{kindName}</span>
        <span className="ml-auto flex items-center gap-1">
          <button type="button" disabled={index === 0} onClick={() => onMove(-1)} aria-label={t("moveUp", { n: index + 1 })} className="ui-btn ui-plain ui-icon ui-sm ui-neutral text-base">↑</button>
          <button type="button" disabled={index === count - 1} onClick={() => onMove(1)} aria-label={t("moveDown", { n: index + 1 })} className="ui-btn ui-plain ui-icon ui-sm ui-neutral text-base">↓</button>
          <button type="button" onClick={onRemove} aria-label={t("remove", { n: index + 1 })} className="ui-btn ui-plain ui-icon ui-sm ui-neutral"><TrashIcon size={15} /></button>
        </span>
      </div>
      {body}
    </div>
  );
}

const widthsFor = (place: Placement): Width[] => (place === "row" ? [] : place === "full" ? ["l", "m", "s"] : ["s", "m"]);

/** Photos, videos, files, links and social posts in one block, and where the block sits. */
function MediaBlockEditor({
  block,
  onChange,
  upload,
  uploading,
  mediaBase,
  autoAction,
  onAutoActionDone,
}: {
  block: MediaBlock;
  onChange: (patch: Partial<EditorBlock>) => void;
  upload: (files: File[]) => Promise<MediaItem[]>;
  uploading: boolean;
  mediaBase: string;
  autoAction: "upload" | "link" | null;
  onAutoActionDone: () => void;
}) {
  const t = useTranslations("adminNews.blocks");
  const tMedia = useTranslations("adminNews.media");
  const tNews = useTranslations("adminNews");
  const files = useRef<HTMLInputElement>(null);
  const linkInput = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const id = useId();

  // Just added from "+ photos" or "+ link": open the file chooser or focus the address field, once.
  useEffect(() => {
    if (!autoAction) return;
    if (autoAction === "upload") files.current?.click();
    else linkInput.current?.focus();
    onAutoActionDone();
  }, [autoAction, onAutoActionDone]);

  const setItems = (items: MediaItem[]) => onChange({ items } as Partial<EditorBlock>);

  async function onFiles(list: File[]) {
    if (!list.length) return;
    const added = await upload(list);
    if (added.length) {
      const items = [...block.items, ...added];
      // Several photos dropped into a single-photo block become a row.
      onChange({ items, ...(items.length > 1 && block.place === "full" ? { place: "row" as const } : {}) } as Partial<EditorBlock>);
    }
    if (files.current) files.current.value = "";
  }

  function addLink() {
    const parsed = parseLink(link);
    if (!parsed) return setNote(tMedia("badLink"));
    const item: MediaItem =
      parsed.kind === "embed"
        ? { kind: "embed", url: parsed.url, provider: parsed.provider, title: "", caption: "" }
        : { kind: "link", url: parsed.url, title: new URL(parsed.url).hostname.replace(/^www\./, ""), caption: "" };
    setItems([...block.items, item]);
    setLink("");
    setNote(parsed.kind === "embed" ? tMedia("recognised", { provider: providerNames[parsed.provider] }) : tMedia("plainLink"));
  }

  const moveItem = (index: number, by: number) => {
    const next = [...block.items];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item);
    setItems(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-sm text-th-muted">{t("placeLabel")}</legend>
        <div className="ui-seg flex w-full rounded-[14px] sm:max-w-xl">
          {placements.map((place) => (
            <button key={place} type="button" aria-pressed={block.place === place}
              onClick={() => onChange({ place, width: place === "full" ? "l" : place === "row" ? block.width : "m" } as Partial<EditorBlock>)}
              className="flex-1 basis-0 flex-col gap-1 rounded-[12px] px-1.5 py-2 text-center text-xs leading-tight whitespace-normal">
              <PlaceSketch place={place} />
              {t(`places.${place}`)}
            </button>
          ))}
        </div>
      </fieldset>
      {widthsFor(block.place).length > 0 && (
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-sm text-th-muted">{t("widthLabel")}</span>
          <div className="ui-seg" role="radiogroup" aria-label={t("widthLabel")}>
            {widthsFor(block.place).map((width) => (
              <button key={width} type="button" role="radio" aria-checked={block.width === width} data-on={block.width === width ? "" : undefined} onClick={() => onChange({ width } as Partial<EditorBlock>)}>
                {t(`widths.${width}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      {block.items.length === 0 ? (
        <div
          className="flex flex-col items-center gap-1 rounded-th border-2 border-dashed border-th-edge px-4 py-6 text-center text-sm text-th-muted"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void onFiles(Array.from(e.dataTransfer.files));
          }}
        >
          <ImageIcon size={22} />
          <span>{block.hint || t("mediaEmpty")}</span>
          <span className="text-xs">{t("mediaDrop")}</span>
        </div>
      ) : (
        <ol className="flex flex-col gap-2" aria-label={t("itemsLabel")}>
          {block.items.map((item, index) => (
            <li key={`${item.path ?? item.url}-${index}`} className="flex gap-3 rounded-th border-th p-2">
              <Thumb item={item} mediaBase={mediaBase} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="truncate text-sm font-medium">
                  {item.kind === "embed" && item.provider ? tMedia("embedOf", { provider: providerNames[item.provider] }) : tMedia(`kinds.${item.kind}`)}
                  <span className="font-normal text-th-muted"> · {item.url ? item.url.replace(/^https:\/\/(www\.)?/, "") : item.title}</span>
                </span>
                <input aria-label={tMedia("caption")} value={item.caption} maxLength={300} placeholder={tMedia("caption")}
                  onChange={(e) => setItems(block.items.map((m, i) => (i === index ? { ...m, caption: e.target.value } : m)))}
                  className="ui-field ui-sm" />
                <div className="-ml-2 flex flex-wrap gap-x-1">
                  {block.items.length > 1 && (
                    <>
                      <button type="button" disabled={index === 0} onClick={() => moveItem(index, -1)} className="ui-btn ui-plain ui-sm">← {t("itemEarlier")}</button>
                      <button type="button" disabled={index === block.items.length - 1} onClick={() => moveItem(index, 1)} className="ui-btn ui-plain ui-sm">{t("itemLater")} →</button>
                    </>
                  )}
                  <button type="button" onClick={() => setItems(block.items.filter((_, i) => i !== index))} className="ui-btn ui-plain ui-sm ui-danger">{tMedia("remove")}</button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <button type="button" disabled={uploading} onClick={() => files.current?.click()} className="ui-btn ui-tinted">
          <UploadIcon size={14} /> {uploading ? tNews("uploading") : t("upload")}
        </button>
        <input ref={files} type="file" multiple accept={acceptedMediaTypes.join(",")} className="sr-only" tabIndex={-1} aria-hidden="true" data-block-upload
          onChange={(e) => void onFiles(Array.from(e.target.files ?? []))} />
        <label htmlFor={`${id}-link`} className="flex min-w-0 flex-[1_1_260px] flex-col gap-1 text-sm text-th-muted">
          <span className="inline-flex items-center gap-1"><LinkIcon size={14} /> {t("linkLabel")}</span>
          <input id={`${id}-link`} ref={linkInput} type="url" inputMode="url" value={link} placeholder="https://www.instagram.com/p/…"
            onChange={(e) => { setLink(e.target.value); setNote(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }}
            className={inputClass} />
        </label>
        <button type="button" onClick={addLink} disabled={!link.trim()} className="ui-btn ui-tinted"><PlusIcon size={14} /> {tMedia("addLink")}</button>
      </div>
      {note && <p role="status" className="text-xs text-th-muted">{note}</p>}
    </div>
  );
}

/** Little picture of each placement: where the media (grey) sits against the text (lines). */
function PlaceSketch({ place }: { place: Placement }) {
  const box = "fill-current opacity-60";
  return (
    <svg width="44" height="28" viewBox="0 0 44 28" aria-hidden="true">
      {place === "full" && <><rect x="2" y="2" width="40" height="14" className={box} /><rect x="2" y="19" width="40" height="2" className="fill-current" /><rect x="2" y="24" width="30" height="2" className="fill-current" /></>}
      {place === "left" && <><rect x="2" y="2" width="18" height="16" className={box} /><rect x="23" y="3" width="19" height="2" className="fill-current" /><rect x="23" y="8" width="19" height="2" className="fill-current" /><rect x="23" y="13" width="19" height="2" className="fill-current" /><rect x="2" y="22" width="40" height="2" className="fill-current" /></>}
      {place === "right" && <><rect x="24" y="2" width="18" height="16" className={box} /><rect x="2" y="3" width="19" height="2" className="fill-current" /><rect x="2" y="8" width="19" height="2" className="fill-current" /><rect x="2" y="13" width="19" height="2" className="fill-current" /><rect x="2" y="22" width="40" height="2" className="fill-current" /></>}
      {place === "row" && <><rect x="2" y="4" width="12" height="12" className={box} /><rect x="16" y="4" width="12" height="12" className={box} /><rect x="30" y="4" width="12" height="12" className={box} /><rect x="2" y="21" width="40" height="2" className="fill-current" /></>}
    </svg>
  );
}

function Thumb({ item, mediaBase }: { item: MediaItem; mediaBase: string }) {
  const box = "grid size-16 shrink-0 place-items-center overflow-hidden rounded-th font-display text-xs font-bold";
  if (item.kind === "image" && item.path) {
    // eslint-disable-next-line @next/next/no-img-element -- preview of an uploaded image
    return <img src={`${mediaBase}/${item.path}`} alt="" className="size-16 shrink-0 rounded-th object-cover" />;
  }
  if (item.kind === "video" && item.path) {
    return <video src={`${mediaBase}/${item.path}#t=0.5`} muted preload="metadata" className="size-16 shrink-0 rounded-th bg-ink object-cover" />;
  }
  const label = item.kind === "embed" && item.provider ? providerNames[item.provider] : item.kind === "link" ? "LINK" : item.kind === "audio" ? "AUDIO" : fileLabel(item);
  const color = item.kind === "embed" ? "bg-lavender text-white" : item.kind === "link" ? "bg-teal text-ink" : item.kind === "audio" ? "bg-honey text-ink" : "bg-vermilion text-ink";
  return <span aria-hidden="true" className={`${box} ${color} px-1 text-center leading-tight`}>{label}</span>;
}
