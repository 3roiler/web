import * as Sentry from "@sentry/react";

/**
 * Initialisiert Sentry für die SPA.
 *
 * Wird in `main.tsx` als allererster Aufruf gestartet — bevor React
 * gerendert wird. Für die Server-Seite siehe `3roiler/api`:
 * `services/sentry.ts` (selber Pattern, anderes SDK).
 *
 * Aktivierung:
 * - `VITE_SENTRY_DSN` als Build-Time-Env-Var setzen
 *   (Vite ersetzt sie beim Build durch ein String-Literal).
 * - Ohne gesetzten DSN ist die Funktion ein No-Op; keine Network-
 *   Requests, kein Error-Reporting. So kann der Build merge-fähig
 *   bleiben bevor das Sentry-Projekt existiert.
 *
 * DSGVO-Hinweise:
 * - DSN muss aus der EU-Region kommen (`*.ingest.de.sentry.io`).
 * - `sendDefaultPii: false` (SDK-Default) — wir senden NICHT
 *   automatisch IP/Cookies/Username. User-Id setzen wir explizit per
 *   `Sentry.setUser` nach erfolgreichem Login.
 * - **Session Replay ist NICHT aktiviert** — würde DOM-Recordings
 *   inklusive Eingabefeldern erzeugen, dafür braucht es eine
 *   Consent-Erweiterung im Cookie-Banner. Bei Bedarf nachreichen.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? "0"),
    release: import.meta.env.VITE_RELEASE || "dev",
    integrations: [
      // Browser-Tracing für Performance-Sampling. Default off via
      // tracesSampleRate=0; aktivieren durch Env-Var.
      Sentry.browserTracingIntegration()
    ]
  });
  console.log("[sentry] initialised", {
    env: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? "0"
  });
}

export { Sentry };
