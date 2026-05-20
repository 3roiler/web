interface PaginationProps {
  offset: number;
  pageSize: number;
  /** Anzahl Einträge auf der aktuell geladenen Seite (für „Weiter"). */
  count: number;
  onChange: (offset: number) => void;
}

/**
 * Offset-basierte Pagination OHNE Gesamtzahl: „Weiter" ist aktiv, solange die
 * aktuelle Seite voll ist (`count === pageSize`) — dann gibt es vermutlich
 * weitere Einträge. Für Dashboard-Listen, deren API `limit`/`offset` kann.
 * Rendert nichts, wenn es nur eine (Teil-)Seite gibt.
 */
export function Pagination({ offset, pageSize, count, onChange }: PaginationProps) {
  const hasPrev = offset > 0;
  const hasNext = count === pageSize;
  if (!hasPrev && !hasNext) return null;

  const page = Math.floor(offset / pageSize) + 1;
  const from = count === 0 ? 0 : offset + 1;
  const to = offset + count;

  return (
    <div className="flex items-center justify-between pt-2 text-xs text-slate-400">
      <span className="tabular-nums">
        {from}–{to} · Seite {page}
      </span>
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
