import { requireProfile } from "@/lib/auth";
import { ModulePlaceholder } from "../module-placeholder";

export default async function AssessmentsPage() {
  await requireProfile();
  return <ModulePlaceholder module="assessments" />;
}
