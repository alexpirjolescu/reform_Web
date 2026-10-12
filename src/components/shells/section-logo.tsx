"use client";

import { usePathname } from "next/navigation";
import { Logo, type LogoName } from "@/components/logo";

/** Each module carries its sub-brand (docs/design/README.md); admin pages and the overview are "platform". */
const sections: [string, LogoName][] = [
  ["/app/workspace", "core"],
  ["/app/library", "hub"],
  ["/app/assessments", "academy"],
  ["/app/messages", "community"],
];

/** The one logo at the top of the platform: re_form platform, or the sub-brand of the open module. */
export function SectionLogo({ white = false, height }: { white?: boolean; height: number }) {
  const pathname = usePathname();
  const name = sections.find(([path]) => pathname === path || pathname.startsWith(`${path}/`))?.[1] ?? "platform";
  return <Logo name={name} white={white} height={height} />;
}
