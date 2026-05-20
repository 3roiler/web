import * as React from "react";

interface StarRatingProps {
  /** Aktueller Wert 0–5 (0 = keine Bewertung). */
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASS: Record<NonNullable<StarRatingProps["size"]>, string> = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-4xl"
};

/**
 * 1–5-Sterne-Bewertung. Im interaktiven Modus zeigt Hover eine Vorschau.
 * Tastatur: jeder Stern ist ein eigener Button (1–5 erreichbar), die
 * Vote-Seite mappt zusätzlich die Zifferntasten.
 */
export function StarRating({ value, onChange, readOnly = false, size = "md" }: StarRatingProps) {
  const [hover, setHover] = React.useState(0);
  const shown = hover || value;

  return (
    <div className={`inline-flex items-center gap-1 ${SIZE_CLASS[size]}`} role="group" aria-label="Bewertung">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= shown;
        const cls = filled ? "text-amber-300" : "text-slate-600";
        if (readOnly) {
          return (
            <span key={star} className={cls} aria-hidden="true">
              ★
            </span>
          );
        }
        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange?.(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className={`${cls} transition hover:scale-110`}
            aria-label={`${star} von 5 Sternen`}
            aria-pressed={value === star}
          >
            {filled ? "★" : "☆"}
          </button>
        );
      })}
    </div>
  );
}
