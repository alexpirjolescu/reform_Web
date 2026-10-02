import type { ReactNode } from "react";
import { Logo, type LogoName } from "@/components/logo";
import type { Theme } from "@/lib/theme-shared";

/** The title row of an app page, drawn the way each design starts its module screens. */
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
  if (variant === "dark") {
    return (
      <div className="shrink-0 border-b border-night-line px-4 pt-[26px] pb-5 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            {kicker && <div className="mb-1.5 text-[13px] text-night-muted">{kicker}</div>}
            <h1 className="font-display text-[34px] font-bold tracking-[-0.01em]">{title}</h1>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
        </div>
        {children}
      </div>
    );
  }

  if (variant === "color") {
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

  return (
    <div className="shrink-0 border-b border-line px-4 pt-[22px] pb-[18px] sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          {kicker && <div className="mb-1.5 text-[13px] text-muted">{kicker}</div>}
          <h1 className="font-display text-[36px] font-extrabold tracking-[-0.02em]">{title}</h1>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

/** Primary and secondary button styles per design, for links and buttons inside module pages. */
export const moduleButtons: Record<Theme, { primary: string; ghost: string; danger: string }> = {
  dark: {
    primary: "inline-flex min-h-11 items-center gap-2 rounded-[2px] bg-teal px-[18px] font-display text-[15px] font-semibold text-night disabled:opacity-60",
    ghost: "inline-flex min-h-11 items-center gap-2 rounded-[2px] border border-night-edge px-3.5 text-[14px] text-white hover:border-white disabled:opacity-60",
    danger: "inline-flex min-h-11 items-center gap-2 rounded-[2px] bg-vermilion px-3.5 text-[14px] font-medium text-night disabled:opacity-60",
  },
  white: {
    primary: "inline-flex min-h-11 items-center gap-2 border border-ink bg-teal px-[18px] font-display text-[15px] font-semibold text-ink disabled:opacity-60",
    ghost: "inline-flex min-h-11 items-center gap-2 border border-ink px-3.5 text-sm hover:bg-sand disabled:opacity-60",
    danger: "inline-flex min-h-11 items-center gap-2 border border-ink bg-vermilion px-3.5 text-sm font-medium text-ink disabled:opacity-60",
  },
  color: {
    primary: "inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-ink bg-pink px-[22px] font-display text-[15px] font-bold text-ink disabled:opacity-60",
    ghost: "inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-ink bg-white px-4 text-sm font-medium hover:bg-sand disabled:opacity-60",
    danger: "inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-ink bg-vermilion px-4 text-sm font-medium text-ink disabled:opacity-60",
  },
};
