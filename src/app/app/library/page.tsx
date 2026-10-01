import { requireProfile } from "@/lib/auth";
import { ModulePlaceholder } from "../module-placeholder";

export default async function LibraryPage() {
  await requireProfile();
  return <ModulePlaceholder module="library" />;
}
