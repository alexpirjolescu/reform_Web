import type { ReactNode } from "react";
import { Logo, type LogoName } from "@/components/logo";
import type { Theme } from "@/lib/theme-shared";

/** The title row of an app page: the studio header (dark, white) or the colour design's. */
export function PageHeader({
  variant,
  title,
  kicker,
  logo,
  actions,
  children,
}: {
  variant: Theme;
  title: ReactNode;
  kicker?: ReactNode;
  /** Sub-brand logo shown above the title in the colour design (re_form core, hub, academy, community). */
  logo?: LogoName;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  if (variant !== "color") {
    // Studio (dark and white): the same header, coloured by the theme tokens.
    return (
      <div className="shrink-0 border-b border-th-line px-4 pt-[26px] pb-5 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            {kicker && <div className="mb-1.5 text-[13px] text-th-muted">{kicker}</div>}
            <h1 className="font-display text-[34px] font-bold tracking-[-0.01em]">{title}</h1>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="shrink-0 px-4 pt-6 pb-[18px] sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-2.5">
          {logo && <Logo name={logo} height={30} />}
          {kicker && !logo && <span className="text-[13px] font-medium">{kicker}</span>}
          <h1 className="font-display text-[36px] font-extrabold tracking-[-0.02em]">{title}</h1>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

/** Button styles for links and buttons inside module pages: the iOS-style kit (globals.css), the same in every theme. */
const kitButtons = {
  primary: "ui-btn ui-filled",
  ghost: "ui-btn ui-gray ui-neutral",
  danger: "ui-btn ui-tinted ui-danger",
};

export const moduleButtons: Record<Theme, { primary: string; ghost: string; danger: string }> = {
  dark: kitButtons,
  white: kitButtons,
  color: kitButtons,
};
