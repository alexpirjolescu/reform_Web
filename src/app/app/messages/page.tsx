import { getLocale, getTranslations } from "next-intl/server";
import { Messenger } from "@/components/messages/messenger";
import { requireProfile } from "@/lib/auth";
import { getConversation, getInbox } from "@/lib/messages-server";
import { getTheme } from "@/lib/theme";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("messages") };
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function MessagesPage({ searchParams }: PageProps<"/app/messages">) {
  const profile = await requireProfile();
  const [{ c }, theme, locale, inbox] = await Promise.all([searchParams, getTheme(profile.theme), getLocale(), getInbox(profile)]);
  const selectedId = typeof c === "string" && uuid.test(c) ? c : null;
  const selected = selectedId ? await getConversation(selectedId, profile, inbox) : null;

  return (
    <Messenger
      key={selected?.id ?? "inbox"}
      variant={theme}
      me={{ id: profile.id, full_name: profile.full_name }}
      inbox={inbox}
      selected={selected}
      locale={locale}
    />
  );
}
