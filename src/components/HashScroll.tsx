import * as React from "react";
import { useLocation } from "react-router-dom";

/**
 * Scrollt nach SPA-Navigation zum aktuellen `location.hash`.
 *
 * Hintergrund: React-Router scrollt nur beim initialen Page-Load
 * automatisch zu einem Hash (das macht der Browser, nicht der Router).
 * Bei einem `<Link to="/#skills">`-Klick von `/blog` aus wechselt der
 * Pfad zu `/` mit Hash `#skills`, aber Home rendert oben — der User
 * landet nicht bei der gewünschten Section.
 *
 * Diese Komponente schließt die Lücke: bei jedem `pathname`/`hash`-
 * Change suchen wir `#hash`-Element und scrollen smooth dorthin. Zwei
 * Defenses:
 *   - `requestAnimationFrame`: warten bis nach dem aktuellen Layout-
 *     Flush — Home muss die Sections gemounted haben, bevor
 *     `getElementById` etwas findet.
 *   - Retry mit 100 ms Timeout: bei lazy-geladenen Pages reicht ein
 *     Frame oft nicht aus.
 *
 * `prefers-reduced-motion` respektieren: harter Sprung statt Smooth-
 * Scroll.
 */
export function HashScroll() {
  const { pathname, hash } = useLocation();

  React.useEffect(() => {
    if (!hash) return;
    const id = hash.slice(1);
    if (!id) return;

    const behavior: ScrollBehavior =
      typeof globalThis.matchMedia === "function" &&
      globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth";

    let cancelled = false;
    let raf = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const tryScroll = () => {
      if (cancelled) return;
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior, block: "start" });
      }
    };

    // 1. Frame: nach React's Render-Pass + Layout-Flush
    raf = requestAnimationFrame(() => {
      raf = 0;
      tryScroll();
      // 2. Retry für lazy-geladene Sections (z. B. Suspense-Boundaries)
      retryTimer = setTimeout(tryScroll, 100);
    });

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [pathname, hash]);

  return null;
}
