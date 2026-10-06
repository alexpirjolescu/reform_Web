"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Fragment =
  | { kind: "session"; accessToken: string; refreshToken: string; type: string | null }
  | { kind: "error" }
  | null;

/** Reads the #access_token=… or #error=… part that some Supabase email links end with. */
export function readAuthFragment(): Fragment {
  if (typeof window === "undefined" || window.location.hash.length < 2) return null;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (accessToken && refreshToken) return { kind: "session", accessToken, refreshToken, type: params.get("type") };
  if (params.get("error") || params.get("error_code")) return { kind: "error" };
  return null;
}

/**
 * Invite and reset emails that use Supabase's default templates send people back with the session
 * in the URL fragment, which the server never sees. This picks it up on any page, stores the session
 * (as cookies, so the server sees it too) and sends invited people to "choose a password".
 */
export function AuthLinkHandler() {
  useEffect(() => {
    const fragment = readAuthFragment();
    if (!fragment) return;
    if (fragment.kind === "error") {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      if (window.location.pathname !== "/auth/error") window.location.replace("/auth/error");
      return;
    }
    const supabase = createClient();
    void supabase.auth
      .setSession({ access_token: fragment.accessToken, refresh_token: fragment.refreshToken })
      .then(({ error }) => {
        if (error) return window.location.replace("/auth/error");
        const choosePassword = ["invite", "recovery", "signup", "magiclink"].includes(fragment.type ?? "invite");
        window.location.replace(choosePassword ? "/auth/set-password" : "/app");
      });
  }, []);
  return null;
}

/** On "choose a password" without a session: wait for AuthLinkHandler, or explain that the link expired. */
export function SetPasswordLinkCheck({ label }: { label: string }) {
  useEffect(() => {
    if (!readAuthFragment()) window.location.replace("/auth/error");
  }, []);
  return (
    <p role="status" className="text-th-muted">
      {label}
    </p>
  );
}
