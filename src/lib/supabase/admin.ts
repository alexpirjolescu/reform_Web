import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { supabaseUrl } from "@/lib/env";

/**
 * Service-role client: bypasses row level security.
 * Only call it from server code that has already checked the caller is an admin
 * (see requireAdmin in src/lib/auth.ts). Never import it into a Client Component.
 */
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secretKey) {
    throw new Error("SUPABASE_SECRET_KEY and NEXT_PUBLIC_SUPABASE_URL must be set on the server.");
  }

  return createClient<Database>(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
