import { getTranslations } from "next-intl/server";
import { paperFor } from "@/components/news/paper";
import { PublicFrame } from "@/components/public-frame";
import { getSession } from "@/lib/auth";
import { getTheme } from "@/lib/theme";

export async function generateMetadata() {
  const t = await getTranslations("privacy");
  return { title: t("title") };
}

// Placeholder privacy notice: Reform must replace it with text approved by a legal adviser (PRD, privacy).
export default async function PrivacyPage() {
  const session = await getSession();
  const [t, theme] = await Promise.all([getTranslations("privacy"), getTheme("profile" in session ? session.profile.theme : null)]);
  const keys = ["data", "minors", "photos", "messages", "rights"] as const;

  return (
    <PublicFrame theme={theme} signedIn={session.status === "active"}>
      <article className="mx-auto flex max-w-3xl flex-col gap-6">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">{t("title")}</h1>
        <p className={`px-4 py-3 text-sm font-medium ${paperFor(theme).notice}`}>{t("draftNotice")}</p>
        {keys.map((key) => (
          <section key={key} className="flex flex-col gap-2">
            <h2 className="font-display text-2xl font-bold">{t(`${key}Title`)}</h2>
            <p className="leading-relaxed">{t(`${key}Body`)}</p>
          </section>
        ))}
      </article>
    </PublicFrame>
  );
}
