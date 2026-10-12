"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CloseIcon, MenuIcon } from "@/components/icons";

const wideScreen = { md: "(min-width: 48rem)", lg: "(min-width: 64rem)" } as const;
const focusable = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Phones and small tablets: a ☰ button (top right) that slides in, from the right, a menu holding every link and setting
 * of the page (navigation, theme, language, account). From `hideFrom` up the page shows them itself, so the
 * button is hidden. The ✕, Escape, a tap on the dimmed page or following a link close it; Tab stays inside
 * while it is open and focus goes back to ☰ afterwards.
 */
export function MobileMenu({
  label,
  closeLabel,
  hideFrom,
  header,
  panelClass,
  children,
}: {
  label: string;
  closeLabel: string;
  hideFrom: keyof typeof wideScreen;
  /** Shown next to ✕ at the top of the menu (usually the logo). */
  header: ReactNode;
  /** Background and text colour of the menu, matching the page. */
  panelClass: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  const hide = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    closeButton.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
      if (event.key === "Tab" && panel.current) {
        const items = [...panel.current.querySelectorAll<HTMLElement>(focusable)];
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    // Turning a tablet sideways can reveal the full page: the menu isn't needed any more.
    const wide = window.matchMedia(wideScreen[hideFrom]);
    const onWide = (event: MediaQueryListEvent) => event.matches && setOpen(false);
    document.addEventListener("keydown", onKey);
    wide.addEventListener("change", onWide);
    return () => {
      root.style.overflow = before;
      document.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
    };
  }, [open, hideFrom]);

  return (
    <div className={hideFrom === "md" ? "md:hidden" : "lg:hidden"}>
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(true)}
        className="ui-btn ui-plain ui-icon ui-neutral -mr-2.5"
      >
        <MenuIcon size={26} />
      </button>
      <div
        aria-hidden="true"
        onClick={hide}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <div
        ref={panel}
        id={id}
        // A dialog only while open: closed, it is an inert, invisible panel waiting off screen.
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label={open ? label : undefined}
        inert={!open}
        onClick={(event) => {
          if ((event.target as Element).closest("a[href]")) setOpen(false);
        }}
        // Opening shows the panel at once (so ✕ can take focus); closing keeps it visible until it has slid away.
        className={`fixed inset-y-0 right-0 z-50 flex w-[min(86vw,340px)] flex-col overflow-y-auto overscroll-contain rounded-l-[24px] shadow-[0_0_48px_rgb(0_0_0/0.28)] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${open ? "visible translate-x-0 transition-transform" : "invisible translate-x-full transition-[transform,visibility]"} ${panelClass}`}
        style={{ paddingTop: "max(14px, env(safe-area-inset-top))", paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center justify-between gap-3 pr-4 pb-4 pl-5">
          {header}
          <button ref={closeButton} type="button" aria-label={closeLabel} onClick={hide} className="ui-btn ui-gray ui-icon ui-sm ui-neutral">
            <CloseIcon size={18} />
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-4 px-3">{children}</div>
      </div>
    </div>
  );
}

/** A settings row in the menu: the words on the left, the control (a segmented picker) on the right. */
export function MenuSetting({ label, children, labelClass = "" }: { label: string; children: ReactNode; labelClass?: string }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 px-3">
      <span className={`text-[15px] ${labelClass}`}>{label}</span>
      {children}
    </div>
  );
}
