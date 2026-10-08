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
  /** Controls use the iOS-style "ui-" kit (globals.css), the same in every theme; only the fields differ. */
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
  /** Archive page: filter chips and cards (the upcoming/past switch is a "ui-seg"). */
  filter: string;
  activeFilter: string;
  card: string;
  /** About page: one partner school. */
  listItem: string;
  /** Category tag on an activity page. */
  tag: string;
  /** Status banners (draft preview, draft privacy notice). */
  notice: string;
  /** Boxes inside an article: file and link cards, audio, social posts before they load. No padding. */
  panel: string;
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
  login: "ui-btn ui-filled",
  chip: "ui-chip",
  activeChip: "ui-chip",
  field: "ui-field",
  fieldButton: "ui-btn ui-filled",
  media: "",
  bars: ["bg-teal", "bg-teal", "bg-teal", "bg-teal"],
  newsletter: {
    input: "ui-field w-[300px] max-w-full",
    button: "ui-btn ui-filled",
    message: "text-teal-text",
  },
  filter: "ui-chip",
  activeFilter: "ui-chip",
  card: "border border-line p-3",
  listItem: "border-b border-line",
  tag: "px-3 py-1",
  notice: "bg-honey text-ink",
  panel: "border border-line bg-sand",
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
  login: "ui-btn ui-filled",
  chip: "ui-chip",
  activeChip: "ui-chip",
  field: "ui-field",
  fieldButton: "ui-btn ui-filled",
  media: "",
  bars: ["bg-teal", "bg-teal", "bg-teal", "bg-teal"],
  newsletter: {
    input: "ui-field w-[300px] max-w-full",
    button: "ui-btn ui-filled",
    message: "text-teal",
  },
  filter: "ui-chip",
  activeFilter: "ui-chip",
  card: "border border-night-line bg-night-3 p-3",
  listItem: "border-b border-night-line",
  tag: "px-3 py-1",
  notice: "bg-honey text-ink",
  panel: "border border-night-line bg-night-3",
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
  login: "ui-btn ui-filled",
  chip: "ui-chip",
  activeChip: "ui-chip",
  dot: "round",
  // honey paper: fields on white so they don't turn muddy
  field: "ui-field bg-white",
  fieldButton: "ui-btn ui-filled",
  media: "rounded-2xl border-2 border-ink",
  bars: ["bg-teal", "bg-lavender", "bg-vermilion", "bg-pink"],
  newsletter: {
    input: "ui-field w-[300px] max-w-full bg-white",
    button: "ui-btn ui-filled",
    message: "font-medium text-ink",
  },
  filter: "ui-chip",
  activeFilter: "ui-chip",
  card: "rounded-3xl border-2 border-ink p-3",
  listItem: "rounded-2xl border-2 border-ink",
  tag: "rounded-full border-2 border-ink px-3 py-1",
  notice: "border-2 border-ink bg-white text-ink",
  panel: "rounded-3xl border-2 border-ink bg-white",
};

const papers: Record<Theme, Paper> = { white, dark, color };

export function paperFor(theme: Theme): Paper {
  return papers[theme];
}
