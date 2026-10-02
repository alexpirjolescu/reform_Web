"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
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
import { TrashIcon, UploadIcon } from "@/components/icons";
import { fromLocalInput, toLocalInput } from "@/lib/format";
import { storageSafeName } from "@/lib/library";
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
  photos: { path: string; caption: string }[];
};

const imageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const maxImage = 10 * 1024 * 1024;

/** Staff editor for news panel activities: text, dates, schools, cover, gallery and photo consent. */
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
  const [photos, setPhotos] = useState(initial?.photos ?? []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  async function uploadImage(file: File) {
    if (!imageTypes.includes(file.type)) throw new Error(t("adminNews.errors.imageType"));
    if (file.size > maxImage) throw new Error(t("adminNews.errors.imageSize"));
    const path = `activities/${crypto.randomUUID()}-${storageSafeName(file.name)}`;
    const { error } = await supabase.storage.from("media").upload(path, file, { contentType: file.type });
    if (error) throw error;
    return path;
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

  async function onGallery(files: File[]) {
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of files) {
        const path = await uploadImage(file);
        setPhotos((prev) => [...prev, { path, caption: "" }]);
      }
    } catch (error) {
      setUploadError((error as Error).message);
    } finally {
      setUploading(false);
      if (galleryInput.current) galleryInput.current.value = "";
    }
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
    photos,
  });

  const card = "flex flex-col gap-4 rounded-th border-th bg-th-card p-5";
  const hasPhotos = Boolean(cover) || photos.length > 0;

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
        <div className="flex flex-col gap-2">
          <span className="text-sm text-th-muted">{t("adminNews.gallery")}</span>
          {photos.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2">
              {photos.map((photo, index) => (
                <li key={photo.path} className="flex gap-3 rounded-th border-th p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- preview of an uploaded image */}
                  <img src={`${mediaBase}/${photo.path}`} alt="" className="size-20 shrink-0 object-cover" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <label className="sr-only" htmlFor={`caption-${index}`}>{t("adminNews.caption")}</label>
                    <input id={`caption-${index}`} value={photo.caption} maxLength={300} placeholder={t("adminNews.caption")}
                      onChange={(e) => setPhotos((prev) => prev.map((p, i) => (i === index ? { ...p, caption: e.target.value } : p)))}
                      className={`${inputClass} min-h-10 text-sm`} />
                    <button type="button" onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== index))} className="self-start text-xs text-th-link underline">
                      {t("adminNews.removePhoto")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <button type="button" disabled={uploading} onClick={() => galleryInput.current?.click()} className={`${ghostButtonClass} self-start`}>
            <UploadIcon size={14} /> {uploading ? t("adminNews.uploading") : t("adminNews.addPhotos")}
          </button>
          <input ref={galleryInput} type="file" multiple accept={imageTypes.join(",")} className="sr-only" tabIndex={-1} aria-hidden="true"
            onChange={(e) => void onGallery(Array.from(e.target.files ?? []))} />
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
