"use client";

import { useTranslations } from "next-intl";
import { Avatar } from "@/components/avatar";
import { CalendarIcon, ChatIcon, CheckIcon, ClipIcon } from "@/components/icons";
import type { Theme } from "@/lib/theme-shared";
import { labelHex, type BoardCard, type Member } from "@/lib/workspace";

export type CardState = { late: boolean; today: boolean; done: boolean };

function shortDay(iso: string, locale: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ro-RO", { day: "numeric", month: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, d)))
    .replace(".", "");
}

/** One task card, drawn the way each design shows it (mockups A/B/C-workspace). */
export function CardVisual({
  card,
  variant,
  members,
  state,
  locale,
  selected,
}: {
  card: BoardCard;
  variant: Theme;
  members: Map<string, Member>;
  state: CardState;
  locale: string;
  selected?: boolean;
}) {
  const t = useTranslations("workspace");
  const due = card.due_date ? (state.today ? t("today") : shortDay(card.due_date, locale)) : null;
  const people = card.assignees.map((id) => members.get(id)).filter((m): m is Member => Boolean(m));

  if (variant !== "color") {
    // Studio (dark and white): a card a step above its column.
    return (
      <div className={`flex flex-col gap-2.5 border border-th-cardline bg-th-high px-3.5 py-3 text-left ${state.done ? "opacity-70" : ""} ${selected ? "outline outline-2 outline-teal" : ""}`}>
        {card.labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {card.labels.map((label) => (
              <span key={label.id} className="px-2 py-[3px] text-[11px] font-medium" style={{ background: labelHex[label.color].bg, color: labelHex[label.color].fg }}>
                {label.name}
              </span>
            ))}
          </div>
        )}
        <span className="font-display text-[15px] leading-[1.35] font-medium">{card.title}</span>
        <div className="flex items-center gap-3 text-xs text-th-soft">
          {due && state.late && <span className="bg-vermilion px-[7px] py-0.5 font-medium text-night">{t("late")} · {due}</span>}
          {due && !state.late && <span className="inline-flex items-center gap-1"><CalendarIcon size={13} strokeWidth={2.4} />{due}</span>}
          {card.checklistTotal > 0 && <span className="inline-flex items-center gap-1"><CheckIcon size={13} strokeWidth={2.4} />{card.checklistDone}/{card.checklistTotal}</span>}
          {card.comments > 0 && <span className="inline-flex items-center gap-1"><ChatIcon size={13} strokeWidth={2.4} />{card.comments}</span>}
          {card.attachments > 0 && <span className="inline-flex items-center gap-1"><ClipIcon size={13} strokeWidth={2.4} />{card.attachments}</span>}
          <span className="ml-auto flex">
            {people.slice(0, 4).map((person, index) => (
              <Avatar key={person.id} id={person.id} name={person.full_name} size={24} ring="var(--th-high)" className={index ? "-ml-1.5" : ""} />
            ))}
          </span>
        </div>
      </div>
    );
  }

  // Colour: a white sticker card.
  const pct = card.checklistTotal ? Math.round((100 * card.checklistDone) / card.checklistTotal) : 0;
  const dueBg = state.done ? "#abca54" : state.late ? "#dd6937" : state.today ? "#e1b345" : "#ffffff";
  return (
    <div className={`flex flex-col gap-2.5 rounded-2xl border-2 border-ink bg-white p-3 text-left ${state.done ? "opacity-70" : ""} ${selected ? "ring-4 ring-honey" : ""}`}>
      {card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {card.labels.map((label) => (
            <span key={label.id} className="rounded-full border-[1.5px] border-ink px-[9px] py-0.5 text-[11px] font-medium" style={{ background: labelHex[label.color].bg, color: labelHex[label.color].fg }}>
              {label.name}
            </span>
          ))}
        </div>
      )}
      <span className="font-display text-[15px] leading-[1.3] font-semibold">{card.title}</span>
      {card.checklistTotal > 0 && (
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="h-2 flex-grow overflow-hidden rounded-full border-[1.5px] border-ink">
            <span className="block h-full bg-pink" style={{ width: `${pct}%` }} />
          </span>
          <span className="text-xs font-medium">{card.checklistDone}/{card.checklistTotal}</span>
        </div>
      )}
      <div className="flex items-center gap-2">
        {(due || state.done) && (
          <span className="rounded-full border-[1.5px] border-ink px-[9px] py-0.5 text-xs font-medium" style={{ background: dueBg }}>
            {state.done ? t("done") : state.late ? `${t("late")} · ${due}` : due}
          </span>
        )}
        {card.comments > 0 && <span className="inline-flex items-center gap-1 text-xs font-medium"><ChatIcon size={13} strokeWidth={2.5} />{card.comments}</span>}
        <span className="ml-auto flex">
          {people.slice(0, 4).map((person, index) => (
            <Avatar key={person.id} id={person.id} name={person.full_name} size={26} ring="#221f20" className={index ? "-ml-1.5" : ""} />
          ))}
        </span>
      </div>
    </div>
  );
}
