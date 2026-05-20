interface PaginationProps {
  offset: number;
  pageSize: number;
  /** Anzahl Einträge auf der aktuell geladenen Seite (für „Weiter"). */
  count: number;
  /** Gesamtzahl, falls bekannt → zeigt „X–Y von N" und exakte Weiter-Logik. */
  total?: number;
  onChange: (offset: number) => void;
}

/**
 * Offset-basierte Pagination. Ist `total` bekannt, wird „X–Y von N" gezeigt
 * und „Weiter" exakt anhand der Gesamtzahl aktiviert. Sonst (count-Modus)
 * ist „Weiter" aktiv, solange die aktuelle Seite voll ist (`count ===
 * pageSize`). Rendert nichts, wenn es nur eine (Teil-)Seite gibt.
 */
export function Pagination({ offset, pageSize, count, total, onChange }: PaginationProps) {
  const hasPrev = offset > 0;
  const hasNext = total != null ? offset + pageSize < total : count === pageSize;
  if (!hasPrev && !hasNext) return null;

  const from = count === 0 ? 0 : offset + 1;
  const to = offset + count;
  const label =
    total != null
      ? `${from}–${to} von ${total}`
      : `${from}–${to} · Seite ${Math.floor(offset / pageSize) + 1}`;

  return (
    <div className="flex items-center justify-between pt-2 text-xs text-slate-400">
      <span className="tabular-nums">{label}</span>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-outline btn-sm disabled:opacity-40"
          disabled={!hasPrev}
          onClick={() => onChange(Math.max(0, offset - pageSize))}
        >
          Zurück
        </button>
        <button
          type="button"
          className="btn-outline btn-sm disabled:opacity-40"
          disabled={!hasNext}
          onClick={() => onChange(offset + pageSize)}
        >
          Weiter
        </button>
      </div>
    </div>
  );
}
