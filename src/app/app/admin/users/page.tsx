import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AppRole, School } from "@/lib/types";
import { InviteForm } from "./invite-form";

type UserRow = {
  id: string;
  full_name: string;
  role: AppRole;
  deactivated_at: string | null;
  school: { name: string } | null;
};

export async function generateMetadata() {
  const t = await getTranslations("admin.users");
  return { title: t("title") };
}

export default async function UsersPage() {
  await requireAdmin();
  const supabase = await createClient();
  const t = await getTranslations();

  // Row level security already limits these reads; admins can see every school and profile.
  const [{ data: schools }, { data: users }] = await Promise.all([
    supabase.from("schools").select("id, name, city").order("name").overrideTypes<School[], { merge: false }>(),
    supabase
      .from("profiles")
      .select("id, full_name, role, deactivated_at, school:schools(name)")
      .order("full_name")
      .overrideTypes<UserRow[], { merge: false }>(),
  ]);

  return (
    <div className="flex max-w-4xl flex-col gap-12">
      <h1 className="font-display text-5xl font-extrabold tracking-tight text-teal-strong">{t("admin.users.title")}</h1>

      <section aria-labelledby="invite-title" className="flex flex-col gap-5">
        <h2 id="invite-title" className="font-display text-2xl font-bold">
          {t("admin.users.inviteTitle")}
        </h2>
        {!schools?.length && <p className="text-sm text-muted">{t("admin.users.noSchools")}</p>}
        <InviteForm schools={schools ?? []} />
      </section>

      <section aria-labelledby="list-title" className="flex flex-col gap-4">
        <h2 id="list-title" className="font-display text-2xl font-bold">
          {t("admin.users.listTitle")}
        </h2>
        {users?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-2 border-ink">
                  <th scope="col" className="py-2 pr-4 font-medium">{t("admin.users.colName")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("admin.users.colRole")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("admin.users.colSchool")}</th>
                  <th scope="col" className="py-2 font-medium">{t("admin.users.colStatus")}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-line">
                    <td className="py-3 pr-4">{user.full_name || "—"}</td>
                    <td className="py-3 pr-4">{t(`roles.${user.role}`)}</td>
                    <td className="py-3 pr-4">{user.school?.name ?? "—"}</td>
                    <td className="py-3">
                      {user.deactivated_at ? t("admin.users.deactivated") : t("admin.users.active")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted">{t("admin.users.empty")}</p>
        )}
      </section>
    </div>
  );
}
