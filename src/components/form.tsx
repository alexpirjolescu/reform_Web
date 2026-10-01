"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";

/** State returned by server actions used with useActionState. `error` and `message` are i18n keys. */
export type ActionState = {
  error?: string;
  errorValues?: Record<string, string>;
  message?: string;
  messageValues?: Record<string, string>;
};

export function SubmitButton({ children, pendingLabel }: { children: ReactNode; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-12 bg-ink px-6 font-display text-base font-semibold text-paper transition-opacity disabled:opacity-60"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

export function Field({ label, id, ...input }: { label: string; id: string } & ComponentProps<"input">) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5 text-sm text-muted">
      {label}
      <input id={id} className="min-h-12 border border-ink bg-paper px-3 text-base text-ink" {...input} />
    </label>
  );
}

export function FormAlert({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`px-3 py-2 text-sm ${tone === "error" ? "bg-vermilion/15 text-ink" : "bg-teal/25 text-ink"}`}
    >
      {children}
    </p>
  );
}
