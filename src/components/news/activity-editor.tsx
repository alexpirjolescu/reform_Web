"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { saveActivity } from "@/app/app/admin/news/actions";
import {
  CheckboxField,
  Field,
  FormAlert,
  SelectField,
  SubmitButton,
  TextAreaField,
  ghostButtonClass,
  inputClass,
  type ActionState,
} from "@/components/form";
import { PlusIcon, TrashIcon, UploadIcon } from "@/components/icons";
import { parseLink, providerNames } from "@/lib/embeds";
import { fileSize, fromLocalInput, toLocalInput } from "@/lib/format";
import { storageSafeName } from "@/lib/library";
import { acceptedMediaTypes, fileLabel, kindOfMime, maxImageBytes, maxMediaBytes, needsConsent, type MediaItem } from "@/lib/media";
import { createClient } from "@/lib/supabase/client";
import { activityCategories, type ActivityCategory } from "@/lib/types";

export type ActivityInitial = {
  id: string;
  title: string;
  summary: string;
  body: string;
  category: ActivityCategory;
  starts_at: string;
  ends_at: string | null;
  location: string;
  cover_path: string | null;
  status: "draft" | "published";
  publish_at: string;
  photo_consent_confirmed: boolean;
  schoolIds: string[];
  media: MediaItem[];
};

const imageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

/** Staff editor for news panel activities: text, dates, schools, cover, media (files, links, social posts) and photo consent. */
export function ActivityEditor({
  initial,
  schools,
  defaultStart,
  mediaBase,
}: {
  initial: ActivityInitial | null;
  schools: { id: string; name: string }[];
  defaultStart: string;
  /** Public URL prefix of the "media" bucket, for previews. */
  mediaBase: string;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const supabase = useMemo(() => createClient(), []);
  const [state, action] = useActionState<ActionState, FormData>(saveActivity, {});
  const [title, setTitle] = useState(initial?.title ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [category, setCategory] = useState<ActivityCategory>(initial?.category ?? "workshop");
  const [startsAt, setStartsAt] = useState(toLocalInput(initial?.starts_at ?? defaultStart));
  const [endsAt, setEndsAt] = useState(initial?.ends_at ? toLocalInput(initial.ends_at) : "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [cover, setCover] = useState<string | null>(initial?.cover_path ?? null);
  const [status, setStatus] = useState(initial?.status ?? "draft");
  const [publishAt, setPublishAt] = useState(initial?.publish_at ? toLocalInput(initial.publish_at) : "");
  const [consent, setConsent] = useState(initial?.photo_consent_confirmed ?? false);
  const [schoolIds, setSchoolIds] = useState<string[]>(initial?.schoolIds ?? []);
  const [media, setMedia] = useState<MediaItem[]>(initial?.media ?? []);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [linkNote, setLinkNote] = useState<string | null>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const mediaInput = useRef<HTMLInputElement>(null);

  async function store(file: File) {
    const path = `activities/${crypto.randomUUID()}-${storageSafeName(file.name)}`;
    const { error } = await supabase.storage.from("media").upload(path, file, { contentType: file.type });
    if (error) throw error;
    return path;
  }

  async function uploadImage(file: File) {
    if (!imageTypes.includes(file.type)) throw new Error(t("adminNews.errors.imageType"));
    if (file.size > maxImageBytes) throw new Error(t("adminNews.errors.imageSize"));
    return store(file);
  }

  async function onCover(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      setCover(await uploadImage(file));
    } catch (error) {
      setUploadError((error as Error).message);
    } finally {
      setUploading(false);
      if (coverInput.current) coverInput.current.value = "";
    }
  }

  /** Photos, videos, audio and documents, one after the other; a file that fails doesn't stop the rest. */
  async function onFiles(files: File[]) {
    setUploading(true);
    setUploadError(null);
    const problems: string[] = [];
    for (const [index, file] of files.entries()) {
      setProgress(t("adminNews.media.uploadingCount", { current: index + 1, total: files.length, name: file.name }));
      const kind = kindOfMime(file.type);
      if (!kind) {
        problems.push(t("adminNews.media.badType", { name: file.name }));
        continue;
      }
      const limit = kind === "image" ? maxImageBytes : maxMediaBytes;
      if (file.size > limit) {
        problems.push(t("adminNews.media.tooLarge", { name: file.name, max: kind === "image" ? 10 : 50 }));
        continue;
      }
      try {
        const path = await store(file);
        setMedia((prev) => [...prev, { kind, path, title: file.name, caption: "", mime_type: file.type, size_bytes: file.size }]);
      } catch (error) {
        problems.push(`${file.name}: ${(error as Error).message}`);
      }
    }
    setUploadError(problems.length ? problems.join(" ") : null);
    setProgress(null);
    setUploading(false);
    if (mediaInput.current) mediaInput.current.value = "";
  }

  function addLink() {
    const parsed = parseLink(link);
    if (!parsed) {
      setLinkNote(t("adminNews.media.badLink"));
      return;
    }
    const item: MediaItem =
      parsed.kind === "embed"
        ? { kind: "embed", url: parsed.url, provider: parsed.provider, title: "", caption: "" }
        : { kind: "link", url: parsed.url, title: new URL(parsed.url).hostname.replace(/^www\./, ""), caption: "" };
    setMedia((prev) => [...prev, item]);
    setLink("");
    setLinkNote(parsed.kind === "embed" ? t("adminNews.media.recognised", { provider: providerNames[parsed.provider] }) : t("adminNews.media.plainLink"));
  }

  function move(index: number, by: number) {
    setMedia((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(index + by, 0, item);
      return next;
    });
  }

  const payload = JSON.stringify({
    id: initial?.id ?? null,
    title,
    summary,
    body,
    category,
    starts_at: fromLocalInput(startsAt),
    ends_at: endsAt ? fromLocalInput(endsAt) : null,
    location,
    cover_path: cover,
    status,
    publish_at: publishAt ? fromLocalInput(publishAt) : null,
    photo_consent_confirmed: consent,
    school_ids: schoolIds,
    media,
  });

  const card = "flex flex-col gap-4 rounded-th border-th bg-th-card p-5";
  const hasPhotos = Boolean(cover) || needsConsent(media);

  return (
    <form action={action} className="flex max-w-3xl flex-col gap-6">
      <input type="hidden" name="payload" value={payload} />

      <section className={card} aria-labelledby="act-text">
        <h2 id="act-text" className="font-display text-xl font-bold">{t("adminNews.text")}</h2>
        <Field id="act-title" label={t("adminNews.title")} value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={160} />
        <TextAreaField id="act-summary" label={t("adminNews.summary")} hint={t("adminNews.summaryHint", { count: 400 - summary.length })} rows={2} maxLength={400}
          value={summary} onChange={(e) => setSummary(e.target.value)} />
        <TextAreaField id="act-body" label={t("adminNews.body")} hint={t("adminNews.markdownHint")} rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
        <SelectField id="act-category" label={t("adminNews.category")} value={category} onChange={(e) => setCategory(e.target.value as ActivityCategory)}>
          {activityCategories.map((c) => <option key={c} value={c}>{t(`news.categories.${c}`)}</option>)}
        </SelectField>
      </section>

      <section className={card} aria-labelledby="act-when">
        <h2 id="act-when" className="font-display text-xl font-bold">{t("adminNews.whenWhere")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="act-start" type="datetime-local" label={t("adminNews.startsAt")} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
          <Field id="act-end" type="datetime-local" label={t("adminNews.endsAt")} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </div>
        <Field id="act-location" label={t("adminNews.location")} value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} />
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm text-th-muted">{t("adminNews.schools")}</legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {schools.map((school) => (
              <CheckboxField key={school.id} id={`act-school-${school.id}`} label={school.name} checked={schoolIds.includes(school.id)}
                onChange={(e) => setSchoolIds((prev) => (e.target.checked ? [...prev, school.id] : prev.filter((id) => id !== school.id)))} />
            ))}
          </div>
        </fieldset>
      </section>

      <section className={card} aria-labelledby="act-photos">
        <h2 id="act-photos" className="font-display text-xl font-bold">{t("adminNews.photos")}</h2>
        <div className="flex flex-col gap-2">
          <span className="text-sm text-th-muted">{t("adminNews.cover")}</span>
          {cover ? (
            <div className="flex flex-wrap items-end gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- preview of a just-uploaded image */}
              <img src={`${mediaBase}/${cover}`} alt="" className="h-32 w-auto rounded-th border-th object-cover" />
              <button type="button" onClick={() => setCover(null)} className={ghostButtonClass}><TrashIcon size={14} /> {t("adminNews.removeCover")}</button>
            </div>
          ) : (
            <button type="button" disabled={uploading} onClick={() => coverInput.current?.click()} className={`${ghostButtonClass} self-start`}>
              <UploadIcon size={14} /> {t("adminNews.addCover")}
            </button>
          )}
          <input ref={coverInput} type="file" accept={imageTypes.join(",")} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void onCover(e.target.files?.[0])} />
        </div>
        <div className="flex flex-col gap-3">
          <span className="text-sm text-th-muted">{t("adminNews.media.title")}</span>
          {media.length > 0 && (
            <ol className="flex flex-col gap-2">
              {media.map((item, index) => (
                <li key={`${item.path ?? item.url}-${index}`} className="flex gap-3 rounded-th border-th p-2">
                  <MediaThumb item={item} mediaBase={mediaBase} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="truncate text-sm font-medium">
                      {item.kind === "embed" && item.provider ? t("adminNews.media.embedOf", { provider: providerNames[item.provider] }) : t(`adminNews.media.kinds.${item.kind}`)}
                      <span className="font-normal text-th-muted">
                        {[item.url ? item.url.replace(/^https:\/\/(www\.)?/, "") : item.title, item.size_bytes ? fileSize(item.size_bytes, locale) : ""]
                          .filter(Boolean)
                          .map((part) => ` · ${part}`)
                          .join("")}
                      </span>
                    </span>
                    <label className="sr-only" htmlFor={`media-caption-${index}`}>{t("adminNews.media.caption")}</label>
                    <input id={`media-caption-${index}`} value={item.caption} maxLength={300} placeholder={t("adminNews.media.caption")}
                      onChange={(e) => setMedia((prev) => prev.map((m, i) => (i === index ? { ...m, caption: e.target.value } : m)))}
                      className={`${inputClass} min-h-10 text-sm`} />
                    <div className="flex flex-wrap gap-x-4 text-xs">
                      <button type="button" disabled={index === 0} onClick={() => move(index, -1)} className="min-h-8 text-th-link underline disabled:opacity-40" aria-label={t("adminNews.media.moveUpLabel", { n: index + 1 })}>
                        ↑ {t("adminNews.media.moveUp")}
                      </button>
                      <button type="button" disabled={index === media.length - 1} onClick={() => move(index, 1)} className="min-h-8 text-th-link underline disabled:opacity-40" aria-label={t("adminNews.media.moveDownLabel", { n: index + 1 })}>
                        ↓ {t("adminNews.media.moveDown")}
                      </button>
                      <button type="button" onClick={() => setMedia((prev) => prev.filter((_, i) => i !== index))} className="min-h-8 text-th-link underline">
                        {t("adminNews.media.remove")}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={uploading} onClick={() => mediaInput.current?.click()} className={ghostButtonClass}>
              <UploadIcon size={14} /> {uploading ? t("adminNews.uploading") : t("adminNews.media.upload")}
            </button>
            {progress && <span role="status" className="text-sm text-th-muted">{progress}</span>}
          </div>
          <p className="text-xs text-th-muted">{t("adminNews.media.uploadHint")}</p>
          <input ref={mediaInput} type="file" multiple accept={acceptedMediaTypes.join(",")} className="sr-only" tabIndex={-1} aria-hidden="true"
            onChange={(e) => void onFiles(Array.from(e.target.files ?? []))} />
          <div className="flex flex-wrap items-end gap-2">
            <label htmlFor="media-link" className="flex min-w-0 flex-[1_1_320px] flex-col gap-1.5 text-sm text-th-muted">
              {t("adminNews.media.linkLabel")}
              <input id="media-link" type="url" inputMode="url" value={link} placeholder="https://www.instagram.com/p/…"
                onChange={(e) => { setLink(e.target.value); setLinkNote(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }}
                className={inputClass} />
            </label>
            <button type="button" onClick={addLink} disabled={!link.trim()} className={ghostButtonClass}><PlusIcon size={14} /> {t("adminNews.media.addLink")}</button>
          </div>
          <p role="status" className="text-xs text-th-muted">{linkNote ?? t("adminNews.media.linkHint")}</p>
        </div>
        {uploadError && <FormAlert tone="error">{uploadError}</FormAlert>}
        <CheckboxField id="act-consent" checked={consent} onChange={(e) => setConsent(e.target.checked)}
          label={<><strong>{t("adminNews.consent")}</strong> {hasPhotos && !consent ? t("adminNews.consentNeeded") : ""}</>} />
      </section>

      <section className={card} aria-labelledby="act-publish">
        <h2 id="act-publish" className="font-display text-xl font-bold">{t("adminNews.publishing")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField id="act-status" label={t("adminNews.status")} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="draft">{t("adminNews.draft")}</option>
            <option value="published">{t("adminNews.published")}</option>
          </SelectField>
          <Field id="act-publish-at" type="datetime-local" label={t("adminNews.publishAt")} hint={t("adminNews.publishAtHint")} value={publishAt}
            onChange={(e) => setPublishAt(e.target.value)} />
        </div>
        {state.error && <FormAlert tone="error">{t(state.error, state.errorValues)}</FormAlert>}
        <div><SubmitButton pendingLabel={t("common.sending")}>{t("common.save")}</SubmitButton></div>
      </section>
    </form>
  );
}

/** A small preview in the editor list: the image itself, a muted video frame, or a labelled tile. */
function MediaThumb({ item, mediaBase }: { item: MediaItem; mediaBase: string }) {
  const box = "grid size-20 shrink-0 place-items-center overflow-hidden rounded-th font-display text-xs font-bold";
  if (item.kind === "image" && item.path) {
    // eslint-disable-next-line @next/next/no-img-element -- preview of an uploaded image
    return <img src={`${mediaBase}/${item.path}`} alt="" className="size-20 shrink-0 rounded-th object-cover" />;
  }
  if (item.kind === "video" && item.path) {
    return <video src={`${mediaBase}/${item.path}#t=0.5`} muted preload="metadata" className="size-20 shrink-0 rounded-th bg-ink object-cover" />;
  }
  const label = item.kind === "embed" && item.provider ? providerNames[item.provider] : item.kind === "link" ? "LINK" : item.kind === "audio" ? "AUDIO" : fileLabel(item);
  const color = item.kind === "embed" ? "bg-lavender text-white" : item.kind === "link" ? "bg-teal text-ink" : item.kind === "audio" ? "bg-honey text-ink" : "bg-vermilion text-ink";
  return <span aria-hidden="true" className={`${box} ${color} px-1 text-center leading-tight`}>{label}</span>;
}
