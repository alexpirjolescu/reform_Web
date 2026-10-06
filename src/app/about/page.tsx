import { getTranslations } from "next-intl/server";
import { paperFor } from "@/components/news/paper";
import { PublicFrame } from "@/components/public-frame";
import { getSession } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { getNewsMeta } from "@/lib/news";
import { getTheme } from "@/lib/theme";

export async function generateMetadata() {
  const t = await getTranslations("about");
  return { title: t("title") };
}

// About and contact (NP-7): mission and vision from the brandbook, partner schools, how to reach the team.
export default async function AboutPage() {
  const session = await getSession();
  const [t, theme, meta] = await Promise.all([
    getTranslations("about"),
    getTheme("profile" in session ? session.profile.theme : null),
    hasSupabaseEnv ? getNewsMeta() : Promise.resolve({ schools: [] as { id: string; name: string; city: string | null }[] }),
  ]);
  const p = paperFor(theme);
  const heading = `font-display text-4xl font-extrabold tracking-tight ${p.heading}`;
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

  return (
    <PublicFrame theme={theme} signedIn={session.status === "active"}>
      <div className="mx-auto flex max-w-3xl flex-col gap-14">
        <section className="flex flex-col gap-4">
          <h1 className={heading}>{t("missionTitle")}</h1>
          <p className="text-2xl leading-relaxed font-light">{t("mission")}</p>
        </section>
        <section className="flex flex-col gap-4">
          <h2 className={heading}>{t("visionTitle")}</h2>
          <p className="text-xl leading-relaxed font-light">{t("vision")}</p>
        </section>
        <section id="schools" className="flex scroll-mt-6 flex-col gap-4">
          <h2 className={heading}>{t("schoolsTitle")}</h2>
          {meta.schools.length ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {meta.schools.map((school) => (
                <li key={school.id} className={`px-4 py-3 ${p.listItem}`}>
                  <span className="font-medium">{school.name}</span>
                  {school.city && <span className={p.muted}> · {school.city}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className={p.muted}>{t("noSchools")}</p>
          )}
        </section>
        <section id="contact" className="flex scroll-mt-6 flex-col gap-4">
          <h2 className={heading}>{t("contactTitle")}</h2>
          <p className="text-lg leading-relaxed">{t("contactBody")}</p>
          {contactEmail ? (
            <a href={`mailto:${contactEmail}`} className="self-start font-display text-xl font-bold underline underline-offset-4">{contactEmail}</a>
          ) : (
            <p className={p.muted}>{t("contactMissing")}</p>
          )}
        </section>
      </div>
    </PublicFrame>
  );
}
