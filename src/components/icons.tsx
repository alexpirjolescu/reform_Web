import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, strokeWidth = 2, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "square" as const,
    "aria-hidden": true,
    ...props,
  };
}

// Straight-line icons, as the brandbook asks ("basic straight lineal").
export const BoardIcon = (p: IconProps) => (
  <svg {...base(p)}><rect x="3" y="4" width="5" height="16" /><rect x="10" y="4" width="5" height="10" /><rect x="17" y="4" width="4" height="13" /></svg>
);
export const FolderIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 6h7l2 2h9v11H3z" /></svg>
);
export const QuizIcon = (p: IconProps) => (
  <svg {...base(p)}><rect x="4" y="3" width="16" height="18" /><path d="M8 9l2 2 4-4M8 16h8" /></svg>
);
export const ChatIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 5h16v11H9l-5 4z" /></svg>
);
export const SearchIcon = (p: IconProps) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
);
export const BellIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 21h4" /></svg>
);
export const CalendarIcon = (p: IconProps) => (
  <svg {...base(p)}><rect x="3" y="5" width="18" height="16" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
);
export const CheckIcon = (p: IconProps) => (
  <svg {...base(p)}><rect x="3" y="3" width="18" height="18" /><path d="M8 12l3 3 5-6" /></svg>
);
export const ClipIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M20 11l-8 8a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8" /></svg>
);
export const SendIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 12l16-8-6 16-2-7z" /></svg>
);
export const PlayIcon = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
);
export const UploadIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 16V4M6 10l6-6 6 6M4 20h16" /></svg>
);
export const DownloadIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 4v12M6 10l6 6 6-6M4 20h16" /></svg>
);
export const CloseIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const PlusIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>
);
export const TrashIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
);
export const FileIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4" /></svg>
);
export const ShieldIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z" /></svg>
);
export const NewsIcon = (p: IconProps) => (
  <svg {...base(p)}><rect x="3" y="4" width="18" height="16" /><path d="M7 8h10M7 12h10M7 16h6" /></svg>
);
export const UsersIcon = (p: IconProps) => (
  <svg {...base(p)}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.5-4 3-6 6.5-6s6 2 6.5 6M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2 .7 3.3 2.7 3.5 6" /></svg>
);
