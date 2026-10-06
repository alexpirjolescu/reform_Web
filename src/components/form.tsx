"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";

/** State returned by server actions used with useActionState. `error` and `message` are i18n keys. */
export type ActionState = {
  error?: string;
  errorValues?: Record<string, string>;
  message?: string;
  messageValues?: Record<string, string>;
  /** Changes on every successful submit so forms can reset themselves. */
  done?: number;
  /** A one-time invite link to show with a "copy" button (invitations). */
  link?: string;
};

// Shared screens (auth, admin, create forms) follow the chosen theme through the --th-* tokens in globals.css.
export const inputClass =
  "min-h-12 w-full rounded-th border-th bg-th-card px-3 text-base text-th-fg placeholder:text-th-muted disabled:opacity-60";
export const buttonClass =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-th-pill border-th bg-th-accent px-6 font-display text-base font-semibold text-th-accent-fg transition-opacity disabled:opacity-60";
export const ghostButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-th-pill border-th px-4 text-sm font-medium text-th-fg hover:bg-th-raised disabled:opacity-60";

export function SubmitButton({ children, pendingLabel, className }: { children: ReactNode; pendingLabel: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className ?? buttonClass}>
      {pending ? pendingLabel : children}
    </button>
  );
}

export function Field({ label, id, hint, ...input }: { label: string; id: string; hint?: string } & ComponentProps<"input">) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5 text-sm text-th-muted">
      {label}
      <input id={id} className={inputClass} {...input} />
      {hint && <span className="text-xs">{hint}</span>}
    </label>
  );
}

export function TextAreaField({ label, id, hint, ...input }: { label: string; id: string; hint?: string } & ComponentProps<"textarea">) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5 text-sm text-th-muted">
      {label}
      <textarea id={id} className={`${inputClass} py-2.5 leading-relaxed`} rows={4} {...input} />
      {hint && <span className="text-xs">{hint}</span>}
    </label>
  );
}

export function SelectField({ label, id, children, ...input }: { label: string; id: string; children: ReactNode } & ComponentProps<"select">) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5 text-sm text-th-muted">
      {label}
      <select id={id} className={inputClass} {...input}>
        {children}
      </select>
    </label>
  );
}

export function CheckboxField({ label, id, ...input }: { label: ReactNode; id: string } & ComponentProps<"input">) {
  return (
    <label htmlFor={id} className="flex min-h-11 items-start gap-3 text-sm text-th-fg">
      <input id={id} type="checkbox" className="mt-0.5 size-5 shrink-0 accent-teal" {...input} />
      <span>{label}</span>
    </label>
  );
}

export function FormAlert({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-th px-3 py-2 text-sm ${tone === "error" ? "bg-vermilion/20" : "bg-teal/30"}`}
    >
      {children}
    </p>
  );
}
