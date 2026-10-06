// Public values (safe in the browser). The secret key lives only in src/lib/supabase/admin.ts.
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export const hasSupabaseEnv = Boolean(supabaseUrl && supabasePublishableKey);
