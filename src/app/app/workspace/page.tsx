import { requireProfile } from "@/lib/auth";
import { ModulePlaceholder } from "../module-placeholder";

export default async function WorkspacePage() {
  await requireProfile();
  return <ModulePlaceholder module="workspace" />;
}
