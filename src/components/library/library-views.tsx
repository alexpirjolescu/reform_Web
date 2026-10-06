import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { deleteFileForever, deleteFolder, restoreFile, trashFile } from "@/app/app/library/actions";
import { PlayIcon, SearchIcon } from "@/components/icons";
import { Logo } from "@/components/logo";
import { moduleButtons } from "@/components/page-header";
import { fileSize, fullDate, shortDate } from "@/lib/format";
import { badgeOf, fileKinds, kindOf, youtubeEmbed, type LibraryFile } from "@/lib/library";
import { libraryHref, type LibraryData } from "@/lib/library-server";
import type { Theme } from "@/lib/theme-shared";
import { AddLinkForm, AttachToCard, CopyLinkButton, EditFileForm, NewFolderForm } from "./library-forms";
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

function SearchForm({ data, variant, t }: { data: LibraryData; variant: Theme; t: T }) {
  const box = variant === "color" ? "rounded-full border-2 border-ink px-4" : "border border-th-fieldline bg-th-card px-3";
  return (
    <form action="/app/library" role="search" className={`flex h-11 items-center gap-2 ${box}`}>
      {data.query.folder && <input type="hidden" name="folder" value={data.query.folder} />}
      {data.query.trash && <input type="hidden" name="trash" value="1" />}
      <SearchIcon size={16} strokeWidth={variant === "color" ? 2.5 : 2} className={variant === "color" ? "" : "text-th-muted"} />
      <label htmlFor="library-search" className="sr-only">{t("search")}</label>
      <input
        id="library-search"
        type="search"
        name="q"
        defaultValue={data.query.q}
        placeholder={variant === "color" ? t("searchFun") : t("searchPlaceholder")}
        className={`w-full min-w-0 border-0 bg-transparent text-sm outline-offset-4 sm:w-[230px] ${variant === "color" ? "" : "text-th-fg placeholder:text-th-muted"}`}
      />
    </form>
  );
}

function TypeFilter({ data, variant, t }: { data: LibraryData; variant: Theme; t: T }) {
  const kinds = (["all", ...fileKinds] as const).filter((kind) => kind === "all" || data.counts[kind] > 0 || data.query.kind === kind);
  return (
    <nav aria-label={t("fileType")} className="flex flex-wrap gap-1.5">
      {kinds.map((kind) => {
        const active = data.query.kind === kind;
        const href = libraryHref(data.query, { type: kind === "all" ? null : kind, file: null });
        const label = t(`kinds.${kind}`);
        const cls =
          variant === "color"
            ? `rounded-full border-2 border-ink px-[13px] py-1.5 text-[13px] ${active ? "bg-ink text-white" : "bg-white"}`
            : `rounded-th border px-3 py-[7px] text-[13px] ${active ? "border-th-fg bg-th-fg text-th-bg" : "border-th-edge hover:border-th-fg"}`;
        return (
          <Link key={kind} href={href} aria-current={active ? "true" : undefined} className={cls}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function FolderTools({ data, variant, t }: { data: LibraryData; variant: Theme; t: T }) {
  const b = moduleButtons[variant];
  const canMakeFolder = data.isStaff || data.writable.some((f) => f.space === "school") || data.folders.length === 0;
  const panel = variant === "color" ? "rounded-[18px] border-2 border-ink p-4" : "bg-th-sunk p-4";
  return (
    <div className="flex flex-col gap-2">
      {canMakeFolder && (
        <details>
          <summary className={`${b.ghost} cursor-pointer list-none`}>+ {t("newFolder")}</summary>
          <div className={`mt-2 ${panel}`}><NewFolderForm schools={data.schools} isStaff={data.isStaff} /></div>
        </details>
      )}
      {data.current?.canWrite && (
        <details>
          <summary className={`${b.ghost} cursor-pointer list-none`}>+ {t("addLink")}</summary>
          <div className={`mt-2 ${panel}`}>
            <p className="mb-3 text-[13px]">{t("linkHint")}</p>
            <AddLinkForm folderId={data.current.id} />
          </div>
        </details>
      )}
      {data.isStaff && data.current && data.current.count === 0 && (
        <form action={deleteFolder}>
          <input type="hidden" name="id" value={data.current.id} />
          <button type="submit" className={`min-h-11 text-[13px] underline underline-offset-4 ${muted[variant]}`}>{t("deleteFolder")}</button>
        </form>
      )}
    </div>
  );
}

function uploaderFolders(data: LibraryData) {
  return data.writable.map((f) => ({ id: f.id, name: f.name, group: f.space === "shared" ? data.groups[0]?.label ?? "" : f.schoolName }));
}

function UploadButton({ data, variant }: { data: LibraryData; variant: Theme }) {
  if (!data.writable.length || data.query.trash) return null;
  return (
    <Uploader
      variant={variant}
      folders={uploaderFolders(data)}
      currentFolderId={data.current?.canWrite ? data.current.id : null}
      profileId={data.profileId}
    />
  );
}

function PreviewMedia({ data, variant, t }: { data: LibraryData; variant: Theme; t: T }) {
  const file = data.preview;
  if (!file) return null;
  const kind = kindOf(file);
  const badge = badgeOf(file);
  const frame =
    variant === "color" ? "rounded-2xl border-2 border-ink overflow-hidden" : "";
  const youtube = file.external_url ? youtubeEmbed(file.external_url) : null;

  if (youtube) {
    return (
      <iframe
        src={youtube}
        title={file.name}
        className={`aspect-video w-full ${frame}`}
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }
  if (kind === "video" && file.url) {
    return <video controls preload="metadata" src={file.url} className={`aspect-video w-full bg-ink ${frame}`} />;
  }
  if (kind === "images" && file.url) {
    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage
    return <img src={file.url} alt={file.description || file.name} className={`max-h-72 w-full object-contain ${variant === "color" ? "bg-sand" : "bg-th-sunk"} ${frame}`} />;
  }
  const playButton =
    variant === "color"
      ? "size-[60px] rounded-full border-2 border-ink bg-honey text-ink"
      : "size-14 rounded-full bg-white text-ink";
  return (
    <div className="flex flex-col gap-2">
      <div className={`relative grid aspect-video place-items-center ${frame}`} style={{ background: badge.bg }}>
        <a
          href={`/app/library/file/${file.id}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("open", { name: file.name })}
          className={`grid place-items-center ${playButton}`}
        >
          <PlayIcon size={22} />
        </a>
        <span className={`absolute bottom-2 left-2 px-2 text-xs ${variant === "color" ? "rounded-full border-[1.5px] border-ink bg-white" : "bg-ink text-white"}`}>
          {badge.label}
        </span>
      </div>
      {kind === "audio" && file.url && <audio controls preload="metadata" src={file.url} className="w-full" />}
    </div>
  );
}

function PreviewActions({ data, variant, t }: { data: LibraryData; variant: Theme; t: T }) {
  const file = data.preview;
  if (!file) return null;
  const b = moduleButtons[variant];
  const ghost = `${b.ghost} w-full justify-center`;
  return (
    <div className={`flex flex-col gap-2 ${variant === "color" ? "" : "mt-auto"}`}>
      <a
        href={file.external_url ?? `/app/library/file/${file.id}?download=1`}
        target={file.external_url ? "_blank" : undefined}
        rel={file.external_url ? "noopener noreferrer" : undefined}
        className={`${variant === "color" ? b.primary.replace("bg-pink", "bg-honey") : b.primary} w-full justify-center`}
      >
        {file.external_url ? t("openLink") : t("download")}
      </a>
      <AttachToCard fileId={file.id} variant={variant} className={ghost} />
      <CopyLinkButton fileId={file.id} className={ghost} />
      {file.canEdit && (
        <details>
          <summary className={`${ghost} cursor-pointer list-none`}>{t("edit")}</summary>
          <div className="mt-3"><EditFileForm file={file} /></div>
        </details>
      )}
      {file.canEdit && (
        <form action={trashFile}>
          <input type="hidden" name="id" value={file.id} />
          <button type="submit" className={`min-h-11 w-full text-[13px] underline underline-offset-4 ${muted[variant]}`}>{t("moveToTrash")}</button>
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
        <dt className={muted[variant]}>{t("folder")}</dt>
        <dd>{file.folderName}</dd>
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
            <button type="submit" className={b.ghost}>{t("restore")}</button>
          </form>
          {data.isStaff && (
            <form action={deleteFileForever}>
              <input type="hidden" name="id" value={file.id} />
              <button type="submit" className={b.danger}>{t("deleteForever")}</button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Studio folder column (dark and white); the colour design shows folder stickers instead. */
function FolderNav({ data, variant, t }: { data: LibraryData; variant: Theme; t: T }) {
  return (
    <nav aria-label={t("foldersNav")} className="flex flex-col gap-6">
      {data.groups.map((group) => (
        <div key={group.key} className="flex flex-col">
          <span className="px-2 pb-1.5 text-xs text-th-muted">{group.label}</span>
          {group.folders.map((folder) => {
            const active = data.current?.id === folder.id;
            return (
              <Link key={folder.id} href={libraryHref(data.query, { folder: folder.id, file: null, trash: null, type: null, q: null })} aria-current={active ? "true" : undefined}
                className={`flex justify-between gap-2 px-2 py-[9px] ${active ? "bg-th-raised font-medium" : "hover:text-th-link"}`}>
                <span>{folder.name}</span>
                <span className="text-th-muted">{folder.count}</span>
              </Link>
            );
          })}
        </div>
      ))}
      <Link
        href={libraryHref(data.query, { trash: data.query.trash ? null : "1", folder: null, file: null, type: null, q: null })}
        aria-current={data.query.trash ? "true" : undefined}
        className={`px-2 py-[9px] text-th-muted hover:text-th-fg ${data.query.trash ? "font-medium underline" : ""}`}
      >
        {t("trashShort", { count: data.trashCount })}
      </Link>
      <FolderTools data={data} variant={variant} t={t} />
    </nav>
  );
}

function Breadcrumb({ data, t }: { data: LibraryData; t: T }) {
  if (data.query.trash) return <>{t("trash")}</>;
  if (!data.current) return <>{data.query.q ? t("results", { q: data.query.q }) : t("recent")}</>;
  return (
    <>
      {data.current.space === "shared" ? data.groups[0]?.label : data.current.schoolName} / <span className="text-current">{data.current.name}</span>
    </>
  );
}

function Empty({ data, variant, t }: { data: LibraryData; variant: Theme; t: T }) {
  return (
    <p className={`py-6 ${muted[variant]}`}>
      {data.folders.length === 0 ? t("noFolders") : data.query.q ? t("noResults") : t("emptyFolder")}
    </p>
  );
}

// ---------------------------------------------------------------------------
// A · Studio (dark and white): folder column, file table, preview column
// ---------------------------------------------------------------------------
export async function LibraryStudio({ data, locale, variant: v }: ViewProps & { variant: "dark" | "white" }) {
  const t = await getTranslations("library");
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
        <div className="shrink-0 overflow-auto border-b border-th-line px-3.5 py-5 text-sm md:w-[210px] md:border-r md:border-b-0">
          <FolderNav data={data} variant={v} t={t} />
        </div>
        <div className="min-w-0 flex-1 overflow-auto px-4 py-[18px] sm:px-6">
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[13px] text-th-muted"><Breadcrumb data={data} t={t} /></div>
            {!data.query.trash && <TypeFilter data={data} variant={v} t={t} />}
          </div>
          {data.query.trash ? (
            <TrashList data={data} variant={v} t={t} locale={locale} />
          ) : data.files.length === 0 ? (
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
                {data.files.map((file) => (
                  <tr key={file.id} className={data.preview?.id === file.id ? "bg-th-raised" : ""}>
                    <td className="border-b border-th-rule px-2 py-3">
                      <Link href={libraryHref(data.query, { file: file.id })} scroll={false} className="flex items-center gap-3 hover:text-th-link">
                        <FileBadge file={file} variant={v} />
                        <span className="leading-snug">{file.name}</span>
                      </Link>
                    </td>
                    <td className="hidden border-b border-th-rule px-2 py-3 whitespace-nowrap text-th-soft sm:table-cell">{file.size_bytes ? fileSize(file.size_bytes, locale) : "—"}</td>
                    <td className="border-b border-th-rule px-2 py-3 whitespace-nowrap text-th-soft">{shortDate(file.created_at, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
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

export async function LibraryColor({ data, locale }: ViewProps) {
  const t = await getTranslations("library");
  const v: Theme = "color";
  const listTitle: string = data.query.trash ? t("trash") : data.current ? data.current.name : data.query.q ? t("results", { q: data.query.q }) : t("recentlyAdded");
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

      <nav aria-label={t("foldersNav")} className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3.5">
        {data.folders.map((folder, index) => {
          const color = tileColors[index % tileColors.length];
          const active = data.current?.id === folder.id;
          return (
            <Link key={folder.id} href={libraryHref(data.query, { folder: active ? null : folder.id, file: null, trash: null, type: null, q: null })}
              aria-current={active ? "true" : undefined}
              className={`flex flex-col gap-1.5 rounded-[22px] border-2 border-ink px-[18px] py-4 ${active ? "ring-4 ring-ink ring-offset-2" : ""}`}
              style={{ background: color.bg, color: color.fg }}>
              <span className="font-fun text-[40px] leading-none font-bold">{folder.count}</span>
              <span className="font-display text-[17px] font-bold">{folder.name}</span>
              <span className="text-xs">{folder.space === "shared" ? data.groups[0]?.label : folder.schoolName}</span>
            </Link>
          );
        })}
        <Link href={libraryHref(data.query, { trash: data.query.trash ? null : "1", folder: null, file: null, type: null, q: null })}
          aria-current={data.query.trash ? "true" : undefined}
          className={`flex flex-col justify-end gap-1.5 rounded-[22px] border-2 border-dashed border-ink px-[18px] py-4 ${data.query.trash ? "bg-sand" : ""}`}>
          <span className="font-fun text-[40px] leading-none font-bold">{data.trashCount}</span>
          <span className="font-display text-[17px] font-bold">{t("trash")}</span>
          <span className="text-xs">{t("trashHint")}</span>
        </Link>
      </nav>

      <div className="flex flex-wrap items-start gap-5">
        <section aria-label={listTitle} className="flex min-w-0 flex-[1_1_460px] flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-extrabold">{listTitle}</h2>
            {!data.query.trash && <TypeFilter data={data} variant={v} t={t} />}
          </div>
          {data.query.trash ? (
            <TrashList data={data} variant={v} t={t} locale={locale} />
          ) : data.files.length === 0 ? (
            <Empty data={data} variant={v} t={t} />
          ) : (
            <ul className="flex flex-col gap-1">
              {data.files.map((file) => {
                const selected = data.preview?.id === file.id;
                return (
                  <li key={file.id}>
                    <Link href={libraryHref(data.query, { file: file.id })} scroll={false}
                      className={`flex items-center gap-3.5 rounded-[18px] border-2 py-2.5 pr-3.5 pl-2.5 ${selected ? "border-ink bg-[#fbf3dc]" : "border-transparent hover:border-line"}`}>
                      <FileBadge file={file} variant={v} />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-sm font-medium break-words">{file.name}</span>
                        <span className="text-xs text-muted">
                          {[file.size_bytes ? fileSize(file.size_bytes, locale) : null, shortDate(file.created_at, locale), file.uploaderName?.split(" ")[0]].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <FolderTools data={data} variant={v} t={t} />
        </section>
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
