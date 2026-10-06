import { notFound } from "next/navigation";
import { getActivity } from "@/lib/news";
import { getSiteUrl } from "@/lib/site-url";

function stamp(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escape(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// "Add to calendar" (NP-8): a single-event iCalendar file.
export async function GET(_request: Request, { params }: RouteContext<"/activities/[id]/calendar.ics">) {
  const activity = await getActivity((await params).id);
  if (!activity || !activity.isPublic) notFound();

  const siteUrl = await getSiteUrl();
  const end = activity.endsAt ?? new Date(new Date(activity.startsAt).getTime() + 2 * 3_600_000).toISOString();
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//re_form//reform-web//RO",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${activity.id}@reform-web`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(activity.startsAt)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(activity.title)}`,
    `DESCRIPTION:${escape(activity.summary)}`,
    `LOCATION:${escape(activity.location)}`,
    `URL:${siteUrl}/activities/${activity.id}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="re_form-${activity.id.slice(0, 8)}.ics"`,
    },
  });
}
