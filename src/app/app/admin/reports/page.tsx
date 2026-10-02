import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader, moduleButtons } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth";
import { dateTime, shortDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getTheme } from "@/lib/theme";
import { resolveReport } from "./actions";

export async function generateMetadata() {
  const t = await getTranslations("admin.reports");
  return { title: t("title") };
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reported conversations (MSG safety). Reading one is logged in the audit log by the database function. */
export default async function ReportsPage({ searchParams }: PageProps<"/app/admin/reports">) {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const [{ report }, theme, locale, t] = await Promise.all([searchParams, getTheme(admin.theme), getLocale(), getTranslations("admin.reports")]);
  const b = moduleButtons[theme];

  const { data: reports } = await supabase
    .from("message_reports")
    .select("id, conversation_id, reason, status, created_at, reviewed_at, reporter:profiles!message_reports_reporter_id_fkey(full_name)")
    .order("status")
    .order("created_at", { ascending: false });

  const openId = typeof report === "string" && uuid.test(report) ? report : null;
  const opened = openId ? reports?.find((r) => r.id === openId) : null;
  let thread: { id: string; sender_id: string; body: string; attachment_name: string | null; created_at: string; deleted_at: string | null }[] = [];
  const names = new Map<string, string>();
  if (opened) {
    const { data } = await supabase.rpc("admin_read_reported_conversation", { target_report: opened.id });
    thread = data ?? [];
    const ids = [...new Set(thread.map((m) => m.sender_id))];
    if (ids.length) {
      const { data: people } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      for (const p of people ?? []) names.set(p.id, p.full_name);
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader variant={theme} kicker={t("kicker")} title={t("title")} />
      <div className="grid gap-6 px-4 py-6 sm:px-8 xl:grid-cols-[minmax(0,420px)_1fr]">
        <section aria-labelledby="report-list" className="flex flex-col gap-3">
          <h2 id="report-list" className="sr-only">{t("list")}</h2>
          {!reports?.length && <p className="text-th-muted">{t("empty")}</p>}
          {reports?.map((r) => (
            <article key={r.id} className={`flex flex-col gap-2 rounded-th border-th bg-th-card p-4 ${r.id === openId ? "outline-3 outline-th-link" : ""}`}>
              <div className="flex items-center justify-between gap-2 text-xs text-th-muted">
                <span>{shortDate(r.created_at, locale)} · {r.reporter?.full_name ?? "—"}</span>
                <span className={`rounded-th-pill px-2 py-0.5 ${r.status === "open" ? "bg-honey text-ink" : "border-th"}`}>{t(`status.${r.status}`)}</span>
              </div>
              <p className="text-sm whitespace-pre-line">{r.reason || t("noReason")}</p>
              <div className="flex flex-wrap gap-2">
                <Link href={`/app/admin/reports?report=${r.id}`} className={b.ghost}>{t("read")}</Link>
                {r.status === "open" && (
                  <form action={resolveReport}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className={b.primary}>{t("markReviewed")}</button>
                  </form>
                )}
              </div>
            </article>
          ))}
        </section>
        <section aria-labelledby="report-thread" className="flex min-w-0 flex-col gap-3">
          <h2 id="report-thread" className="font-display text-xl font-bold">{opened ? t("conversation") : t("pick")}</h2>
          {opened && <p className="rounded-th bg-honey-wash px-3 py-2 text-sm text-ink">{t("logged")}</p>}
          <ol className="flex flex-col gap-2">
            {thread.map((m) => (
              <li key={m.id} className="rounded-th border-th bg-th-card px-4 py-3 text-sm">
                <div className="mb-1 text-xs text-th-muted">{names.get(m.sender_id) ?? "—"} · {dateTime(m.created_at, locale)}</div>
                {m.deleted_at ? <em className="text-th-muted">{t("deleted")}</em> : <p className="whitespace-pre-wrap">{m.body}{m.attachment_name ? ` [${m.attachment_name}]` : ""}</p>}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
