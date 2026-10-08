// Class strings of the iOS-style controls (the "ui-" classes in globals.css), in a plain module so server
// components can import them too: values exported from a "use client" file reach server components as client
// references, not strings. form.tsx re-exports them for client components.
export const inputClass = "ui-field";
export const selectClass = "ui-field ui-select";
export const buttonClass = "ui-btn ui-filled";
export const ghostButtonClass = "ui-btn ui-gray ui-neutral";
