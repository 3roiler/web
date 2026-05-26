import * as React from "react";

/**
 * Loading-Skeletons als Ersatz für „Lade…"-Spinner in Listen-Views.
 *
 * Pattern: ein leeres `<div>` mit gepulster Hintergrund-Animation und
 * `aria-hidden="true"` — Screenreader sollen den Skeleton nicht ansagen
 * (sie würden sonst „leer leer leer leer leer" hören). Das eigentliche
 * Ladestatus-Signal kommt aus `role="status"` + `aria-live="polite"`
 * am Wrapper, mit einem versteckten Text-Hinweis (`SkeletonList` macht
 * das automatisch).
 *
 * Animation ist via `motion-safe:animate-pulse` an `prefers-reduced-motion`
 * gebunden — User mit der Einstellung sehen einen statischen Block ohne
 * Pulse.
 *
 * Drei Varianten:
 *   - `line` (Default) — kleine Höhe, für Single-Line-Text.
 *   - `block` — größere Höhe, für Karten / Listenzeilen.
 *   - `avatar` — quadratisch + rounded-full, für Avatar-Platzhalter.
 */

type SkeletonVariant = "line" | "block" | "avatar";

const VARIANT_CLASSES: Record<SkeletonVariant, string> = {
  line: "h-4 rounded",
  block: "h-16 rounded-lg",
  avatar: "h-10 w-10 rounded-full"
};

export interface SkeletonProps {
  variant?: SkeletonVariant;
  /** Tailwind-Width-Klasse, z. B. `w-1/2`, `w-32`. Default: `w-full`. */
  width?: string;
  /** Zusätzliche Tailwind-Klassen — z. B. eigene Höhe für `block`. */
  className?: string;
}

export function Skeleton({ variant = "line", width = "w-full", className = "" }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`bg-white/5 motion-safe:animate-pulse ${VARIANT_CLASSES[variant]} ${
        variant === "avatar" ? "" : width
      } ${className}`}
    />
  );
}

export interface SkeletonRowProps {
  /** Optionale Avatar-Platzierung links. */
  avatar?: boolean;
  /** Anzahl Text-Lines neben/unter dem Avatar. Default: 2. */
  lines?: number;
}

/**
 * Vorgebaute Listenzeile mit optionalem Avatar + N Text-Skeleton-Linien.
 * Das eigentliche Layout (Padding, Border) übernimmt der Wrapper im
 * Aufrufer — `SkeletonRow` ist nur der innere Block-Skeleton.
 */
export function SkeletonRow({ avatar = false, lines = 2 }: SkeletonRowProps) {
  return (
    <div className="flex items-center gap-3">
      {avatar && <Skeleton variant="avatar" />}
      <div className="min-w-0 flex-1 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} variant="line" width={i === lines - 1 ? "w-2/3" : "w-full"} />
        ))}
      </div>
    </div>
  );
}

export interface SkeletonListProps {
  /** Anzahl Platzhalter-Zeilen. Default: 5. */
  rows?: number;
  /** Avatar pro Zeile? Default: false. */
  avatar?: boolean;
  /** Anzahl Text-Lines pro Zeile. Default: 2. */
  linesPerRow?: number;
  /** Optional: ARIA-Label statt des Default-Labels „Lade…". */
  label?: string;
}

/**
 * Komplette Skeleton-Liste mit `role="status"` + `aria-live="polite"`,
 * damit Screenreader das Laden ansagen. Visueller Text ist
 * `sr-only` — nur die Skeletons sind sichtbar.
 */
export function SkeletonList({
  rows = 5,
  avatar = false,
  linesPerRow = 2,
  label = "Lade…"
}: SkeletonListProps) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
          <SkeletonRow avatar={avatar} lines={linesPerRow} />
        </div>
      ))}
    </div>
  );
}
