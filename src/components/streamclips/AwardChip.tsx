import * as React from "react";

/**
 * Award-Farben → vollständige Tailwind-Klassen. Bewusst statische
 * Strings (keine `bg-${color}`-Interpolation), sonst purged Tailwind sie
 * im Build weg. Unbekannte Farben fallen auf Fuchsia zurück.
 */
const AWARD_COLOR: Record<string, string> = {
  amber: "border-amber-400/60 bg-amber-400/15 text-amber-200",
  emerald: "border-emerald-400/60 bg-emerald-400/15 text-emerald-200",
  orange: "border-orange-400/60 bg-orange-400/15 text-orange-200",
  red: "border-red-400/60 bg-red-400/15 text-red-200",
  pink: "border-pink-400/60 bg-pink-400/15 text-pink-200",
  purple: "border-purple-400/60 bg-purple-400/15 text-purple-200",
  cyan: "border-cyan-400/60 bg-cyan-400/15 text-cyan-200"
};
const AWARD_COLOR_FALLBACK = "border-fuchsia-400/60 bg-fuchsia-400/15 text-fuchsia-200";
const IDLE = "border-white/10 bg-white/5 text-slate-400 hover:text-slate-200 hover:border-white/25";

function colorClasses(color?: string | null): string {
  if (!color) return AWARD_COLOR_FALLBACK;
  return AWARD_COLOR[color] ?? AWARD_COLOR_FALLBACK;
}

interface AwardChipProps {
  emoji?: string | null;
  label: string;
  color?: string | null;
  /** Anzeige-Modus: Stimmenanzahl rechts. */
  count?: number;
  /** Toggle-Modus: aktiv markiert (nur mit onClick relevant). */
  selected?: boolean;
  /** Wenn gesetzt → klickbarer Toggle-Button statt statischem Chip. */
  onClick?: () => void;
}

export function AwardChip({ emoji, label, color, count, selected, onClick }: AwardChipProps) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition";
  const className = `${base} ${onClick ? (selected ? colorClasses(color) : IDLE) : colorClasses(color)}`;

  const content = (
    <>
      {emoji && <span aria-hidden="true">{emoji}</span>}
      <span>{label}</span>
      {typeof count === "number" && (
        <span className="ml-0.5 rounded-full bg-black/30 px-1.5 py-0.5 text-[0.65rem] tabular-nums">
          {count}
        </span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={selected} className={className}>
        {content}
      </button>
    );
  }
  return <span className={className}>{content}</span>;
}
