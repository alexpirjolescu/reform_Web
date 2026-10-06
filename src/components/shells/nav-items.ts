import type { ShellData } from "@/lib/shell";

export type NavKey = "workspace" | "library" | "assessments" | "messages";

export const moduleNav: { key: NavKey; href: string; color: string; ink: string }[] = [
  { key: "workspace", href: "/app/workspace", color: "#e28ba3", ink: "#221f20" },
  { key: "library", href: "/app/library", color: "#e1b345", ink: "#221f20" },
  { key: "assessments", href: "/app/assessments", color: "#79569a", ink: "#ffffff" },
  { key: "messages", href: "/app/messages", color: "#dd6937", ink: "#221f20" },
];

export type AdminKey = "overview" | "invites" | "news" | "users" | "reports";

/** The administration section: staff send invitations and edit the news panel; admins also manage accounts and reports. */
export function adminNav(shell: ShellData): { key: AdminKey; href: string; badge?: number; exact?: boolean }[] {
  const items: { key: AdminKey; href: string; badge?: number; exact?: boolean }[] = [];
  if (shell.isStaff) {
    items.push({ key: "overview", href: "/app/admin", exact: true });
    items.push({ key: "invites", href: "/app/admin/invites" });
    items.push({ key: "news", href: "/app/admin/news" });
  }
  if (shell.isAdmin) {
    items.push({ key: "users", href: "/app/admin/users" });
    items.push({ key: "reports", href: "/app/admin/reports", badge: shell.openReports });
  }
  return items;
}

export function badgeFor(key: NavKey, shell: ShellData) {
  if (key === "messages") return shell.unreadMessages;
  if (key === "assessments") return shell.assessmentsBadge;
  return 0;
}
