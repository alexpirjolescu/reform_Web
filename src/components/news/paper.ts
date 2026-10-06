import type { Theme } from "@/lib/theme";

/**
 * The public pages share one "newspaper" layout (design B) printed on three papers:
 * white, night (dark) and honey (colour). Everything that changes between them lives here,
 * so the layouts never branch on the theme. Class names are written out in full so Tailwind finds them.
 */
export type Paper = {
  /** Page background and body text. */
  page: string;
  /** Text that should match the body colour explicitly (e.g. inside a muted list). */
  text: string;
  muted: string;
  /** Strong rules (masthead, column dividers) and thin rules (between items). Colour only: widths stay in the layout. */
  rule: string;
  line: string;
  heading: string;
  kicker: string;
  link: string;
  hover: string;
  /** Font for big numbers (agenda dates, stats). */
  numeral: string;
  logoWhite: boolean;
  tone: "light" | "dark";
  login: string;
  /** News panel filters. */
  chip: string;
  activeChip: string;
  dot?: "square" | "round";
  field: string;
  fieldButton: string;
  /** Extra classes for cover images and colour blocks. */
  media: string;
  /** One accent bar per stat. */
  bars: [string, string, string, string];
  newsletter: { input: string; button: string; message: string };
  /** Archive page: upcoming/past tabs, filter boxes and cards. */
  tab: string;
  activeTab: string;
  filter: string;
  activeFilter: string;
  card: string;
  /** About page: one partner school. */
  listItem: string;
  /** Category tag on an activity page. */
  tag: string;
  /** Status banners (draft preview, draft privacy notice). */
  notice: string;
};

const white: Paper = {
  page: "bg-white text-ink",
  text: "text-ink",
  muted: "text-muted",
  rule: "border-ink",
  line: "border-line",
  heading: "text-teal-strong",
  kicker: "text-teal-text",
  link: "text-teal-text",
  hover: "hover:text-teal-text",
  numeral: "font-display",
  logoWhite: false,
  tone: "light",
  login: "bg-ink px-[18px] py-[11px] font-display text-[15px] font-semibold text-white",
  chip: "border-b-4 border-transparent py-2 text-[15px] text-muted hover:text-ink",
  activeChip: "border-b-4 border-teal py-2 text-[15px] font-medium text-ink",
  field: "min-h-11 border border-ink bg-white px-2.5 text-sm text-ink",
  fieldButton: "min-h-11 bg-ink px-4 text-sm text-white",
  media: "",
  bars: ["bg-teal", "bg-teal", "bg-teal", "bg-teal"],
  newsletter: {
    input: "w-[300px] border-2 border-ink bg-white px-3.5 py-3.5 text-[15px]",
    button: "border-2 border-ink bg-ink px-6 py-[15px] font-display text-[15px] font-semibold text-white disabled:opacity-60",
    message: "text-teal-text",
  },
  tab: "border-b-4 border-transparent px-1 py-2 text-muted",
  activeTab: "border-b-4 border-teal px-1 py-2 font-medium",
  filter: "border border-ink px-3 py-2 text-sm",
  activeFilter: "border border-ink bg-ink px-3 py-2 text-sm text-white",
  card: "border border-line p-3",
  listItem: "border-b border-line",
  tag: "px-3 py-1",
  notice: "bg-honey text-ink",
};

const dark: Paper = {
  page: "bg-night text-white",
  text: "text-white",
  muted: "text-night-muted",
  rule: "border-night-soft",
  line: "border-night-line",
  heading: "text-teal",
  kicker: "text-teal",
  link: "text-teal",
  hover: "hover:text-teal",
  numeral: "font-display",
  logoWhite: true,
  tone: "dark",
  login: "bg-teal px-[18px] py-[11px] font-display text-[15px] font-semibold text-night",
  chip: "border-b-4 border-transparent py-2 text-[15px] text-night-muted hover:text-white",
  activeChip: "border-b-4 border-teal py-2 text-[15px] font-medium text-white",
  field: "min-h-11 border border-night-edge bg-night-3 px-2.5 text-sm text-white",
  fieldButton: "min-h-11 bg-teal px-4 text-sm text-night",
  media: "",
  bars: ["bg-teal", "bg-teal", "bg-teal", "bg-teal"],
  newsletter: {
    input: "w-[300px] border-2 border-night-edge bg-night-3 px-3.5 py-3.5 text-[15px] text-white placeholder:text-night-muted",
    button: "border-2 border-teal bg-teal px-6 py-[15px] font-display text-[15px] font-semibold text-night disabled:opacity-60",
    message: "text-teal",
  },
  tab: "border-b-4 border-transparent px-1 py-2 text-night-muted",
  activeTab: "border-b-4 border-teal px-1 py-2 font-medium",
  filter: "border border-night-edge px-3 py-2 text-sm",
  activeFilter: "border border-white bg-white px-3 py-2 text-sm text-night",
  card: "border border-night-line bg-night-3 p-3",
  listItem: "border-b border-night-line",
  tag: "px-3 py-1",
  notice: "bg-honey text-ink",
};

const color: Paper = {
  page: "bg-honey text-ink",
  text: "text-ink",
  muted: "text-honey-muted",
  rule: "border-ink",
  line: "border-honey-line",
  heading: "text-ink",
  kicker: "text-ink",
  link: "text-ink underline decoration-2 underline-offset-4",
  hover: "hover:underline hover:decoration-2 hover:underline-offset-4",
  numeral: "font-fun",
  logoWhite: false,
  tone: "light",
  login: "rounded-full border-2 border-ink bg-teal px-5 py-[9px] font-display text-[15px] font-bold text-ink",
  chip: "rounded-full border-2 border-ink px-3.5 py-1.5 text-sm hover:bg-white",
  activeChip: "rounded-full border-2 border-ink bg-ink px-3.5 py-1.5 text-sm text-white",
  dot: "round",
  field: "min-h-11 rounded-full border-2 border-ink bg-white px-3.5 text-sm text-ink",
  fieldButton: "min-h-11 rounded-full bg-ink px-5 text-sm text-white",
  media: "rounded-2xl border-2 border-ink",
  bars: ["bg-teal", "bg-lavender", "bg-vermilion", "bg-pink"],
  newsletter: {
    input: "w-[300px] rounded-full border-2 border-ink bg-white px-4 py-3.5 text-[15px]",
    button: "rounded-full border-2 border-ink bg-ink px-6 py-[15px] font-display text-[15px] font-semibold text-white disabled:opacity-60",
    message: "font-medium text-ink",
  },
  tab: "rounded-full border-2 border-ink px-4 py-2 hover:bg-white",
  activeTab: "rounded-full border-2 border-ink bg-ink px-4 py-2 text-white",
  filter: "rounded-full border-2 border-ink px-4 py-2 text-sm hover:bg-white",
  activeFilter: "rounded-full border-2 border-ink bg-ink px-4 py-2 text-sm text-white",
  card: "rounded-3xl border-2 border-ink p-3",
  listItem: "rounded-2xl border-2 border-ink",
  tag: "rounded-full border-2 border-ink px-3 py-1",
  notice: "border-2 border-ink bg-white text-ink",
};

const papers: Record<Theme, Paper> = { white, dark, color };

export function paperFor(theme: Theme): Paper {
  return papers[theme];
}
