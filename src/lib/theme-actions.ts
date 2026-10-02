"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/env";
import { isTheme, themeCookie } from "@/lib/theme";

export async function setTheme(formData: FormData) {
  const theme = formData.get("theme");
  if (!isTheme(theme)) return;

  (await cookies()).set(themeCookie, theme, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });

  if (hasSupabaseEnv) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;
    if (userId) await supabase.from("profiles").update({ theme }).eq("id", userId);
  }

  revalidatePath("/", "layout");
}
