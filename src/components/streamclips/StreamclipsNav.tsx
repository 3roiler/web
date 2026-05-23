import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { Routes } from "../../config/routes";

const LINKS = [
  { label: "Bewerten", to: Routes.Streamclips.Vote },
  { label: "Einreichen", to: Routes.Streamclips.Submit },
  { label: "Top-Clips", to: Routes.Streamclips.Leaderboard },
  { label: "Top-Einreicher", to: Routes.Streamclips.Contributors },
  { label: "Meine Clips", to: Routes.Streamclips.Me }
];

/**
 * Sub-Navigation für den /streamclips-Bereich. Auf jeder Streamclips-Seite
 * eingebunden, damit man ohne Umweg über das Direkt-Aufrufen der URL
 * zwischen Bewerten / Einreichen / Leaderboard / Profil wechseln kann.
 */
export function StreamclipsNav() {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Streamclips-Navigation"
      className="mb-6 -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {LINKS.map((l) => {
        const active = pathname === l.to;
        return (
          <Link
            key={l.to}
            to={l.to}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "shrink-0 whitespace-nowrap rounded-full border border-[#9146FF]/50 bg-[#9146FF]/15 px-3 py-1.5 text-xs font-semibold text-[#bf94ff]"
                : "shrink-0 whitespace-nowrap rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-400 transition hover:text-slate-200"
            }
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
