"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** A nav link that knows when its section is open. Each shell passes its own classes. */
export function NavLink({
  href,
  className,
  activeClassName,
  children,
  activeExtra,
}: {
  href: string;
  className: string;
  activeClassName: string;
  children: ReactNode;
  activeExtra?: ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={active ? activeClassName : className}>
      {children}
      {active && activeExtra}
    </Link>
  );
}

/** Children rendered only while a path is active (e.g. a teal icon instead of a white one). */
export function WhenActive({ href, active, inactive }: { href: string; active: ReactNode; inactive: ReactNode }) {
  const pathname = usePathname();
  return <>{pathname === href || pathname.startsWith(`${href}/`) ? active : inactive}</>;
}

/** A tab that opens a small menu (used for the admin pages in the white design's top bar). */
export function NavMenu({
  label,
  items,
  className,
  activeClassName,
}: {
  label: string;
  items: { href: string; label: string; badge?: number }[];
  className: string;
  activeClassName: string;
}) {
  const pathname = usePathname();
  const active = items.some(({ href }) => pathname === href || pathname.startsWith(`${href}/`));
  const badge = items.reduce((sum, item) => sum + (item.badge ?? 0), 0);
  return (
    <details className="group relative" onClick={(e) => (e.target as HTMLElement).closest("a") && e.currentTarget.removeAttribute("open")}>
      <summary className={`${active ? activeClassName : className} cursor-pointer list-none whitespace-nowrap`}>
        {label} <span aria-hidden="true" className="text-xs">▾</span>
        {badge > 0 && <span className="bg-honey px-1.5 text-xs text-ink">{badge}</span>}
      </summary>
      <div className="absolute top-full left-0 z-30 mt-px flex min-w-52 flex-col border border-ink bg-white py-1">
        {items.map((item) => {
          const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link key={item.href} href={item.href} aria-current={current ? "page" : undefined}
              className={`flex min-h-11 items-center justify-between gap-3 px-4 text-[15px] hover:bg-sand ${current ? "font-medium" : ""}`}>
              {item.label}
              {!!item.badge && <span className="bg-honey px-1.5 text-xs">{item.badge}</span>}
            </Link>
          );
        })}
      </div>
    </details>
  );
}
