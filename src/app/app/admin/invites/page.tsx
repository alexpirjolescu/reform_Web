import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { requireStaff } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { invitableRoles, listAccountsWithoutProfile, listPendingInvites } from "@/lib/invites";
import { createClient } from "@/lib/supabase/server";
import { getTheme } from "@/lib/theme";
import type { School } from "@/lib/types";
import { InviteForm, PendingActions } from "./invite-form";

export async function generateMetadata() {
  const t = await getTranslations("admin.invites");
  return { title: t("title") };
}

// Invitations (staff and admins): invite by email or by a link to copy, and follow up on open invitations.
export default async function InvitesPage() {
  const actor = await requireStaff();
  const supabase = await createClient();
  const [t, locale, theme, { data: schools }] = await Promise.all([
    getTranslations(),
    getLocale(),
    getTheme(actor.theme),
    supabase.from("schools").select("id, name, city").order("name").overrideTypes<School[], { merge: false }>(),
  ]);

  if (!process.env.SUPABASE_SECRET_KEY) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <PageHeader variant={theme} kicker={t("nav.adminSection")} title={t("admin.invites.title")} />
        <p role="alert" className="m-4 max-w-2xl rounded-th bg-vermilion/20 px-4 py-3 sm:m-8">{t("admin.invites.missingKey")}</p>
      </div>
    );
  }

  const [pending, orphans] = await Promise.all([listPendingInvites(), actor.role === "admin" ? listAccountsWithoutProfile() : Promise.resolve([])]);
  const card = "flex flex-col gap-5 rounded-th border-th bg-th-card p-5";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader variant={theme} kicker={t("nav.adminSection")} title={t("admin.invites.title")} />
      <div className="flex max-w-5xl flex-col gap-8 px-4 py-6 sm:px-8">
        <section aria-labelledby="invite-title" className={card}>
          <div className="flex flex-col gap-1.5">
            <h2 id="invite-title" className="font-display text-2xl font-bold">{t("admin.users.inviteTitle")}</h2>
            <p className="text-sm text-th-muted">{t(actor.role === "admin" ? "admin.invites.introAdmin" : "admin.invites.introStaff")}</p>
          </div>
          {!schools?.length && <p className="text-sm text-th-muted">{t("admin.users.noSchools")}</p>}
          <InviteForm schools={schools ?? []} roles={invitableRoles(actor.role)} />
        </section>

        <section aria-labelledby="pending-title" className="flex flex-col gap-4">
          <h2 id="pending-title" className="font-display text-2xl font-bold">{t("admin.invites.pendingTitle")} · {pending.length}</h2>
          {pending.length ? (
            <ul className="flex flex-col">
              {pending.map((invite) => (
                <li key={invite.id} className="grid gap-2 border-b border-th-line py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:gap-6">
                  <div className="min-w-0">
                    <div className="font-medium">{invite.profile?.full_name || invite.email}</div>
                    <div className="truncate text-sm text-th-muted">{invite.email}</div>
                    <div className="text-xs text-th-muted">
                      {invite.profile ? t(`roles.${invite.profile.role}`) : t("admin.invites.noProfile")}
                      {invite.schoolName ? ` · ${invite.schoolName}` : ""}
                      {invite.invitedAt ? ` · ${t("admin.invites.invitedOn", { date: dateTime(invite.invitedAt, locale) })}` : ""}
                    </div>
                  </div>
                  {invite.profile ? (
                    invite.profile.role === "admin" && actor.role !== "admin" ? (
                      <p className="text-sm text-th-muted">{t("admin.invites.adminOnly")}</p>
                    ) : (
                      <PendingActions id={invite.id} email={invite.email} />
                    )
                  ) : (
                    <p className="text-sm text-th-muted">{t("admin.invites.noProfileHint")}</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-th-muted">{t("admin.invites.noPending")}</p>
          )}
        </section>

        {orphans.length > 0 && (
          <section aria-labelledby="orphans-title" className={card}>
            <h2 id="orphans-title" className="font-display text-xl font-bold">{t("admin.invites.orphansTitle")}</h2>
            <p className="text-sm text-th-muted">{t("admin.invites.orphansBody")}</p>
            <ul className="flex flex-col gap-1 text-sm">
              {orphans.map((o) => <li key={o.id} className="font-mono">{o.email}</li>)}
            </ul>
          </section>
        )}

        {actor.role === "admin" && (
          <details className={card}>
            <summary className="cursor-pointer font-display text-lg font-bold">{t("admin.invites.emailHelpTitle")}</summary>
            <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-relaxed">
              <li>{t("admin.invites.emailHelp1")}</li>
              <li>{t("admin.invites.emailHelp2")}</li>
              <li>{t("admin.invites.emailHelp3")}</li>
              <li>{t("admin.invites.emailHelp4")}</li>
            </ol>
          </details>
        )}
      </div>
    </div>
  );
}
