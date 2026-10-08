import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { deleteFileForever, deleteFolder, restoreFile, trashFile } from "@/app/app/library/actions";
import { FolderIcon, PlayIcon } from "@/components/icons";
import { Logo } from "@/components/logo";
import { moduleButtons } from "@/components/page-header";
import { fileSize, fullDate, shortDate } from "@/lib/format";
import { badgeOf, fileKinds, kindOf, youtubeEmbed, type LibraryFile } from "@/lib/library";
import { libraryHref, type FolderSummary, type LibraryData } from "@/lib/library-server";
import type { Theme } from "@/lib/theme-shared";
import { Draggable, DropStatus, DropTarget, FolderItem } from "./library-dnd";
import { AddLinkForm, AttachToCard, CopyLinkButton, EditFileForm, MoveForm, NewFolderForm, SharePanel } from "./library-forms";
import { Uploader } from "./uploader";

type ViewProps = { data: LibraryData; locale: string };
type T = Awaited<ReturnType<typeof getTranslations>>;

const muted: Record<Theme, string> = { dark: "text-th-muted", white: "text-th-muted", color: "text-muted" };

function FileBadge({ file, variant, size = "row" }: { file: LibraryFile; variant: Theme; size?: "row" | "tile" | "chip" }) {
  const badge = badgeOf(file);
  if (size === "tile") {
    return (
      <span className="flex aspect-[4/3] items-end justify-between p-3" style={{ background: badge.bg }}>
        <span className="font-display text-[28px] font-extrabold" style={{ color: badge.fg }}>{badge.label}</span>
        <span aria-hidden="true" className="h-1.5 w-7" style={{ background: badge.fg }} />
      </span>
    );
  }
  if (size === "chip" || variant === "color") {
    return (
      <span className="grid size-12 shrink-0 place-items-center rounded-[14px] border-2 border-ink font-display text-[11px] font-extrabold" style={{ background: badge.bg, color: badge.fg }}>
        {badge.label.slice(0, 5)}
      </span>
    );
  }
  return (
    <span className="w-11 shrink-0 py-[5px] text-center font-display text-[11px] font-bold" style={{ background: badge.bg, color: badge.fg }}>
      {badge.label.slice(0, 5)}
    </span>
  );
}

function FolderBadge({ variant }: { variant: Theme }) {
  return variant === "color" ? (
    <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-[14px] border-2 border-ink bg-sand"><FolderIcon size={20} /></span>
  ) : (
    <span aria-hidden="true" className="grid w-11 shrink-0 place-items-center py-[3px] text-th-muted"><FolderIcon size={18} /></span>
  );
}

function SearchForm({ data, variant, t }: { data: LibraryData; variant: Theme; t: T }) {
  return (
    <form action="/app/library" role="search" className="flex w-full items-center sm:w-auto">
      {data.query.folder && <input type="hidden" name="folder" value={data.query.folder} />}
      {data.query.trash && <input type="hidden" name="trash" value="1" />}
      <label htmlFor="library-search" className="sr-only">{t("search")}</label>
      <input
        id="library-search"
        type="search"
        name="q"
        defaultValue={data.query.q}
        placeholder={variant === "color" ? t("searchFun") : t("searchPlaceholder")}
        className="ui-field ui-search min-w-0 sm:w-[320px]"
      />
    </form>
  );
}

function TypeFilter({ data, t }: { data: LibraryData; t: T }) {
  const kinds = (["all", ...fileKinds] as const).filter((kind) => kind === "all" || data.counts[kind] > 0 || data.query.kind === kind);
  return (
    <nav aria-label={t("fileType")} className="flex flex-wrap gap-1.5">
      {kinds.map((kind) => {
        const active = data.query.kind === kind;
        const href = libraryHref(data.query, { type: kind === "all" ? null : kind, file: null });
        const label = t(`kinds.${kind}`);
        return (
          <Link key={kind} href={href} aria-current={active ? "true" : undefined} className="ui-chip">
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** How much of the 200 MB personal space is used. */
function UsageBar({ data, variant, t, locale }: { data: LibraryData; variant: Theme; t: T; locale: string }) {
  const pct = Math.min(100, Math.round((100 * data.usage.used) / data.usage.quota));
  const full = pct >= 95;
  return (
    <div className="flex flex-col gap-1 px-2">
      <span className={`text-xs ${full ? "font-medium text-vermilion" : muted[variant]}`}>
        {t("usage", { used: fileSize(data.usage.used, locale) || "0 MB", quota: fileSize(data.usage.quota, locale) })}
      </span>
      <span
        role="meter"
        aria-label={t("usageLabel")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className={`block h-1.5 overflow-hidden ${variant === "color" ? "rounded-full border-[1.5px] border-ink" : "bg-th-sunk"}`}
      >
        <span className={`block h-full ${full ? "bg-vermilion" : variant === "color" ? "bg-pink" : "bg-teal"}`} style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}

// The folder actions: plain teal buttons that open their form in a panel below.
const toolButton = "ui-btn ui-plain justify-start cursor-pointer list-none [details[open]>&]:bg-th-fill";
const toolPanel = "ui-menu mt-2 min-w-0 p-4";

function FolderTools({ data, variant, t }: { data: LibraryData; variant: Theme; t: T }) {
  const current = data.query.trash || data.query.shared ? null : data.current;
  const inside = current?.canWrite ? { id: current.id, name: current.name } : null;
  return (
    <div className="flex flex-col gap-2">
      <details>
        <summary className={toolButton}>+ {inside ? t("newSubfolder") : t("newFolder")}</summary>
        <div className={toolPanel}><NewFolderForm schools={data.schools} isStaff={data.isStaff} parent={inside} /></div>
      </details>
      {current?.canWrite && (
        <details>
          <summary className={toolButton}>+ {t("addLink")}</summary>
          <div className={toolPanel}>
            <p className="mb-3 text-[13px]">{t("linkHint")}</p>
            <AddLinkForm folderId={current.id} />
          </div>
        </details>
      )}
      {current?.mine && (
        <details>
          <summary className={toolButton}>{t("shareFolder")}{data.currentShares.length ? ` · ${data.currentShares.length}` : ""}</summary>
          <div className={toolPanel}><SharePanel kind="folder" id={current.id} shares={data.currentShares} variant={variant} meId={data.profileId} /></div>
        </details>
      )}
      {current?.canManage && (
        <details>
          <summary className={toolButton}>{t("moveFolder")}</summary>
          <div className={toolPanel}>
            <MoveForm kind="folder" id={current.id} current={current.parentId} variant={variant}
              targets={data.moveTargets.filter((f) => current.space === "personal" ? f.space !== "personal" || data.folders.find((x) => x.id === f.id)?.mine : f.space === current.space)} />
          </div>
        </details>
      )}
      {current?.canManage && current.count === 0 && data.subfolders.length === 0 && (
        <form action={deleteFolder}>
          <input type="hidden" name="id" value={current.id} />
          <button type="submit" className="ui-btn ui-plain ui-sm ui-danger">{t("deleteFolder")}</button>
        </form>
      )}
    </div>
  );
}

function uploaderFolders(data: LibraryData) {
  return data.moveTargets.map((f) => {
    const [group, ...rest] = f.label.split(" / ");
    return { id: f.id, name: rest.join(" / ") || group, group };
  });
}

function UploadButton({ data, variant }: { data: LibraryData; variant: Theme }) {
  if (!data.writable.length || data.query.trash) return null;
  return (
    <Uploader
      variant={variant}
      folders={uploaderFolders(data)}
      currentFolderId={data.current?.canWrite && !data.query.shared ? data.current.id : null}
      profileId={data.profileId}
    />
  );
}

function PreviewMedia({ data, variant, t }: { data: LibraryData; variant: Theme; t: T }) {
  const file = data.preview;
  if (!file) return null;
  const kind = kindOf(file);
  const badge = badgeOf(file);
  const frame = variant === "color" ? "rounded-2xl border-2 border-ink overflow-hidden" : "";
  const youtube = file.external_url ? youtubeEmbed(file.external_url) : null;

  if (youtube) {
    return (
      <iframe src={youtube} title={file.name} className={`aspect-video w-full ${frame}`} allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
    );
  }
  if (kind === "video" && file.url) {
    return <video controls preload="metadata" src={file.url} className={`aspect-video w-full bg-ink ${frame}`} />;
  }
  if (kind === "images" && file.url) {
    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage
    return <img src={file.url} alt={file.description || file.name} className={`max-h-72 w-full object-contain ${variant === "color" ? "bg-sand" : "bg-th-sunk"} ${frame}`} />;
  }
  const playButton = variant === "color" ? "size-[60px] rounded-full border-2 border-ink bg-honey text-ink" : "size-14 rounded-full bg-white text-ink";
  return (
    <div className="flex flex-col gap-2">
      <div className={`relative grid aspect-video place-items-center ${frame}`} style={{ background: badge.bg }}>
        <a href={`/app/library/file/${file.id}`} target="_blank" rel="noopener noreferrer" aria-label={t("open", { name: file.name })} className={`grid place-items-center ${playButton}`}>
          <PlayIcon size={22} />
        </a>
        <span className={`absolute bottom-2 left-2 px-2 text-xs ${variant === "color" ? "rounded-full border-[1.5px] border-ink bg-white" : "bg-ink text-white"}`}>{badge.label}</span>
      </div>
      {kind === "audio" && file.url && <audio controls preload="metadata" src={file.url} className="w-full" />}
    </div>
  );
}

function PreviewActions({ data, variant, t }: { data: LibraryData; variant: Theme; t: T }) {
  const file = data.preview;
  if (!file) return null;
  const b = moduleButtons[variant];
  const ghost = `${b.ghost} w-full`;
  const summary = `${ghost} cursor-pointer list-none [details[open]>&]:bg-th-fill-2`;
  const panel = "ui-menu mt-2 min-w-0 p-3";
  return (
    <div className={`flex flex-col gap-2 ${variant === "color" ? "" : "mt-auto"}`}>
      <a
        href={file.external_url ?? `/app/library/file/${file.id}?download=1`}
        target={file.external_url ? "_blank" : undefined}
        rel={file.external_url ? "noopener noreferrer" : undefined}
        className={`${b.primary} w-full`}
      >
        {file.external_url ? t("openLink") : t("download")}
      </a>
      {file.canShare && (
        <details>
          <summary className={summary}>{t("share")}{file.shares.length ? ` · ${file.shares.length}` : ""}</summary>
          <div className={panel}><SharePanel kind="file" id={file.id} shares={file.shares} variant={variant} meId={data.profileId} /></div>
        </details>
      )}
      <AttachToCard fileId={file.id} variant={variant} className={ghost} />
      <CopyLinkButton fileId={file.id} className={ghost} />
      {file.canEdit && (
        <details>
          <summary className={summary}>{t("moveTo")}</summary>
          <div className={panel}><MoveForm kind="file" id={file.id} current={file.folder_id} targets={data.moveTargets} variant={variant} /></div>
        </details>
      )}
      {file.canEdit && (
        <details>
          <summary className={summary}>{t("edit")}</summary>
          <div className={panel}><EditFileForm file={file} /></div>
        </details>
      )}
      {file.canEdit && (
        <form action={trashFile}>
          <input type="hidden" name="id" value={file.id} />
          <button type="submit" className="ui-btn ui-plain ui-sm ui-danger w-full">{t("moveToTrash")}</button>
        </form>
      )}
    </div>
  );
}

function PreviewMeta({ data, variant, t, locale }: { data: LibraryData; variant: Theme; t: T; locale: string }) {
  const file = data.preview;
  if (!file) return null;
  if (variant === "color") {
    return (
      <div className="flex flex-col gap-1.5 px-1.5 py-0.5">
        <h2 className="font-display text-lg leading-tight font-bold break-words">{file.name}</h2>
        <span className="text-[13px] text-muted">
          {[file.size_bytes ? fileSize(file.size_bytes, locale) : null, shortDate(file.created_at, locale), file.uploaderName].filter(Boolean).join(" · ")}
        </span>
        {file.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {file.tags.map((tag) => <span key={tag} className="rounded-full border-[1.5px] border-ink px-2.5 py-0.5 text-xs">{tag}</span>)}
          </div>
        )}
        {file.description && <p className="mt-1 text-sm leading-relaxed">{file.description}</p>}
      </div>
    );
  }
  return (
    <>
      <h2 className="font-display text-[19px] leading-tight font-semibold break-words">{file.name}</h2>
      <dl className="grid grid-cols-[90px_1fr] gap-y-2 text-[13px]">
        <dt className={muted[variant]}>{t("uploadedBy")}</dt>
        <dd>{file.uploaderName ?? "—"}</dd>
        <dt className={muted[variant]}>{t("date")}</dt>
        <dd>{fullDate(file.created_at, locale)}</dd>
        {file.size_bytes > 0 && (
          <>
            <dt className={muted[variant]}>{t("size")}</dt>
            <dd>{fileSize(file.size_bytes, locale)}</dd>
          </>
        )}
        {file.folderName && (
          <>
            <dt className={muted[variant]}>{t("folder")}</dt>
            <dd>{file.folderName}</dd>
          </>
        )}
        {file.tags.length > 0 && (
          <>
            <dt className={muted[variant]}>{t("tags")}</dt>
            <dd>{file.tags.join(", ")}</dd>
          </>
        )}
      </dl>
      {file.description && <p className="text-sm leading-relaxed font-light text-th-body">{file.description}</p>}
    </>
  );
}

function TrashList({ data, variant, t, locale }: ViewProps & { variant: Theme; t: T }) {
  const b = moduleButtons[variant];
  if (!data.files.length) return <p className={muted[variant]}>{t("trashEmpty")}</p>;
  const mine = new Set(data.folders.filter((f) => f.mine).map((f) => f.id));
  return (
    <ul className="flex flex-col">
      {data.files.map((file) => (
        <li key={file.id} className={`flex flex-wrap items-center gap-3 py-3 ${variant === "color" ? "border-b border-line" : "border-b border-th-rule"}`}>
          <FileBadge file={file} variant={variant} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{file.name}</span>
            <span className={`text-xs ${muted[variant]}`}>{t("trashedOn", { date: file.deleted_at ? shortDate(file.deleted_at, locale) : "" })}</span>
          </span>
          <form action={restoreFile}>
            <input type="hidden" name="id" value={file.id} />
            <button type="submit" className={`${b.ghost} ui-sm`}>{t("restore")}</button>
          </form>
          {(data.isStaff || mine.has(file.folder_id)) && (
            <form action={deleteFileForever}>
              <input type="hidden" name="id" value={file.id} />
              <button type="submit" className={`${b.danger} ui-sm`}>{t("deleteForever")}</button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}

const resetView = { file: null, trash: null, shared: null, type: null, q: null } as const;

/** Studio folder column (dark and white): spaces as indented trees; folders take drops. */
function FolderNav({ data, variant, t, locale }: { data: LibraryData; variant: Theme; t: T; locale: string }) {
  return (
    <nav aria-label={t("foldersNav")} className="flex flex-col gap-6">
      {data.groups.map((group) => (
        <div key={group.key} className="flex flex-col">
          <span className="px-2 pb-1.5 text-xs text-th-muted">{group.label}</span>
          {group.key === "mine" && <div className="pb-2"><UsageBar data={data} variant={variant} t={t} locale={locale} /></div>}
          <ul className="flex flex-col">
            {group.tree.map(({ folder, depth }) => {
              const active = data.current?.id === folder.id && !data.query.shared;
              return (
                <FolderItem key={folder.id} as="li" id={folder.id} name={folder.name} canDrag={folder.canManage} canDrop={folder.canWrite} canUpload={folder.canWrite} profileId={data.profileId}>
                  <Link href={libraryHref(data.query, { folder: folder.id, ...resetView })} aria-current={active ? "true" : undefined} draggable={false}
                    className={`flex justify-between gap-2 rounded-[10px] py-[9px] pr-2 transition-colors ${active ? "bg-th-fill font-medium" : "hover:bg-th-fill"}`} style={{ paddingLeft: 8 + depth * 14 }}>
                    <span className="flex min-w-0 items-center gap-1.5">
                      {depth > 0 && <span aria-hidden="true" className="text-th-muted">└</span>}
                      <span className="truncate">{folder.name}</span>
                    </span>
                    <span className="text-th-muted">{folder.count}</span>
                  </Link>
                </FolderItem>
              );
            })}
          </ul>
          {group.key === "mine" && group.tree.length === 0 && <p className="px-2 text-xs text-th-muted">{t("mySpaceEmpty")}</p>}
          {group.key === "sharedWithMe" && data.sharedFileCount > 0 && (
            <Link href={libraryHref(data.query, { ...resetView, folder: null, shared: "1" })} aria-current={data.query.shared ? "true" : undefined}
              className={`flex justify-between gap-2 rounded-[10px] px-2 py-[9px] transition-colors ${data.query.shared ? "bg-th-fill font-medium" : "hover:bg-th-fill"}`}>
              <span>{t("receivedFiles")}</span>
              <span className="text-th-muted">{data.sharedFileCount}</span>
            </Link>
          )}
        </div>
      ))}
      {data.sharedFileCount > 0 && !data.groups.some((g) => g.key === "sharedWithMe") && (
        <div className="flex flex-col">
          <span className="px-2 pb-1.5 text-xs text-th-muted">{t("sharedWithMe")}</span>
          <Link href={libraryHref(data.query, { ...resetView, folder: null, shared: "1" })} aria-current={data.query.shared ? "true" : undefined}
            className={`flex justify-between gap-2 rounded-[10px] px-2 py-[9px] transition-colors ${data.query.shared ? "bg-th-fill font-medium" : "hover:bg-th-fill"}`}>
            <span>{t("receivedFiles")}</span>
            <span className="text-th-muted">{data.sharedFileCount}</span>
          </Link>
        </div>
      )}
      <Link
        href={libraryHref(data.query, { ...resetView, trash: data.query.trash ? null : "1", folder: null })}
        aria-current={data.query.trash ? "true" : undefined}
        className={`rounded-[10px] px-2 py-[9px] transition-colors hover:bg-th-fill ${data.query.trash ? "bg-th-fill font-medium text-th-fg" : "text-th-muted"}`}
      >
        {t("trashShort", { count: data.trashCount })}
      </Link>
      <FolderTools data={data} variant={variant} t={t} />
    </nav>
  );
}

function Breadcrumb({ data, t }: { data: LibraryData; t: T }) {
  if (data.query.trash) return <>{t("trash")}</>;
  if (data.query.shared) return <>{t("sharedWithMe")} / <span className="text-current">{t("receivedFiles")}</span></>;
  if (!data.current) return <>{data.query.q ? t("results", { q: data.query.q }) : t("recent")}</>;
  const group = data.groups.find((g) => g.folders.some((f) => f.id === data.current?.id));
  return (
    <nav aria-label={t("pathLabel")}>
      <ol className="flex flex-wrap items-center gap-1">
        <li>{group?.label} /</li>
        {data.path.map((folder, index) => (
          <li key={folder.id}>
            {index === data.path.length - 1 ? (
              <span className="text-current" aria-current="page">{folder.name}</span>
            ) : (
              <><Link href={libraryHref(data.query, { folder: folder.id, ...resetView })} className="underline-offset-4 hover:underline">{folder.name}</Link> /</>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Empty({ data, variant, t }: { data: LibraryData; variant: Theme; t: T }) {
  return (
    <p className={`py-6 ${muted[variant]}`}>
      {data.query.shared ? t("noReceived") : data.query.q ? t("noResults") : data.current?.canWrite ? t("emptyFolderDrop") : t("emptyFolder")}
    </p>
  );
}

/** Wraps the open folder's list so files from the computer (and library items) can be dropped on it. */
function ListDrop({ data, children, className }: { data: LibraryData; children: React.ReactNode; className?: string }) {
  const current = data.current;
  if (!current || !current.canWrite || data.query.trash || data.query.shared) return <div className={className}>{children}</div>;
  return (
    <DropTarget folderId={current.id} folderName={current.name} canUpload profileId={data.profileId} as="section" className={className}>
      {children}
    </DropTarget>
  );
}

// ---------------------------------------------------------------------------
// A · Studio (dark and white): folder column, file table, preview column
// ---------------------------------------------------------------------------
export async function LibraryStudio({ data, locale, variant: v }: ViewProps & { variant: "dark" | "white" }) {
  const t = await getTranslations("library");
  const showList = !data.query.trash;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-5 border-b border-th-line px-4 pt-[26px] pb-5 sm:px-7">
        <h1 className="font-display text-[40px] font-bold tracking-[-0.01em] text-th-heading">{t("title")}</h1>
        <div className="flex flex-wrap items-start gap-2.5">
          <SearchForm data={data} variant={v} t={t} />
          <UploadButton data={data} variant={v} />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="shrink-0 overflow-auto border-b border-th-line px-3.5 py-5 text-sm md:w-[230px] md:border-r md:border-b-0">
          <FolderNav data={data} variant={v} t={t} locale={locale} />
        </div>
        <ListDrop data={data} className="min-w-0 flex-1 overflow-auto px-4 py-[18px] sm:px-6">
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[13px] text-th-muted"><Breadcrumb data={data} t={t} /></div>
            {showList && <TypeFilter data={data} t={t} />}
          </div>
          <DropStatus className="mb-3 text-sm" />
          {data.query.trash ? (
            <TrashList data={data} variant={v} t={t} locale={locale} />
          ) : data.files.length === 0 && data.subfolders.length === 0 ? (
            <Empty data={data} variant={v} t={t} />
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs text-th-muted">
                  <th scope="col" className="border-b border-th-line p-2 font-normal">{t("colName")}</th>
                  <th scope="col" className="hidden border-b border-th-line p-2 font-normal sm:table-cell">{t("colSize")}</th>
                  <th scope="col" className="border-b border-th-line p-2 font-normal">{t("colAdded")}</th>
                </tr>
              </thead>
              <tbody>
                {data.subfolders.map((folder) => (
                  <FolderItem key={folder.id} as="tr" id={folder.id} name={folder.name} canDrag={folder.canManage} canDrop={folder.canWrite} canUpload={folder.canWrite} profileId={data.profileId}>
                    <td className="border-b border-th-rule px-2 py-3">
                      <Link href={libraryHref(data.query, { folder: folder.id, ...resetView })} draggable={false} className="flex items-center gap-3 font-medium hover:text-th-link">
                        <FolderBadge variant={v} />
                        <span className="leading-snug">{folder.name}</span>
                      </Link>
                    </td>
                    <td className="hidden border-b border-th-rule px-2 py-3 whitespace-nowrap text-th-soft sm:table-cell">{t("itemsCount", { count: folder.count })}</td>
                    <td className="border-b border-th-rule px-2 py-3 text-th-soft">—</td>
                  </FolderItem>
                ))}
                {data.files.map((file) => (
                  <Draggable key={file.id} as="tr" kind="file" id={file.id} name={file.name} className={data.preview?.id === file.id ? "bg-th-raised" : ""}>
                    <td className="border-b border-th-rule px-2 py-3">
                      <Link href={libraryHref(data.query, { file: file.id })} scroll={false} draggable={false} className="flex items-center gap-3 hover:text-th-link">
                        <FileBadge file={file} variant={v} />
                        <span className="leading-snug">{file.name}</span>
                      </Link>
                    </td>
                    <td className="hidden border-b border-th-rule px-2 py-3 whitespace-nowrap text-th-soft sm:table-cell">{file.size_bytes ? fileSize(file.size_bytes, locale) : "—"}</td>
                    <td className="border-b border-th-rule px-2 py-3 whitespace-nowrap text-th-soft">{shortDate(file.created_at, locale)}</td>
                  </Draggable>
                ))}
              </tbody>
            </table>
          )}
          {data.current?.canWrite && showList && !data.query.shared && <p className="mt-4 text-xs text-th-muted">{t("dropHintFolder")}</p>}
        </ListDrop>
        {data.preview && !data.query.trash && (
          <aside aria-label={t("preview")} className="flex shrink-0 flex-col gap-4 overflow-auto border-t border-th-line p-5 md:w-[300px] md:border-t-0 md:border-l">
            <PreviewMedia data={data} variant={v} t={t} />
            <PreviewMeta data={data} variant={v} t={t} locale={locale} />
            <PreviewActions data={data} variant={v} t={t} />
          </aside>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// C · Colour system: folder stickers, recent list, rounded preview card
// ---------------------------------------------------------------------------
const tileColors = [
  { bg: "#77bfb2", fg: "#221f20" },
  { bg: "#79569a", fg: "#ffffff" },
  { bg: "#abca54", fg: "#221f20" },
  { bg: "#e28ba3", fg: "#221f20" },
  { bg: "#e1b345", fg: "#221f20" },
  { bg: "#dd6937", fg: "#221f20" },
];

function Sticker({ folder, data, index, label }: { folder: FolderSummary; data: LibraryData; index: number; label: string }) {
  const color = tileColors[index % tileColors.length];
  const active = data.current?.id === folder.id;
  return (
    <FolderItem id={folder.id} name={folder.name} canDrag={folder.canManage} canDrop={folder.canWrite} canUpload={folder.canWrite} profileId={data.profileId} className="rounded-[22px]">
      <Link href={libraryHref(data.query, { folder: folder.id, ...resetView })} aria-current={active ? "true" : undefined} draggable={false}
        className={`flex h-full flex-col gap-1.5 rounded-[22px] border-2 border-ink px-[18px] py-4 ${active ? "ring-4 ring-ink ring-offset-2" : ""}`}
        style={{ background: color.bg, color: color.fg }}>
        <span className="font-fun text-[40px] leading-none font-bold">{folder.count}</span>
        <span className="font-display text-[17px] font-bold">{folder.name}</span>
        <span className="text-xs">{label}</span>
      </Link>
    </FolderItem>
  );
}

export async function LibraryColor({ data, locale }: ViewProps) {
  const t = await getTranslations("library");
  const v: Theme = "color";
  const listTitle: string = data.query.trash
    ? t("trash")
    : data.query.shared
      ? t("receivedFiles")
      : data.current
        ? data.current.name
        : data.query.q
          ? t("results", { q: data.query.q })
          : t("recentlyAdded");
  // Inside a folder: its subfolders. Otherwise: the top folders of every space.
  const stickers = data.current && !data.query.shared ? data.subfolders : data.groups.flatMap((g) => g.tree.filter((n) => n.depth === 0).map((n) => n.folder));
  const groupOf = (folder: FolderSummary) => data.groups.find((g) => g.folders.some((f) => f.id === folder.id))?.label ?? "";
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[22px] overflow-auto px-4 pt-6 pb-7 sm:px-7">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div className="flex flex-col gap-2.5">
          <Logo name="hub" height={30} />
          <h1 className="font-display text-[36px] font-extrabold tracking-[-0.02em]">{t("title")}</h1>
        </div>
        <div className="flex flex-wrap items-start gap-2.5">
          <SearchForm data={data} variant={v} t={t} />
          <UploadButton data={data} variant={v} />
        </div>
      </div>

      {data.current && !data.query.shared && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link href={libraryHref(data.query, { ...resetView, folder: data.current.parentId })} className="ui-btn ui-plain ui-sm -ml-2">← {t("back")}</Link>
          <span className="text-muted"><Breadcrumb data={data} t={t} /></span>
        </div>
      )}

      <nav aria-label={t("foldersNav")} className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3.5">
        {!data.current && (
          <div className="flex flex-col justify-between gap-2 rounded-[22px] border-2 border-ink bg-white px-[18px] py-4">
            <span className="font-display text-[17px] font-bold">{t("mySpace")}</span>
            <UsageBar data={data} variant={v} t={t} locale={locale} />
          </div>
        )}
        {stickers.map((folder, index) => <Sticker key={folder.id} folder={folder} data={data} index={index} label={groupOf(folder)} />)}
        {!data.current && data.sharedFileCount > 0 && (
          <Link href={libraryHref(data.query, { ...resetView, folder: null, shared: "1" })} aria-current={data.query.shared ? "true" : undefined}
            className="flex flex-col justify-end gap-1.5 rounded-[22px] border-2 border-ink bg-white px-[18px] py-4">
            <span className="font-fun text-[40px] leading-none font-bold">{data.sharedFileCount}</span>
            <span className="font-display text-[17px] font-bold">{t("receivedFiles")}</span>
            <span className="text-xs">{t("sharedWithMe")}</span>
          </Link>
        )}
        {!data.current && (
          <Link href={libraryHref(data.query, { ...resetView, trash: data.query.trash ? null : "1", folder: null })}
            aria-current={data.query.trash ? "true" : undefined}
            className={`flex flex-col justify-end gap-1.5 rounded-[22px] border-2 border-dashed border-ink px-[18px] py-4 ${data.query.trash ? "bg-sand" : ""}`}>
            <span className="font-fun text-[40px] leading-none font-bold">{data.trashCount}</span>
            <span className="font-display text-[17px] font-bold">{t("trash")}</span>
            <span className="text-xs">{t("trashHint")}</span>
          </Link>
        )}
      </nav>

      <div className="flex flex-wrap items-start gap-5">
        <ListDrop data={data} className="flex min-w-0 flex-[1_1_460px] flex-col gap-3 rounded-[22px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-extrabold">{listTitle}</h2>
            {!data.query.trash && <TypeFilter data={data} t={t} />}
          </div>
          <DropStatus className="text-sm" />
          {data.query.trash ? (
            <TrashList data={data} variant={v} t={t} locale={locale} />
          ) : data.files.length === 0 ? (
            <Empty data={data} variant={v} t={t} />
          ) : (
            <ul className="flex flex-col gap-1">
              {data.files.map((file) => {
                const selected = data.preview?.id === file.id;
                return (
                  <Draggable key={file.id} as="li" kind="file" id={file.id} name={file.name}>
                    <Link href={libraryHref(data.query, { file: file.id })} scroll={false} draggable={false}
                      className={`flex items-center gap-3.5 rounded-[18px] border-2 py-2.5 pr-3.5 pl-2.5 ${selected ? "border-ink bg-[#fbf3dc]" : "border-transparent hover:border-line"}`}>
                      <FileBadge file={file} variant={v} />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-sm font-medium break-words">{file.name}</span>
                        <span className="text-xs text-muted">
                          {[file.size_bytes ? fileSize(file.size_bytes, locale) : null, shortDate(file.created_at, locale), file.uploaderName?.split(" ")[0]].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </Link>
                  </Draggable>
                );
              })}
            </ul>
          )}
          {data.current?.canWrite && !data.query.trash && !data.query.shared && <p className="text-xs text-muted">{t("dropHintFolder")}</p>}
          <FolderTools data={data} variant={v} t={t} />
        </ListDrop>
        {data.preview && !data.query.trash && (
          <aside aria-label={t("preview")} className="flex flex-[0_1_300px] flex-col gap-3 rounded-3xl border-2 border-ink p-3.5">
            <PreviewMedia data={data} variant={v} t={t} />
            <PreviewMeta data={data} variant={v} t={t} locale={locale} />
            <PreviewActions data={data} variant={v} t={t} />
          </aside>
        )}
      </div>
    </div>
  );
}
