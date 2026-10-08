"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass, inputClass, selectClass } from "./ui-classes";

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

// Shared screens (auth, admin, create forms) use the iOS-style "ui-" controls from globals.css,
// which follow the chosen theme through the --th-* tokens.
export { buttonClass, ghostButtonClass, inputClass, selectClass } from "./ui-classes";

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
      <textarea id={id} className={inputClass} rows={4} {...input} />
      {hint && <span className="text-xs">{hint}</span>}
    </label>
  );
}

export function SelectField({ label, id, children, ...input }: { label: string; id: string; children: ReactNode } & ComponentProps<"select">) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5 text-sm text-th-muted">
      {label}
      <select id={id} className={selectClass} {...input}>
        {children}
      </select>
    </label>
  );
}

export function CheckboxField({ label, id, ...input }: { label: ReactNode; id: string } & ComponentProps<"input">) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-th-fg">
      <input id={id} type="checkbox" className="ui-check -mt-px" {...input} />
      <span>{label}</span>
    </label>
  );
}

/** An on/off setting, iOS style: the words on the left, a switch on the right. */
export function SwitchField({ label, id, hint, ...input }: { label: ReactNode; id: string; hint?: ReactNode } & ComponentProps<"input">) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center justify-between gap-4 text-sm text-th-fg">
      <span className="flex flex-col gap-0.5">
        {label}
        {hint && <span className="text-xs text-th-muted">{hint}</span>}
      </span>
      <input id={id} type="checkbox" role="switch" className="ui-switch" {...input} />
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
