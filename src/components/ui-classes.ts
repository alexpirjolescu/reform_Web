// Class strings of the iOS-style controls (the "ui-" classes in globals.css), in a plain module so server
// components can import them too: values exported from a "use client" file reach server components as client
// references, not strings. form.tsx re-exports them for client components.
export const inputClass = "ui-field";
export const selectClass = "ui-field ui-select";
export const buttonClass = "ui-btn ui-filled";
export const ghostButtonClass = "ui-btn ui-gray ui-neutral";

/** Rows of the phone menu (components/mobile-menu.tsx), iOS list style. */
export const menuRow = "flex min-h-11 items-center gap-3 rounded-[12px] px-3 text-[17px] transition-colors hover:bg-th-fill";
export const menuRowActive = "flex min-h-11 items-center gap-3 rounded-[12px] bg-th-fill-2 px-3 text-[17px] font-semibold";
