import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const allowedTypes: EmailOtpType[] = ["invite", "recovery", "email", "email_change"];

/**
 * Links in the invite and password-reset emails land here.
 * - supabase/templates/*.html send `token_hash` + `type` (verified here, on the server);
 * - Supabase's default reset email sends a one-time `code` (PKCE), exchanged here.
 * Links that carry tokens in the URL fragment (#access_token=…) are handled in the browser
 * by AuthLinkHandler, because the server never sees a fragment.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"), "/app");
  const supabase = await createClient();

  if (tokenHash && type && allowedTypes.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) redirect(next);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(next);
  }

  redirect("/auth/error");
}
