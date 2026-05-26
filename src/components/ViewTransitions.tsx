import * as React from "react";
import { useNavigate } from "react-router-dom";

/**
 * Aktiviert View-Transitions zwischen SPA-Routen ohne Edit an jedem
 * `<Link>`. Funktioniert per Click-Capture-Listener auf document:
 *
 *  1. Listener läuft VOR dem `<a>`-onClick (capture phase).
 *  2. Bei internem Link-Klick (links-click, kein Modifier, gleiche
 *     Origin) ruft er `event.preventDefault()` und navigiert per
 *     `useNavigate({ viewTransition: true })`.
 *  3. React-Routers eigener Link-Handler prüft anschließend
 *     `event.defaultPrevented` und macht früh-return → kein doppeltes
 *     navigate. Andere user-space `onClick`-Handler (z. B. mobile
 *     drawer schließen) laufen weiter — `stopPropagation` rufen wir
 *     bewusst NICHT auf.
 *
 * Browser-Support: alle aktuellen stable Chrome/Edge/Safari/Firefox
 * können `document.startViewTransition` (Chrome seit 111, FF seit 129,
 * Safari seit 18). Ohne API-Support ist die `viewTransition`-Option
 * in React-Router 7 ein No-Op — der navigate läuft normal weiter.
 *
 * `prefers-reduced-motion`: dann hängen wir den Listener gar nicht
 * ein, fallback ist Default-Navigation. So fühlt sich die Erfahrung
 * für motion-sensible Nutzer identisch zur Pre-Feature-Variante an.
 *
 * CSS-Animation für die Transitionen liegt in `style.css`
 * (`::view-transition-old/new` Selectors).
 */
export function ViewTransitions() {
  const navigate = useNavigate();

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    if (!("startViewTransition" in document)) return;
    if (globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    function handleClick(event: MouseEvent) {
      // Browser-Default-Aktionen mit Modifier respektieren
      // (Cmd/Ctrl-Click öffnet im neuen Tab, Shift im neuen Fenster, etc.).
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      // Nur Linksklick — Middle-Click ist eh „neuer Tab", Right-Click
      // öffnet das Kontextmenü.
      if (event.button !== 0) return;
      // Falls ein voriger Handler schon preventDefault gemacht hat
      // (z. B. ein Formular oder eigene Aktion), nicht rein-grätschen.
      if (event.defaultPrevented) return;

      const anchor = (event.target as HTMLElement | null)?.closest(
        "a[href]"
      ) as HTMLAnchorElement | null;
      if (!anchor) return;
      // Externe Tabs, Downloads, Hash-internal-jumps — überlassen wir
      // dem Browser/React-Router-Default.
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      // `rel="external"` ist die explizite Opt-out-Markierung.
      if (anchor.relList?.contains("external")) return;

      let url: URL;
      try {
        url = new URL(anchor.href);
      } catch {
        return;
      }
      if (url.origin !== globalThis.location.origin) return;

      // Hash-only Sprünge auf der gleichen Seite (`#about`) lösen
      // keine View-Transition aus — würde nur ein unnötiges Fade
      // zwischen identischen Pages erzeugen.
      if (
        url.pathname === globalThis.location.pathname &&
        url.search === globalThis.location.search &&
        url.hash !== globalThis.location.hash
      ) {
        return;
      }

      event.preventDefault();
      const path = url.pathname + url.search + url.hash;
      navigate(path, { viewTransition: true });
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [navigate]);

  return null;
}
