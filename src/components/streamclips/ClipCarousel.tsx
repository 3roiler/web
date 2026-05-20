import * as React from "react";
import { ClipCard } from "./ClipCard";
import type { ClipWithContext } from "../../services";

/**
 * Horizontal scrollbares "Laufband" einer Clip-Reihe (à la Twitch-
 * Startseite). Rendert nichts, wenn die Reihe leer ist.
 */
export function ClipCarousel({ title, clips }: { title: React.ReactNode; clips: ClipWithContext[] }) {
  if (clips.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">{title}</h2>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {clips.map((c) => (
          <div key={c.id} className="w-56 shrink-0 sm:w-64">
            <ClipCard clip={c} />
          </div>
        ))}
      </div>
    </section>
  );
}
