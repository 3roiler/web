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
 *  - `aria-hidden`, weil rein dekorativ.
 *  - `pointer-events-none`, damit Buttons/Links im Vordergrund weiter
 *    direkt anklickbar bleiben.
 */
export interface ParticleFieldProps {
  /** Multiplikator auf die berechnete Partikelzahl. Default 1. Werte unter
   *  1 = leiser, über 1 = dichter (nur sparsam einsetzen). */
  density?: number;
  /** Zusätzliche Klassen für das Canvas (Positionierung/Sizing). */
  className?: string;
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

export function ParticleField({ density = 1, className }: ParticleFieldProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Reduced motion respektieren — komplett kein Render. Wir tracken auch
    // Änderungen zur Laufzeit (User toggelt OS-Setting im offenen Tab).
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let prefersReduced = motionQuery.matches;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.24,
        vy: (Math.random() - 0.5) * 0.24,
        r: 1.1 + Math.random() * 0.9
      };
    }

    function resize() {
      // `canvas`/`ctx` sind oben null-gecheckt, aber TS verliert das
      // Narrowing in nested function declarations (Hoisting). Die
      // Non-Null-Assertions sind hier sicher.
      const rect = canvas!.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      // DPR-Cap: 4K-Displays sonst 4× Pixel-Arbeit für minimal sichtbare
      // Schärfe-Gewinne. 2 ist der Sweet-Spot für Retina.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.max(1, Math.floor(width * dpr));
      canvas!.height = Math.max(1, Math.floor(height * dpr));
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const target = Math.max(
        20,
        Math.min(120, Math.round(((width * height) / PARTICLE_AREA_DIVISOR) * density))
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

    function step() {
      ctx!.clearRect(0, 0, width, height);

      // 1) Positionen aktualisieren — toroidaler Rand, damit die Dichte
      //    konstant bleibt. Keine Beschleunigungen, keine Wandkollisionen.
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x += width;
        else if (p.x > width) p.x -= width;
        if (p.y < 0) p.y += height;
        else if (p.y > height) p.y -= height;
      }

      // 2) Linien zwischen Punktpaaren. Alpha skaliert quadratisch mit der
      //    Nähe — entfernte Verbindungen sind nahezu unsichtbar, sehr nahe
      //    Paare wirken wie gemalte Striche. Das macht das Netz dynamisch
      //    ohne dass irgendwo eine harte Sichtbarkeitsgrenze blitzt.
      ctx!.lineWidth = 1;
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSq = dx * dx + dy * dy;
          if (distSq > LINK_DISTANCE * LINK_DISTANCE) continue;
          const t = 1 - Math.sqrt(distSq) / LINK_DISTANCE;
          const alpha = t * t * 0.32;
          ctx!.strokeStyle = `rgba(103, 232, 249, ${alpha})`; // cyan-300
          ctx!.beginPath();
          ctx!.moveTo(a.x, a.y);
          ctx!.lineTo(b.x, b.y);
          ctx!.stroke();
        }
      }

      // 3) Maus-Interaktion. Wir berechnen die Distanz nur einmal pro
      //    Partikel und benutzen das Ergebnis sowohl für die Linie zur
      //    Maus als auch für den Glow-Faktor beim Punkt. Spart einen
      //    zweiten Pass.
      const mouseDistSq = MOUSE_DISTANCE * MOUSE_DISTANCE;
      for (const p of particles) {
        const dx = p.x - mouseX;
        const dy = p.y - mouseY;
        const distSq = dx * dx + dy * dy;
        let proximity = 0;
        if (distSq < mouseDistSq) {
          proximity = 1 - Math.sqrt(distSq) / MOUSE_DISTANCE;
          // Linie Punkt → Maus
          ctx!.strokeStyle = `rgba(34, 211, 238, ${proximity * 0.55})`; // cyan-400
          ctx!.beginPath();
          ctx!.moveTo(p.x, p.y);
          ctx!.lineTo(mouseX, mouseY);
          ctx!.stroke();
        }

        // Punkt selbst. Punkte nah an der Maus werden heller und etwas
        // größer — das ist die einzige „Reaktion", die der User sieht.
        ctx!.fillStyle = `rgba(165, 243, 252, ${BASE_PARTICLE_OPACITY + proximity * 0.55})`; // cyan-200
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r + proximity * 1.4, 0, Math.PI * 2);
        ctx!.fill();
      }

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
    // mousemove auf `window`, damit die Maus auch dann den Hover-Effekt
    // auslöst, wenn sie über einen Vordergrund-Button (mit eigenem
    // pointer-events: auto) zieht. Distanz wird gegen das Canvas-Rect
    // umgerechnet, daher bleibt es lokal.
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('blur', clearMouse);
    document.addEventListener('visibilitychange', onVisibility);
    // Safari < 14 unterstützt `addEventListener` nicht auf MediaQueryList,
    // dort fällt es lautlos aus — das ist OK, weil reduced-motion dann
    // nur beim Mount geprüft wird.
    motionQuery.addEventListener?.('change', onMotionChange);

    start();

    return () => {
      stop();
      ro.disconnect();
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('blur', clearMouse);
      document.removeEventListener('visibilitychange', onVisibility);
      motionQuery.removeEventListener?.('change', onMotionChange);
    };
  }, [density]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={
        className ??
        'pointer-events-none absolute inset-0 -z-10 h-full w-full'
      }
    />
  );
}
