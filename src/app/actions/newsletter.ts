"use server";

import { getLocale } from "next-intl/server";
import { z } from "zod";
import type { ActionState } from "@/components/form";
import { createClient } from "@/lib/supabase/server";

export async function subscribeNewsletter(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ email: z.email().max(254) }).safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "invalid" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("subscribe_newsletter", {
    subscriber_email: parsed.data.email,
    subscriber_locale: await getLocale(),
  });
  return error ? { error: "failed" } : { message: "thanks" };
}
