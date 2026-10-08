"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/avatar";
import type { Member } from "@/lib/workspace";

const plain = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("ro");

/** Callers pass kit classes: input "ui-field ui-search", popover "ui-menu", chip "rounded-full bg-th-fill". */
type Styles = { input: string; muted: string; popover: string; chip: string };

/**
 * Search the project's team by name and tick people on or off (a multi-select combobox).
 * "full": chosen people as chips with a search field under them (task assignees).
 * "compact": a row of avatars and a "+" that opens the search (checklist items).
 */
export function PeoplePicker({
  members,
  selected,
  onToggle,
  label,
  mode = "full",
  styles,
}: {
  members: Member[];
  selected: string[];
  onToggle: (id: string, on: boolean) => void;
  label: string;
  mode?: "full" | "compact";
  styles: Styles;
}) {
  const t = useTranslations();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const chosen = selected.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  const matches = useMemo(() => {
    const q = plain(query.trim());
    return members.filter((m) => !q || plain(m.full_name).includes(q));
  }, [members, query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  function toggle(member: Member) {
    onToggle(member.id, !selected.includes(member.id));
    input.current?.focus();
  }

  function onKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const member = matches[active];
      if (open && member) toggle(member);
      else setOpen(true);
    } else if (event.key === "Escape" && open) {
      event.stopPropagation();
      setOpen(false);
    }
  }

  const search = (
    <input
      ref={input}
      role="combobox"
      aria-label={label}
      aria-expanded={open}
      aria-controls={listId}
      aria-autocomplete="list"
      aria-activedescendant={open && matches[active] ? `${listId}-${matches[active].id}` : undefined}
      value={query}
      autoFocus={mode === "compact"}
      placeholder={t("workspace.searchPeople")}
      onFocus={() => setOpen(true)}
      onChange={(e) => {
        setQuery(e.target.value);
        setActive(0);
        setOpen(true);
      }}
      onKeyDown={onKey}
      className={styles.input}
    />
  );

  const list = open && (
    <ul id={listId} role="listbox" aria-multiselectable aria-label={label} className={`absolute top-full left-0 z-30 mt-1.5 max-h-64 w-full min-w-[min(16rem,100%)] overflow-y-auto ${styles.popover}`}>
      {matches.length === 0 && <li className={`px-3 py-2 text-sm ${styles.muted}`}>{t("workspace.noPeople")}</li>}
      {matches.map((member, index) => {
        const on = selected.includes(member.id);
        return (
          <li
            key={member.id}
            id={`${listId}-${member.id}`}
            role="option"
            aria-selected={on}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => toggle(member)}
            onMouseEnter={() => setActive(index)}
            className={`ui-menu-item py-1.5 text-sm ${index === active ? "bg-th-fill-2" : ""}`}
          >
            <Avatar id={member.id} name={member.full_name} size={26} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium">{member.full_name}</span>
              <span className={`text-xs ${styles.muted}`}>{t(`roles.${member.role}`)}</span>
            </span>
            <span aria-hidden="true" className="w-4 font-bold text-th-tint">{on ? "✓" : ""}</span>
          </li>
        );
      })}
    </ul>
  );

  if (mode === "compact") {
    return (
      <div ref={box} className="relative flex items-center">
        <div className="flex">
          {chosen.map((member, index) => (
            <Avatar key={member.id} id={member.id} name={member.full_name} size={24} ring="var(--th-card)" className={index ? "-ml-1.5" : ""} />
          ))}
        </div>
        <button
          type="button"
          aria-label={label}
          aria-expanded={open}
          onClick={() => setOpen((on) => !on)}
          className="ui-btn ui-gray ui-icon ui-sm ui-neutral ml-1 text-lg font-normal"
        >
          +
        </button>
        {open && (
          <div className={`absolute top-full right-0 z-30 mt-1.5 w-72 p-2 ${styles.popover}`}>
            <div className="relative">
              {search}
              {list}
            </div>
            {chosen.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {chosen.map((member) => (
                  <li key={member.id} className={`inline-flex items-center gap-1 pl-1.5 text-xs ${styles.chip}`}>
                    <Avatar id={member.id} name={member.full_name} size={18} />
                    {member.full_name}
                    <button type="button" onClick={() => onToggle(member.id, false)} aria-label={t("workspace.removePerson", { name: member.full_name })} className="ui-btn ui-plain ui-icon ui-sm ui-neutral -ml-1 text-base font-normal">×</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={box} className="flex flex-col gap-2">
      {chosen.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={t("workspace.assignees")}>
          {chosen.map((member) => (
            <li key={member.id} className={`inline-flex items-center gap-1.5 pl-[5px] text-sm ${styles.chip}`}>
              <Avatar id={member.id} name={member.full_name} size={22} />
              {member.full_name}
              <button type="button" onClick={() => onToggle(member.id, false)} aria-label={t("workspace.removePerson", { name: member.full_name })} className="ui-btn ui-plain ui-icon ui-sm ui-neutral -ml-1 text-base font-normal">×</button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        {search}
        {list}
      </div>
    </div>
  );
}
