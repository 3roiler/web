import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Routes } from "../config/routes";

/**
 * Globale Tastatur-Shortcuts à la GitHub.
 *
 * Aktive Bindings:
 *   - `g h` → Home               | `g b` → Blog
 *   - `g s` → Streamclips        | `g d` → Dashboard
 *   - `?`   → Cheat-Sheet öffnen | `Esc` → Cheat-Sheet schließen
 *
 * Designentscheidungen:
 *   - `g`-Prefix-Modus mit 1.2 s Timeout: nach einem `g` wartet der
 *     Handler kurz auf die zweite Taste. Verhindert Versehen-Trigger,
 *     wenn jemand „g" in einer Suche tippt und kurz pausiert.
 *   - Komplett deaktiviert, sobald der Fokus in einem Eingabefeld liegt
 *     (`<input>`, `<textarea>`, `[contenteditable]`). Sonst würde ein
 *     `g` im Suchfeld die Seite springen lassen.
 *   - Mit Cmd/Ctrl/Alt belegte Tasten werden ignoriert — das sind
 *     entweder Browser- oder OS-Shortcuts.
 *   - Cheat-Sheet als Modal: schließt bei Backdrop-Click und Escape,
 *     fokussiert beim Öffnen den Schließen-Button.
 *
 * Nicht eingebaut: anpassbare Bindings. Falls jemand Caps-Lock-bedingt
 * mit Großbuchstaben auf der Seite tippt, schluckt der Input-Filter
 * das ohnehin — also kein Hardening dafür.
 */

const SHORTCUTS: { keys: string[]; description: string }[] = [
  { keys: ['g', 'h'], description: 'Zur Startseite' },
  { keys: ['g', 'b'], description: 'Zum Blog' },
  { keys: ['g', 's'], description: 'Zu Streamclips' },
  { keys: ['g', 'd'], description: 'Zum Dashboard' },
  { keys: ['?'], description: 'Diesen Dialog öffnen' },
  { keys: ['Esc'], description: 'Dialog schließen' }
];

const G_TIMEOUT_MS = 1200;

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function KeyboardShortcuts() {
  const navigate = useNavigate();
  const [cheatOpen, setCheatOpen] = React.useState(false);
  const cheatCloseRef = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    let gExpiresAt = 0;

    const handler = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditable(event.target)) return;

      const key = event.key;

      if (key === 'Escape') {
        if (cheatOpen) {
          event.preventDefault();
          setCheatOpen(false);
        }
        return;
      }

      // Cheat-Sheet kann durch `?` jederzeit geöffnet werden (Shift+/ auf
      // de-Keyboards). Wir lesen `event.key` direkt, damit das Mapping
      // sprachunabhängig funktioniert.
      if (key === '?') {
        event.preventDefault();
        setCheatOpen((open) => !open);
        return;
      }

      // Solange das Modal offen ist, blockieren wir weitere Shortcuts —
      // sonst springt der User mitten im Lesen unfreiwillig auf eine
      // andere Seite.
      if (cheatOpen) return;

      const now = Date.now();
      if (key === 'g' || key === 'G') {
        gExpiresAt = now + G_TIMEOUT_MS;
        return;
      }

      if (now <= gExpiresAt) {
        const lower = key.toLowerCase();
        let target: string | null = null;
        if (lower === 'h') target = Routes.Home;
        else if (lower === 'b') target = Routes.Blog;
        else if (lower === 's') target = Routes.Streamclips.Home;
        else if (lower === 'd') target = Routes.Dashboard.Home;

        if (target !== null) {
          event.preventDefault();
          gExpiresAt = 0;
          navigate(target);
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [navigate, cheatOpen]);

  // Fokus beim Öffnen auf den Close-Button setzen — Screenreader und
  // Tab-Navigation finden so sofort einen Anker im Dialog.
  React.useEffect(() => {
    if (cheatOpen) {
      requestAnimationFrame(() => cheatCloseRef.current?.focus());
    }
  }, [cheatOpen]);

  // Backdrop-Click schließt das Modal — wir registrieren das per
  // pointerdown auf dem Wrapper-Element, statt einen onClick-Handler auf
  // ein non-interactive div zu legen (löst a11y-S1082 aus, weil Click
  // ohne Keyboard-Pendant signalisiert: das Element wäre nur für
  // Maus-Nutzer schließbar — was hier nicht stimmt, denn Escape ist
  // weiter oben registriert).
  const backdropRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!cheatOpen) return;
    const node = backdropRef.current;
    if (!node) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target === node) setCheatOpen(false);
    };
    node.addEventListener('pointerdown', onPointerDown);
    return () => node.removeEventListener('pointerdown', onPointerDown);
  }, [cheatOpen]);

  if (!cheatOpen) return null;

  return (
    <div
      ref={backdropRef}
      role="dialog"
      aria-modal="true"
      aria-label="Tastatur-Shortcuts"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
            Tastatur-Shortcuts
          </h2>
          <button
            ref={cheatCloseRef}
            type="button"
            onClick={() => setCheatOpen(false)}
            aria-label="Dialog schließen"
            className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-400 transition hover:border-cyan-400/40 hover:text-cyan-300"
          >
            Esc
          </button>
        </div>
        <ul className="mt-5 space-y-3 text-sm">
          {SHORTCUTS.map((shortcut) => (
            <li key={shortcut.keys.join(' ')} className="flex items-center justify-between gap-4">
              <span className="text-slate-300">{shortcut.description}</span>
              <span className="flex items-center gap-1">
                {shortcut.keys.map((k) => (
                  <kbd
                    key={k}
                    className="rounded-md border border-white/10 bg-slate-950/80 px-2 py-0.5 font-mono text-[0.7rem] text-slate-200"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-[0.7rem] text-slate-500">
          Funktioniert nicht in Eingabefeldern. Drücke <kbd className="rounded border border-white/10 bg-slate-950 px-1">?</kbd> jederzeit zum Öffnen.
        </p>
      </div>
    </div>
  );
}
