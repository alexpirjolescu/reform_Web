"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { saveAssessment } from "@/app/app/assessments/actions";
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
import { PlusIcon, TrashIcon } from "@/components/icons";
import type { QuestionKind } from "@/lib/assessments";
import { fromLocalInput, toLocalInput } from "@/lib/format";

type Choice = { key: string; label: string; correct: boolean };
type Question = { key: string; kind: QuestionKind; prompt: string; points: number; choices: Choice[] };

export type EditorInitial = {
  id: string;
  title: string;
  kind: "quiz" | "assignment";
  instructions: string;
  activity_id: string | null;
  opens_at: string;
  closes_at: string;
  max_attempts: number;
  show_answers: "after_submit" | "after_close" | "never";
  allow_late: boolean;
  status: "draft" | "published";
  schoolIds: string[];
  questions: { kind: QuestionKind; prompt: string; points: number; choices: { label: string; correct: boolean }[] }[];
  attemptCount: number;
};

let counter = 0;
// Initial items get index keys (stable during hydration); new ones a running number.
const key = () => `n${++counter}`;

/** Staff builder for quizzes and assignments (AS-1 to AS-4). */
export function AssessmentEditor({
  initial,
  schools,
  activities,
  defaultWindow,
}: {
  initial: EditorInitial | null;
  schools: { id: string; name: string }[];
  activities: { id: string; title: string; date: string }[];
  /** Computed on the server so the first render matches during hydration. */
  defaultWindow: { opens_at: string; closes_at: string };
}) {
  const t = useTranslations();
  const [state, action] = useActionState<ActionState, FormData>(saveAssessment, {});
  const locked = (initial?.attemptCount ?? 0) > 0;

  const [title, setTitle] = useState(initial?.title ?? "");
  const [kind, setKind] = useState<"quiz" | "assignment">(initial?.kind ?? "quiz");
  const [instructions, setInstructions] = useState(initial?.instructions ?? "");
  const [activityId, setActivityId] = useState(initial?.activity_id ?? "");
  const [opensAt, setOpensAt] = useState(toLocalInput(initial?.opens_at ?? defaultWindow.opens_at));
  const [closesAt, setClosesAt] = useState(toLocalInput(initial?.closes_at ?? defaultWindow.closes_at));
  const [maxAttempts, setMaxAttempts] = useState(initial?.max_attempts ?? 1);
  const [showAnswers, setShowAnswers] = useState(initial?.show_answers ?? "after_close");
  const [allowLate, setAllowLate] = useState(initial?.allow_late ?? true);
  const [status, setStatus] = useState(initial?.status ?? "draft");
  const [schoolIds, setSchoolIds] = useState<string[]>(initial?.schoolIds ?? []);
  const [questions, setQuestions] = useState<Question[]>(
    (initial?.questions ?? []).map((q, qi) => ({ ...q, key: `q${qi}`, choices: q.choices.map((c, ci) => ({ ...c, key: `q${qi}c${ci}` })) })),
  );

  const trueFalse = (): Choice[] => [
    { key: key(), label: t("assessments.editor.true"), correct: true },
    { key: key(), label: t("assessments.editor.false"), correct: false },
  ];

  function addQuestion(kind: QuestionKind) {
    const choices =
      kind === "open"
        ? []
        : kind === "true_false"
          ? trueFalse()
          : [
              { key: key(), label: "", correct: true },
              { key: key(), label: "", correct: false },
            ];
    setQuestions((prev) => [...prev, { key: key(), kind, prompt: "", points: kind === "open" ? 2 : 1, choices }]);
  }

  const patchQuestion = (k: string, patch: Partial<Question>) => setQuestions((prev) => prev.map((q) => (q.key === k ? { ...q, ...patch } : q)));

  function move(k: string, by: number) {
    setQuestions((prev) => {
      const index = prev.findIndex((q) => q.key === k);
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(Math.max(0, Math.min(next.length, index + by)), 0, item);
      return next;
    });
  }

  function setCorrect(q: Question, choiceKey: string, value: boolean) {
    const single = q.kind !== "multiple";
    patchQuestion(q.key, {
      choices: q.choices.map((c) => (c.key === choiceKey ? { ...c, correct: value } : single && value ? { ...c, correct: false } : c)),
    });
  }

  const payload = JSON.stringify({
    id: initial?.id ?? null,
    title,
    kind,
    instructions,
    activity_id: activityId || null,
    opens_at: fromLocalInput(opensAt),
    closes_at: fromLocalInput(closesAt),
    max_attempts: maxAttempts,
    show_answers: showAnswers,
    allow_late: allowLate,
    status,
    school_ids: schoolIds,
    questions:
      kind === "quiz"
        ? questions.map((q) => ({ kind: q.kind, prompt: q.prompt, points: q.points, choices: q.kind === "open" ? [] : q.choices.map((c) => ({ label: c.label, correct: c.correct })) }))
        : [],
  });

  const card = "flex flex-col gap-4 rounded-th border-th bg-th-card p-5";
  const totalPoints = questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0);

  return (
    <form action={action} className="flex max-w-3xl flex-col gap-6">
      <input type="hidden" name="payload" value={payload} />

      <section className={card} aria-labelledby="ed-basics">
        <h2 id="ed-basics" className="font-display text-xl font-bold">{t("assessments.editor.basics")}</h2>
        <Field id="ed-title" label={t("assessments.editor.title")} value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={160} />
        <fieldset className="flex flex-col gap-2" disabled={locked}>
          <legend className="mb-1 text-sm text-th-muted">{t("assessments.editor.kind")}</legend>
          <div className="flex flex-wrap gap-4">
            {(["quiz", "assignment"] as const).map((k) => (
              <label key={k} className="flex min-h-11 items-center gap-2 text-sm">
                <input type="radio" name="ed-kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="size-5 accent-teal" />
                {t(`assessments.kinds.${k}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <TextAreaField id="ed-instructions" label={t("assessments.editor.instructions")} hint={t("assessments.editor.markdownHint")} rows={6}
          value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={20000} />
        <SelectField id="ed-activity" label={t("assessments.editor.activity")} value={activityId} onChange={(e) => setActivityId(e.target.value)}>
          <option value="">{t("assessments.editor.noActivity")}</option>
          {activities.map((a) => (
            <option key={a.id} value={a.id}>{a.date} · {a.title}</option>
          ))}
        </SelectField>
      </section>

      <section className={card} aria-labelledby="ed-rules">
        <h2 id="ed-rules" className="font-display text-xl font-bold">{t("assessments.editor.rules")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="ed-opens" type="datetime-local" label={t("assessments.editor.opensAt")} value={opensAt} onChange={(e) => setOpensAt(e.target.value)} required />
          <Field id="ed-closes" type="datetime-local" label={t("assessments.editor.closesAt")} value={closesAt} onChange={(e) => setClosesAt(e.target.value)} required />
          <Field id="ed-attempts" type="number" min={1} max={10} label={t("assessments.editor.maxAttempts")} value={maxAttempts}
            onChange={(e) => setMaxAttempts(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} />
          <SelectField id="ed-show" label={t("assessments.editor.showAnswers")} value={showAnswers}
            onChange={(e) => setShowAnswers(e.target.value as typeof showAnswers)}>
            <option value="after_submit">{t("assessments.editor.show.after_submit")}</option>
            <option value="after_close">{t("assessments.editor.show.after_close")}</option>
            <option value="never">{t("assessments.editor.show.never")}</option>
          </SelectField>
        </div>
        <CheckboxField id="ed-late" label={t("assessments.editor.allowLate")} checked={allowLate} onChange={(e) => setAllowLate(e.target.checked)} />
        <p className="text-xs text-th-muted">{t("assessments.editor.timezone")}</p>
      </section>

      <section className={card} aria-labelledby="ed-schools">
        <h2 id="ed-schools" className="font-display text-xl font-bold">{t("assessments.editor.schools")}</h2>
        {schools.length === 0 && <p className="text-sm text-th-muted">{t("assessments.editor.noSchools")}</p>}
        <div className="grid gap-1 sm:grid-cols-2">
          {schools.map((school) => (
            <CheckboxField key={school.id} id={`ed-school-${school.id}`} label={school.name} checked={schoolIds.includes(school.id)}
              onChange={(e) => setSchoolIds((prev) => (e.target.checked ? [...prev, school.id] : prev.filter((id) => id !== school.id)))} />
          ))}
        </div>
      </section>

      {kind === "quiz" && (
        <section className={card} aria-labelledby="ed-questions">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="ed-questions" className="font-display text-xl font-bold">{t("assessments.editor.questions")}</h2>
            <span className="text-sm text-th-muted">{t("assessments.editor.totalPoints", { points: totalPoints })}</span>
          </div>
          {locked && <FormAlert tone="error">{t("assessments.editor.locked")}</FormAlert>}
          <fieldset disabled={locked} className="flex flex-col gap-4">
            {questions.map((q, index) => (
              <div key={q.key} className="flex flex-col gap-3 rounded-th border-th p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-lg font-bold">{index + 1}.</span>
                  <span className="text-sm text-th-muted">{t(`assessments.questionKinds.${q.kind}`)}</span>
                  <span className="ml-auto flex gap-1">
                    <button type="button" onClick={() => move(q.key, -1)} disabled={index === 0} aria-label={t("assessments.editor.moveUp")} className="grid size-11 place-items-center disabled:opacity-30">↑</button>
                    <button type="button" onClick={() => move(q.key, 1)} disabled={index === questions.length - 1} aria-label={t("assessments.editor.moveDown")} className="grid size-11 place-items-center disabled:opacity-30">↓</button>
                    <button type="button" onClick={() => setQuestions((prev) => prev.filter((x) => x.key !== q.key))} aria-label={t("assessments.editor.removeQuestion", { n: index + 1 })} className="grid size-11 place-items-center"><TrashIcon size={16} /></button>
                  </span>
                </div>
                <TextAreaField id={`q-${q.key}`} label={t("assessments.editor.prompt")} rows={2} value={q.prompt} maxLength={2000}
                  onChange={(e) => patchQuestion(q.key, { prompt: e.target.value })} />
                <div className="max-w-40">
                  <Field id={`p-${q.key}`} type="number" min={0} max={1000} step={0.5} label={t("assessments.editor.points")} value={q.points}
                    onChange={(e) => patchQuestion(q.key, { points: Number(e.target.value) })} />
                </div>
                {q.kind !== "open" && (
                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-1 text-sm text-th-muted">
                      {q.kind === "multiple" ? t("assessments.editor.choicesMultiple") : t("assessments.editor.choicesSingle")}
                    </legend>
                    {q.choices.map((choice, ci) => (
                      <div key={choice.key} className="flex items-center gap-2">
                        <input
                          type={q.kind === "multiple" ? "checkbox" : "radio"}
                          name={`correct-${q.key}`}
                          checked={choice.correct}
                          onChange={(e) => setCorrect(q, choice.key, e.target.checked)}
                          aria-label={t("assessments.editor.markCorrect", { letter: String.fromCharCode(65 + ci) })}
                          className="size-5 shrink-0 accent-teal"
                        />
                        <label className="sr-only" htmlFor={`c-${choice.key}`}>{t("assessments.editor.choice", { letter: String.fromCharCode(65 + ci) })}</label>
                        <input id={`c-${choice.key}`} value={choice.label} maxLength={500} readOnly={q.kind === "true_false"}
                          onChange={(e) => patchQuestion(q.key, { choices: q.choices.map((c) => (c.key === choice.key ? { ...c, label: e.target.value } : c)) })}
                          className={inputClass} placeholder={t("assessments.editor.choice", { letter: String.fromCharCode(65 + ci) })} />
                        {q.kind !== "true_false" && q.choices.length > 2 && (
                          <button type="button" onClick={() => patchQuestion(q.key, { choices: q.choices.filter((c) => c.key !== choice.key) })}
                            aria-label={t("assessments.editor.removeChoice")} className="grid size-11 shrink-0 place-items-center"><TrashIcon size={16} /></button>
                        )}
                      </div>
                    ))}
                    {q.kind !== "true_false" && q.choices.length < 12 && (
                      <button type="button" onClick={() => patchQuestion(q.key, { choices: [...q.choices, { key: key(), label: "", correct: false }] })}
                        className={`${ghostButtonClass} self-start`}><PlusIcon size={14} /> {t("assessments.editor.addChoice")}</button>
                    )}
                  </fieldset>
                )}
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              {(["single", "multiple", "true_false", "open"] as const).map((k) => (
                <button key={k} type="button" onClick={() => addQuestion(k)} className={ghostButtonClass}>
                  <PlusIcon size={14} /> {t(`assessments.questionKinds.${k}`)}
                </button>
              ))}
            </div>
          </fieldset>
        </section>
      )}

      <section className={card} aria-labelledby="ed-publish">
        <h2 id="ed-publish" className="font-display text-xl font-bold">{t("assessments.editor.publishing")}</h2>
        <SelectField id="ed-status" label={t("assessments.editor.status")} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="draft">{t("assessments.editor.draft")}</option>
          <option value="published">{t("assessments.editor.published")}</option>
        </SelectField>
        {state.error && <FormAlert tone="error">{t(state.error, state.errorValues)}</FormAlert>}
        <div><SubmitButton pendingLabel={t("common.sending")}>{t("common.save")}</SubmitButton></div>
      </section>
    </form>
  );
}
