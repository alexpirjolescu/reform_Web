"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/form";
import { safeNextPath } from "@/lib/auth";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
  next: z.string().optional(),
});

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "auth.errors.invalidInput" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { error: "auth.errors.invalidCredentials" };

  redirect(safeNextPath(parsed.data.next));
}

export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ email: z.email() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "auth.errors.invalidInput" };

  const supabase = await createClient();
  // The email template links to /auth/confirm with a token hash; redirectTo is the fallback.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await getSiteUrl()}/auth/confirm?next=/auth/set-password`,
  });

  // Same answer whether or not the account exists, so emails can't be probed.
  return { message: "auth.forgot.sent" };
}

// Matches the database-side rule in supabase/config.toml: 10+ characters, letters and digits.
const passwordSchema = z
  .object({
    password: z.string().min(10).regex(/[a-zA-Z]/).regex(/\d/),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "mismatch" });

export async function setPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const mismatch = parsed.error.issues.some((issue) => issue.message === "mismatch");
    return { error: mismatch ? "auth.errors.mismatch" : "auth.errors.weakPassword" };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { error: "auth.errors.sessionExpired" };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { error: error.code === "weak_password" ? "auth.errors.weakPassword" : "auth.errors.generic" };
  }

  redirect("/app");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
