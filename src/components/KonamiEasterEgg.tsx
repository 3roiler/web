import * as React from "react";

/**
 * Konami-Easter-Egg. Detektiert die klassische Eingabe
 *   ↑ ↑ ↓ ↓ ← → ← → B A
 * und triggert eine kurze, dezente Spielerei: Hue-Rotate-Filter auf
 * `<body>` für ein paar Sekunden + ein „💚 Du bist cool"-Toast.
 *
 * Bewusst leise:
 *   - Kein Sound (würde im Hintergrund-Tab nerven)
 *   - Auto-Reset nach 5 Sekunden
 *   - Respektiert `prefers-reduced-motion` (kein Hue-Filter, nur Toast)
 *   - Funktioniert nicht in Eingabefeldern (`<input>`, `<textarea>`,
 *     `[contenteditable]`)
 *   - Klein gerendert, blocking nichts
 *
 * Aktiviert via reiner Tastatur-Sequenz — kein Click-Hint, kein Easter-
 * Egg-Trail. Wer ihn findet, hat ihn verdient.
 */
const SEQUENCE = [
  'ArrowUp', 'ArrowUp',
  'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight',
  'ArrowLeft', 'ArrowRight',
  'b', 'a'
];

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function KonamiEasterEgg() {
  const [active, setActive] = React.useState(false);
  const indexRef = React.useRef(0);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditable(event.target)) return;

      const expected = SEQUENCE[indexRef.current];
      // Arrow-Keys sind case-sensitive in event.key ('ArrowUp'), B/A
      // wollen wir aber case-insensitiv (Shift macht im Konami keinen
      // Unterschied).
      const key = expected.length === 1 ? event.key.toLowerCase() : event.key;

      if (key === expected) {
        indexRef.current += 1;
        if (indexRef.current === SEQUENCE.length) {
          indexRef.current = 0;
          setActive(true);
        }
      } else {
        // Reset, aber prüfen ob die aktuelle Taste der Anfang der
        // Sequenz ist — sonst fällt einem schon der erste Pfeil-up
        // nach falscher Eingabe als „Reset" zur Last.
        indexRef.current = event.key === SEQUENCE[0] ? 1 : 0;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  React.useEffect(() => {
    if (!active) return;
    const prefersReduced = globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const root = document.documentElement;
    if (!prefersReduced) {
      root.style.transition = 'filter 600ms ease';
      root.style.filter = 'hue-rotate(60deg) saturate(1.2)';
    }
    const t = globalThis.setTimeout(() => {
      if (!prefersReduced) {
        root.style.filter = '';
        // Transition behalten — wenn jemand 1× das Egg triggert, ist
        // das auch sein einmaliger Übergang. Beim Reset darf der
        // Filter wieder sanft rausfaden.
      }
      setActive(false);
    }, 5000);
    return () => globalThis.clearTimeout(t);
  }, [active]);

  if (!active) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-full border border-cyan-400/40 bg-slate-900/90 px-4 py-2 text-sm font-mono text-cyan-200 shadow-lg shadow-cyan-500/20 backdrop-blur"
    >
      💚 ↑↑↓↓←→←→BA · Du bist cool.
    </div>
  );
}
