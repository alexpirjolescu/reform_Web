const palette = ["#77bfb2", "#e28ba3", "#e1b345", "#abca54", "#79569a", "#dd6937"];

export function initialsOf(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?").slice(0, 2);
}

/** A stable brand colour for a person, from their id. */
export function avatarColor(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

export function Avatar({
  id,
  name,
  size = 36,
  ring,
  className = "",
}: {
  id: string;
  name: string;
  size?: number;
  ring?: string;
  className?: string;
}) {
  const bg = avatarColor(id);
  const fg = bg === "#79569a" ? "#ffffff" : "#221f20";
  return (
    <span
      title={name}
      className={`grid shrink-0 place-items-center rounded-full font-display font-bold ${className}`}
      style={{
        width: size,
        height: size,
        background: bg,
        color: fg,
        fontSize: Math.max(10, Math.round(size * 0.36)),
        border: ring ? `2px solid ${ring}` : undefined,
      }}
    >
      {initialsOf(name)}
    </span>
  );
}
