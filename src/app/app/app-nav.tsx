"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const items = [
  { href: "/app/workspace", key: "workspace" },
  { href: "/app/library", key: "library" },
  { href: "/app/assessments", key: "assessments" },
  { href: "/app/messages", key: "messages" },
] as const;

export function AppNav({ isAdmin }: { isAdmin: boolean }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const links = isAdmin ? [...items, { href: "/app/admin/users", key: "admin" } as const] : items;

  return (
    <nav aria-label={t("label")} className="flex flex-row flex-wrap gap-1 md:flex-col">
      {links.map(({ href, key }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center gap-3 px-3 ${active ? "bg-ink text-paper" : "hover:bg-line"}`}
          >
            {t(key)}
            {active && <span aria-hidden="true" className="ml-auto h-1 w-4 bg-teal" />}
          </Link>
        );
      })}
    </nav>
  );
}
