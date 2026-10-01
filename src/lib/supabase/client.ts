import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";

/** Supabase client for Client Components. Row level security applies as the signed-in user. */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
