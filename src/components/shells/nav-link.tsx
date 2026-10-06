"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** A nav link that knows when its section is open. Each shell passes its own classes. */
function isActive(pathname: string, href: string, exact?: boolean) {
  return pathname === href || (!exact && pathname.startsWith(`${href}/`));
}

export function NavLink({
  href,
  exact,
  className,
  activeClassName,
  children,
  activeExtra,
}: {
  href: string;
  /** Only the page itself, not the pages under it (e.g. the admin overview). */
  exact?: boolean;
  className: string;
  activeClassName: string;
  children: ReactNode;
  activeExtra?: ReactNode;
}) {
  const pathname = usePathname();
  const active = isActive(pathname, href, exact);
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={active ? activeClassName : className}>
      {children}
      {active && activeExtra}
    </Link>
  );
}

/** Children rendered only while a path is active (e.g. a teal icon instead of a plain one). */
export function WhenActive({ href, exact, active, inactive }: { href: string; exact?: boolean; active: ReactNode; inactive: ReactNode }) {
  const pathname = usePathname();
  return <>{isActive(pathname, href, exact) ? active : inactive}</>;
}
