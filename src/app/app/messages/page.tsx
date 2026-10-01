import { requireProfile } from "@/lib/auth";
import { ModulePlaceholder } from "../module-placeholder";

export default async function MessagesPage() {
  await requireProfile();
  return <ModulePlaceholder module="messages" />;
}
