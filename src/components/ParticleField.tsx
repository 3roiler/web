import React from 'react';

/**
 * Schlichtes „Knoten-Netz" als Hero-Hintergrund.
 *
 * Was passiert:
 *  - N Punkte treiben langsam durch den Canvas (toroidal — verlassen sie
 *    eine Kante, kommen sie auf der gegenüberliegenden wieder rein, damit
 *    die Dichte konstant bleibt).
 *  - Nahe Punktpaare bekommen eine dünne, distanz-abhängige Linie. Das
 *    erzeugt ein lebendes Netz ohne jede explizite Topologie.
 *  - Die Maus zieht keine Punkte (das würde hektisch wirken), sondern
 *    leuchtet sie im Umkreis auf und zeichnet temporäre Linien zu sich
 *    selbst. Lokal interaktiv, global ruhig.
 *
 * Performance:
 *  - O(n²) für Linien — bei N=80 sind das 3 160 Checks/Frame und damit
 *    bei 60 fps sehr entspannt. Wir kappen N nach Viewport-Fläche.
 *  - `devicePixelRatio` wird auf 2 gedeckelt, damit Retina/4K den Canvas
 *    nicht mit 4× Pixelarbeit überschütten.
 *  - Bei `document.hidden` (Tab-Wechsel) wird die RAF-Schleife pausiert.
 *  - `prefers-reduced-motion: reduce` ⇒ überhaupt nicht gerendert.
 *  - ResizeObserver statt `window.resize`, damit auch elastische Eltern
 *    (Sidebar-Toggle, Mobile-Drawer) zuverlässig getriggert werden.
 *
 * A11y:
 *  - Rein dekorativ. Wir verstecken den gesamten Canvas-Wrapper per
 *    `aria-hidden` (am wrapping div, nicht am canvas — SonarCloud
 *    S6825 lehnt aria-hidden direkt auf canvas ab, weil canvas in
 *    Edge-Cases mit `tabindex` fokussierbar werden könnte).
 *  - `pointer-events-none` an Wrapper UND canvas, damit Buttons/Links
 *    im Vordergrund weiter direkt anklickbar bleiben.
 */
export interface ParticleFieldProps {
  /** Multiplikator auf die berechnete Partikelzahl. Default 1. Werte unter
   *  1 = leiser, über 1 = dichter (nur sparsam einsetzen). */
  readonly density?: number;
  /** Zusätzliche Klassen für den Canvas-Wrapper (Positionierung/Sizing). */
  readonly className?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

const LINK_DISTANCE = 140;        // Maximaler Abstand für Linien zw. Punkten (px)
const MOUSE_DISTANCE = 170;       // Einflussradius der Maus (px)
const BASE_PARTICLE_OPACITY = 0.35;
const PARTICLE_AREA_DIVISOR = 18000; // 1 Partikel pro N px² Hero-Fläche
const PARTICLE_MIN = 20;
const PARTICLE_MAX = 120;

/**
 * Zufalls-Helfer. Bewusst über `crypto.getRandomValues` statt
 * `Math.random()` — nicht weil wir Crypto-Qualität brauchen
 * (Partikel-Positionen sind dekorativ), sondern weil Sonar S2245
 * `Math.random` ohnehin als „weak crypto" anmosert und die Web-Crypto-
 * API in allen unterstützten Browsern verfügbar ist. Wird nur beim
 * Mount und auf Resize aufgerufen — kein Per-Frame-Overhead. */
function rand(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  // Division durch 2³² liefert einen Wert in [0, 1), wie Math.random().
  return buf[0] / 0x1_0000_0000;
}

export function ParticleField({ density = 1, className }: ParticleFieldProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reduced motion respektieren — komplett kein Render. Wir tracken auch
    // Änderungen zur Laufzeit (User toggelt OS-Setting im offenen Tab).
    const motionQuery = globalThis.matchMedia('(prefers-reduced-motion: reduce)');
    let prefersReduced = motionQuery.matches;

    let particles: Particle[] = [];
    // Mauspos in CSS-Pixeln relativ zum Canvas. Außerhalb des Sichtfelds
    // initialisiert, damit der Effekt erst greift wenn der User wirklich
    // über den Hero fährt.
    let mouseX = -10_000;
    let mouseY = -10_000;
    let raf = 0;
    let width = 0;
    let height = 0;

    function makeParticle(w: number, h: number): Particle {
      // Geschwindigkeit bewusst sehr klein: ±0.12 px/frame ⇒ bei 60 fps
      // braucht ein Punkt rund 8 Sekunden für 60 px — sieht nach „Drift"
      // aus, nicht nach Bewegung.
      return {
        x: rand() * w,
        y: rand() * h,
        vx: (rand() - 0.5) * 0.24,
        vy: (rand() - 0.5) * 0.24,
        r: 1.1 + rand() * 0.9
      };
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      // DPR-Cap: 4K-Displays sonst 4× Pixel-Arbeit für minimal sichtbare
      // Schärfe-Gewinne. 2 ist der Sweet-Spot für Retina.
      const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
      canvas!.width = Math.max(1, Math.floor(width * dpr));
      canvas!.height = Math.max(1, Math.floor(height * dpr));
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const target = Math.max(
        PARTICLE_MIN,
        Math.min(PARTICLE_MAX, Math.round(((width * height) / PARTICLE_AREA_DIVISOR) * density))
      );
      // Wenn die Zahl steigt, ergänzen wir; wenn sie sinkt, schneiden wir
      // ab. Komplettes Recreate würde den „Drift" sichtbar resetten.
      if (particles.length < target) {
        for (let i = particles.length; i < target; i++) {
          particles.push(makeParticle(width, height));
        }
      } else if (particles.length > target) {
        particles.length = target;
      }
    }

    /** Position aller Partikel um einen Frame fortschreiben (toroidal). */
    function advance() {
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x += width;
        else if (p.x > width) p.x -= width;
        if (p.y < 0) p.y += height;
        else if (p.y > height) p.y -= height;
      }
    }

    /** Linien zwischen Punktpaaren mit Abstand < LINK_DISTANCE. Alpha
     *  skaliert quadratisch mit der Nähe — entfernte Verbindungen sind
     *  nahezu unsichtbar, sehr nahe Paare wirken wie gemalte Striche. */
    function drawLinks() {
      const maxSq = LINK_DISTANCE * LINK_DISTANCE;
      ctx!.lineWidth = 1;
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSq = dx * dx + dy * dy;
          if (distSq > maxSq) continue;
          const t = 1 - Math.sqrt(distSq) / LINK_DISTANCE;
          ctx!.strokeStyle = `rgba(103, 232, 249, ${t * t * 0.32})`; // cyan-300
          ctx!.beginPath();
          ctx!.moveTo(a.x, a.y);
          ctx!.lineTo(b.x, b.y);
          ctx!.stroke();
        }
      }
    }

    /** Punkte zeichnen + Maus-Interaktion (Glow + temporäre Linie zur
     *  Maus). In einem Pass kombiniert, damit wir die Distanz nur einmal
     *  pro Partikel rechnen müssen. */
    function drawParticlesAndMouse() {
      const maxSq = MOUSE_DISTANCE * MOUSE_DISTANCE;
      for (const p of particles) {
        const dx = p.x - mouseX;
        const dy = p.y - mouseY;
        const distSq = dx * dx + dy * dy;
        const proximity = distSq < maxSq ? 1 - Math.sqrt(distSq) / MOUSE_DISTANCE : 0;

        if (proximity > 0) {
          ctx!.strokeStyle = `rgba(34, 211, 238, ${proximity * 0.55})`; // cyan-400
          ctx!.beginPath();
          ctx!.moveTo(p.x, p.y);
          ctx!.lineTo(mouseX, mouseY);
          ctx!.stroke();
        }

        ctx!.fillStyle = `rgba(165, 243, 252, ${BASE_PARTICLE_OPACITY + proximity * 0.55})`; // cyan-200
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r + proximity * 1.4, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    function step() {
      ctx!.clearRect(0, 0, width, height);
      advance();
      drawLinks();
      drawParticlesAndMouse();
      raf = requestAnimationFrame(step);
    }

    function start() {
      if (prefersReduced) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(step);
    }

    function stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    }

    function onMove(event: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      mouseX = event.clientX - rect.left;
      mouseY = event.clientY - rect.top;
    }

    function clearMouse() {
      mouseX = -10_000;
      mouseY = -10_000;
    }

    function onVisibility() {
      if (document.hidden) {
        stop();
      } else {
        start();
      }
    }

    function onMotionChange(event: MediaQueryListEvent) {
      prefersReduced = event.matches;
      if (prefersReduced) {
        stop();
        ctx!.clearRect(0, 0, width, height);
      } else {
        start();
      }
    }

    resize();
    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas);
    // mousemove auf `globalThis`, damit die Maus auch dann den Hover-
    // Effekt auslöst, wenn sie über einen Vordergrund-Button (mit eigenem
    // pointer-events: auto) zieht. Distanz wird gegen das Canvas-Rect
    // umgerechnet, daher bleibt es lokal.
    globalThis.addEventListener('mousemove', onMove, { passive: true });
    globalThis.addEventListener('blur', clearMouse);
    document.addEventListener('visibilitychange', onVisibility);
    // Safari < 14 unterstützt `addEventListener` nicht auf MediaQueryList,
    // dort fällt es lautlos aus — das ist OK, weil reduced-motion dann
    // nur beim Mount geprüft wird.
    motionQuery.addEventListener?.('change', onMotionChange);

    start();

    return () => {
      stop();
      ro.disconnect();
      globalThis.removeEventListener('mousemove', onMove);
      globalThis.removeEventListener('blur', clearMouse);
      document.removeEventListener('visibilitychange', onVisibility);
      motionQuery.removeEventListener?.('change', onMotionChange);
    };
  }, [density]);

  // Wir wrappen das canvas in einen aria-hidden div statt das Attribut
  // direkt aufs canvas zu legen (S6825). Das Canvas bleibt im DOM-Flow,
  // ist aber zusammen mit dem Wrapper für Screenreader unsichtbar.
  return (
    <div
      aria-hidden="true"
      className={
        className ??
        'pointer-events-none absolute inset-0 -z-10 h-full w-full'
      }
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none h-full w-full"
      />
    </div>
  );
}
