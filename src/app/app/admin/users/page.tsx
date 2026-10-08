import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getTheme } from "@/lib/theme";
import type { AppRole, School } from "@/lib/types";
import { setActive } from "./actions";
import { DemoCleanupForm, MemberForm, SchoolForm } from "./member-forms";

type UserRow = {
  id: string;
  full_name: string;
  role: AppRole;
  school_id: string | null;
  deactivated_at: string | null;
  school: { name: string } | null;
};

export async function generateMetadata() {
  const t = await getTranslations("admin.users");
  return { title: t("title") };
}

export default async function UsersPage({ searchParams }: PageProps<"/app/admin/users">) {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const [t, theme, { q }] = await Promise.all([getTranslations(), getTheme(admin.theme), searchParams]);
  const query = typeof q === "string" ? q.trim().toLocaleLowerCase("ro") : "";

  // Row level security already limits these reads; admins can see every school and profile.
  const [{ data: schools }, { data: users }] = await Promise.all([
    supabase.from("schools").select("id, name, city").order("name").overrideTypes<School[], { merge: false }>(),
    supabase
      .from("profiles")
      .select("id, full_name, role, school_id, deactivated_at, school:schools(name)")
      .order("full_name")
      .overrideTypes<UserRow[], { merge: false }>(),
  ]);
  const shown = (users ?? []).filter((u) => !query || `${u.full_name} ${u.school?.name ?? ""}`.toLocaleLowerCase("ro").includes(query));
  const card = "flex flex-col gap-5 rounded-th border-th bg-th-card p-5";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader variant={theme} kicker={t("nav.adminSection")} title={t("admin.users.title")} />
      <div className="flex max-w-5xl flex-col gap-8 px-4 py-6 sm:px-8">
        <Link href="/app/admin/invites" className="flex flex-wrap items-center justify-between gap-3 rounded-th border-th bg-th-card p-5 hover:bg-th-raised">
          <span className="font-display text-xl font-bold">{t("admin.users.inviteTitle")}</span>
          <span className="text-sm font-medium text-th-link">{t("admin.users.goToInvites")} →</span>
        </Link>

        <section aria-labelledby="schools-title" className={card}>
          <h2 id="schools-title" className="font-display text-2xl font-bold">{t("admin.schools.title")}</h2>
          {schools?.length ? (
            <ul className="flex flex-wrap gap-2 text-sm">
              {schools.map((s) => <li key={s.id} className="rounded-th-pill border-th px-3 py-1">{s.name}{s.city ? ` · ${s.city}` : ""}</li>)}
            </ul>
          ) : null}
          <SchoolForm />
        </section>

        <section aria-labelledby="list-title" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="list-title" className="font-display text-2xl font-bold">{t("admin.users.listTitle")} · {users?.length ?? 0}</h2>
            <form role="search" className="flex items-center gap-2">
              <label htmlFor="user-search" className="sr-only">{t("admin.users.search")}</label>
              <input id="user-search" type="search" name="q" defaultValue={typeof q === "string" ? q : ""} placeholder={t("admin.users.search")}
                className="ui-field ui-sm ui-search w-72 max-w-full" />
            </form>
          </div>
          {shown.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-th-edge">
                    <th scope="col" className="py-2 pr-4 font-medium">{t("admin.users.colName")}</th>
                    <th scope="col" className="py-2 pr-4 font-medium">{t("admin.users.colRole")} / {t("admin.users.colSchool")}</th>
                    <th scope="col" className="py-2 font-medium">{t("admin.users.colStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((user) => (
                    <tr key={user.id} className={`border-b border-th-line align-top ${user.deactivated_at ? "opacity-60" : ""}`}>
                      <td className="py-3 pr-4">
                        <div className="font-medium">{user.full_name || "—"}</div>
                        <div className="text-xs text-th-muted">{t(`roles.${user.role}`)}{user.school ? ` · ${user.school.name}` : ""}</div>
                      </td>
                      <td className="py-3 pr-4">
                        {user.id === admin.id ? <span className="text-th-muted">{t("admin.users.you")}</span> : <MemberForm id={user.id} role={user.role} schoolId={user.school_id} schools={schools ?? []} />}
                      </td>
                      <td className="py-3">
                        <div>{user.deactivated_at ? t("admin.users.deactivated") : t("admin.users.active")}</div>
                        {user.id !== admin.id && (
                          <form action={setActive}>
                            <input type="hidden" name="id" value={user.id} />
                            <input type="hidden" name="active" value={user.deactivated_at ? "1" : "0"} />
                            <button type="submit" className={`ui-btn ui-plain ui-sm -ml-2 ${user.deactivated_at ? "" : "ui-danger"}`}>
                              {user.deactivated_at ? t("admin.users.reactivate") : t("admin.users.deactivate")}
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-th-muted">{t("admin.users.empty")}</p>
          )}
        </section>

        <details className={card}>
          <summary className="cursor-pointer font-display text-xl font-bold">{t("admin.demo.title")}</summary>
          <DemoCleanupForm />
        </details>
      </div>
    </div>
  );
}
