import { getTranslations } from "next-intl/server";
import { acceptLink } from "@/app/auth/actions";
import { getSession } from "@/lib/auth";

export async function generateMetadata() {
  const t = await getTranslations("auth.accept");
  return { title: t("title") };
}

/**
 * Where invite links point (from "copy link" in the app and from supabase/templates/*.html).
 * The one-time token is used only when the person presses the button, so link previews in chat
 * apps and email scanners, which only load the page, can't use it up.
 */
export default async function AcceptPage({ searchParams }: PageProps<"/auth/accept">) {
  const [{ token_hash: tokenHash, type }, t, session] = await Promise.all([searchParams, getTranslations("auth.accept"), getSession()]);
  const kind = type === "recovery" ? "recovery" : "invite";
  if (typeof tokenHash !== "string" || !tokenHash) {
    const e = await getTranslations("auth.error");
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-5xl font-extrabold tracking-tight">{e("title")}</h1>
        <p className="leading-relaxed">{e("body")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-5xl font-extrabold tracking-tight">{t(`${kind}Title`)}</h1>
        <p className="leading-relaxed text-th-muted">{t(`${kind}Body`)}</p>
      </div>
      {session.status !== "signed-out" && <p className="rounded-th bg-honey/40 px-3 py-2 text-sm">{t("signedInWarning")}</p>}
      <form action={acceptLink}>
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="type" value={kind} />
        <button type="submit" className="ui-btn ui-filled ui-lg w-full">{t(`${kind}Submit`)}</button>
      </form>
    </div>
  );
}
