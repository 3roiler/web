import * as React from "react";
import { Link } from "react-router-dom";
import { Seo } from "../components/Seo";
import { ParticleField } from "../components/ParticleField";
import { Routes } from "../config/routes";

/**
 * SPA-Catch-all. Caddy liefert für unbekannte Pfade die index.html mit
 * Status 200 aus (Soft-404), wir markieren die Seite über `Seo noindex`
 * damit Google keine Müll-URLs in den Index nimmt.
 *
 * Visuell: dasselbe Knoten-Netz wie auf der Startseite plus ein 404,
 * das langsam glitcht. Reduced-motion respektiert (Partikel rendern
 * dann statisch, der Glitch fällt aus, Static-Variante bleibt).
 */
export function NotFoundPage() {
  const prefersReduced =
    typeof globalThis !== 'undefined' &&
    typeof globalThis.matchMedia === 'function' &&
    globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <main
      className="relative isolate min-h-screen overflow-hidden bg-slate-950"
      id="top"
    >
      <Seo title="Seite nicht gefunden" noindex />

      <ParticleField className="pointer-events-none absolute inset-0 -z-20" />
      {/* Schwacher cyan Glow von oben — gleiche Behandlung wie der
          Hero, damit „verlaufen sein" sich nicht wie ein Bruch im
          Look der Site anfühlt. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-cyan-500/15 blur-[120px]"
      />

      <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col items-start justify-center px-6 sm:px-10 lg:px-16">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400">
          Fehler · 404
        </p>
        <Glitch404 prefersReduced={prefersReduced} />
        <h2 className="mt-6 max-w-xl text-2xl font-semibold text-slate-100 sm:text-3xl">
          Diese Seite gibt es nicht (mehr).
        </h2>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-slate-400">
          Vielleicht hat sich der Link verschoben, oder die Seite war nie hier.
          Geh zurück zur Startseite oder versuch direkt deinen Bereich.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link to={Routes.Home} className="btn">Zur Startseite</Link>
          <Link to={Routes.Blog} className="btn-outline">Blog lesen</Link>
          <Link to={Routes.Streamclips.Home} className="btn-outline">Streamclips</Link>
        </div>
      </div>
    </main>
  );
}

/**
 * 404 als großes Display mit einem sehr subtilen, langsamen Glitch:
 * Drei übereinander gestapelte Layer (Basis-cyan, rote Channel-Shift,
 * blaue Channel-Shift) animieren leicht versetzt. Ohne reduced-motion;
 * dann fallen die Shift-Layer weg, der Basis-Layer bleibt static.
 */
function Glitch404({ prefersReduced }: { prefersReduced: boolean }) {
  return (
    <div className="relative mt-6 select-none font-mono leading-none">
      <h1
        aria-label="404"
        className="text-[6rem] font-bold tracking-tighter text-slate-50 sm:text-[9rem]"
      >
        404
      </h1>
      {!prefersReduced && (
        <>
          {/* Roter und blauer Channel-Shift, absolut über dem Basis-
              Layer. Niedrige Opazität + screen-blend würde brillant
              wirken, kostet aber zu viel — wir simulieren mit text-
              color + mix-blend-mode auf normal Opazität. */}
          <span
            aria-hidden="true"
            className="glitch-layer absolute inset-0 text-[6rem] font-bold tracking-tighter text-red-400/40 sm:text-[9rem]"
            style={{ animation: 'glitch-red 6s infinite steps(1)' }}
          >
            404
          </span>
          <span
            aria-hidden="true"
            className="glitch-layer absolute inset-0 text-[6rem] font-bold tracking-tighter text-cyan-300/40 sm:text-[9rem]"
            style={{ animation: 'glitch-cyan 6s infinite steps(1)' }}
          >
            404
          </span>
        </>
      )}
    </div>
  );
}
