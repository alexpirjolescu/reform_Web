import { StudentColor, StudentDark, StudentWhite, type StudentScreenData, type Tab } from "@/components/assessments/student-views";
import { studentGroup } from "@/lib/assessments";
import { getAttemptReview, getRunnerData, listStudentAssessments } from "@/lib/assessments-server";
import type { Theme } from "@/lib/theme-shared";

/** The student assessments screen: list plus the selected assessment (or the most urgent one). */
export async function StudentScreen({ selectedId, tab, theme, locale }: { selectedId: string | null; tab: string | undefined; theme: Theme; locale: string }) {
  const list = await listStudentAssessments();
  const urgent = list.find((a) => a.state === "in_progress") ?? list.find((a) => a.state === "todo") ?? null;
  const selected = selectedId ? list.find((a) => a.id === selectedId) ?? null : urgent;

  const latest = selected?.latest ?? null;
  const [runner, review] = await Promise.all([
    selected && latest ? getRunnerData(selected.id, latest.id) : Promise.resolve(null),
    selected && latest && latest.status !== "in_progress" && selected.kind === "quiz" ? getAttemptReview(latest.id) : Promise.resolve(null),
  ]);

  const tabs: Tab[] = ["todo", "submitted", "reviewed"];
  const data: StudentScreenData = {
    list,
    selected,
    runner,
    review,
    tab: tabs.includes(tab as Tab) ? (tab as Tab) : selected ? studentGroup(selected.state) : "todo",
    locale,
  };

  if (theme === "dark") return <StudentDark data={data} />;
  if (theme === "color") return <StudentColor data={data} />;
  return <StudentWhite data={data} />;
}
