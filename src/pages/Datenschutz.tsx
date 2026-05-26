import { navigateTo, Routes } from "../config/routes";
import { nuke } from "../services";
import { Seo } from "../components/Seo";

/**
 * Konto-Anonymisierung. Backend erfolgt seit Migration 038 als
 * Soft-Delete + PII-Wipe — die Foreign-Key-Beziehungen aus Clips und
 * Kommentaren bleiben bestehen, der Author erscheint dort fortan als
 * „Gelöschter Nutzer". Hard-Delete würde die Beiträge mit reißen,
 * was Community-Wissen zerstören würde. Der Begriff „Nuke" im UI
 * wäre also irreführend; Buttontext + Bestätigungs-Text spiegeln das
 * neue Verhalten.
 */
async function handleAnonymize() {
  const confirmation = confirm(
    [
      "Konto löschen?",
      "",
      "Dein Profil wird sofort anonymisiert: Name, E-Mail, Avatar und OAuth-Verknüpfungen werden entfernt.",
      "",
      'Deine eingereichten Clips, Bewertungen und Kommentare BLEIBEN ÖFFENTLICH SICHTBAR, werden aber nur noch als "Gelöschter Nutzer" angezeigt.',
      "",
      "Diese Aktion ist endgültig — eine Wiederherstellung ist nicht möglich."
    ].join("\n")
  );
  if (!confirmation) return;

  try {
    await nuke();
    alert(
      'Dein Konto wurde anonymisiert. Eingereichte Inhalte bleiben unter "Gelöschter Nutzer" sichtbar. Du wirst jetzt ausgeloggt.'
    );
    navigateTo(Routes.Home);
  } catch {
    alert(
      "Beim Anonymisieren ist ein Fehler aufgetreten. Bitte versuche es später erneut oder schreib uns eine kurze Nachricht."
    );
  }
}

export function DatenschutzPage() {
  return (
    <main className="mt-24 pb-24 bg-slate-950" id="top">
      <Seo
        title="Datenschutz"
        description="Datenschutzerklärung von broiler.dev — minimale Daten, DSGVO-konform."
      />
      <div className="mx-auto max-w-3xl px-6 sm:px-10 lg:px-16 space-y-8">
        <h1 className="text-4xl font-semibold text-slate-50 sm:text-5xl">Datenschutz</h1>
        <p className="mt-4 text-slate-300 text-sm leading-relaxed">
          Kurzfassung: sparsame Datenverarbeitung. Werbung über Google AdSense — Werbe-Cookies nur
          nach deiner Einwilligung.
        </p>
        <div className="space-y-4 text-sm leading-relaxed text-slate-300">
          <section className="panel p-5">
            <h2 className="font-semibold text-slate-50">Verantwortlich</h2>
            <p>
              Privat: Paul Wechselberger
              <a href="mailto:paul@broiler.dev" className="text-cyan-300 hover:text-cyan-200">
                paul@broiler.dev
              </a>
            </p>
          </section>
          <section className="panel p-5">
            <h2 className="font-semibold text-slate-50">Daten</h2>
            <p>
              Kontaktformular: Name, E-Mail, Nachricht. Server-Logs: IP, Zeit, URL, User-Agent
              (Kurzfristig, max. 30 Tage). GitHub-Login: GitHub-Benutzername + verifizierte E-Mail
              aus dem OAuth-Profil (nur zur Konto-Verwaltung gespeichert).
            </p>
          </section>
          <section className="panel p-5">
            <h2 className="font-semibold text-slate-50">Zweck & Rechtsgrundlage</h2>
            <p>
              Kommunikation (Art. 6(1)(f)); bei konkreten Vertragsanfragen Art. 6(1)(b). Freiwillige
              Zusatzinfos: Einwilligung Art. 6(1)(a) - widerrufbar.
            </p>
          </section>
          <section className="panel p-5">
            <h2 className="font-semibold text-slate-50">Speicherung</h2>
            <p>Kontakt max. 3 Monate, Logs rotierend ≤ 30 Tage (Art. 5(1)(e)).</p>
          </section>
          <section className="panel p-5">
            <h2 className="font-semibold text-slate-50">GitHub-Anmeldung & Cookie</h2>
            <p>
              Die Anmeldung läuft über GitHub OAuth. api.broiler.dev setzt dafür ein
              funktionsnotwendiges Cookie mit einer zufälligen Session-ID, um die Rückkehr von
              GitHub sicher einer Anfrage zuzuordnen (keine Werbe- oder Trackingzwecke).
            </p>
            <p>
              Über den Login werden ausschließlich GitHub-Benutzername und bestätigte E-Mail
              abgerufen und in der internen Datenbank hinterlegt, bis du das Konto löschst oder uns
              zur Löschung aufforderst.
            </p>
          </section>
          <section className="panel p-5">
            <h2 className="font-semibold text-slate-50">Hosting</h2>
            <p>
              DigitalOcean. Werbung über Google AdSense (siehe „Werbung"). Etwaige
              Drittlandübertragung nach Art. 44 ff mit geeigneten Garantien.
            </p>
          </section>
          <section className="panel p-5">
            <h2 className="font-semibold text-slate-50">Rechte</h2>
            <p>
              Art. 15-21 DSGVO (Auskunft, Berichtigung, Löschung, Einschränkung, Übertragbarkeit,
              Widerspruch) + Widerruf Art. 7(3).
            </p>
          </section>
          <section className="panel p-5">
            <h2 className="font-semibold text-slate-50">Sicherheit & Logs</h2>
            <p>
              TLS, beschränkter Zugriff. Logs nur zur Stabilität/Missbrauchsschutz (Art. 6(1)(f),
              Art. 32). Keine eigene Profilbildung; Werbe-Personalisierung ggf. durch Google nach
              Einwilligung.
            </p>
          </section>
          <section className="panel p-5">
            <h2 className="font-semibold text-slate-50">Cookies / Tracking</h2>
            <p>
              Funktionsnotwendig: das oben genannte api.broiler.dev-Login-Cookie (Session,
              first-party, kurzlebig) sowie ein CSRF-Token-Cookie. Keine eigenen Analyse-Dienste.
              Werbe-Cookies durch Google AdSense nur nach deiner Einwilligung (siehe „Werbung").
            </p>
          </section>
          <section className="panel p-5">
            <h2 className="font-semibold text-slate-50">Werbung (Google AdSense)</h2>
            <p>
              Auf dieser Website wird Google AdSense (Google Ireland Limited, Gordon House, Barrow
              Street, Dublin 4, Irland) zur Anzeige von Werbung eingesetzt. Google kann dabei
              Cookies und ähnliche Technologien verwenden, um Anzeigen auszuliefern, zu messen und –
              nach Einwilligung – zu personalisieren.
            </p>
            <p>
              Werbe-Cookies und personalisierte Werbung erfolgen ausschließlich mit deiner
              Einwilligung über das Consent-Banner. Ohne Einwilligung werden keine Werbe-Cookies
              gesetzt (Google Consent Mode v2, Standard: abgelehnt). Rechtsgrundlage: Einwilligung
              (Art. 6(1)(a) DSGVO), jederzeit mit Wirkung für die Zukunft widerrufbar.
            </p>
            <p>
              Mehr Infos:{" "}
              <a
                href="https://policies.google.com/privacy"
                className="text-cyan-300 hover:text-cyan-200"
                rel="noopener"
                target="_blank"
              >
                Google Datenschutzerklärung
              </a>{" "}
              ·{" "}
              <a
                href="https://adssettings.google.com"
                className="text-cyan-300 hover:text-cyan-200"
                rel="noopener"
                target="_blank"
              >
                Werbe-Einstellungen
              </a>
              .
            </p>
          </section>
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="font-semibold text-slate-50">Automatisierte Entscheidungen</h2>
            <p>Kein Profiling / keine Entscheidungen nach Art. 22.</p>
          </section>
          <p className="text-xs text-slate-400">Stand: 2026-05-20</p>
        </div>
        <section className="panel p-5 border-red-400/30">
          <h2 className="font-semibold text-slate-50">Konto löschen</h2>
          <p className="mt-1 text-slate-300">
            Konto-Löschung läuft als Anonymisierung: dein Profil wird sofort entfernt (Name, E-Mail,
            Avatar, OAuth-Verknüpfungen), deine
            <strong className="text-slate-100"> Beiträge bleiben aber öffentlich</strong> (Clips,
            Bewertungen, Kommentare) und werden als
            <em className="text-slate-300"> „Gelöschter Nutzer"</em> angezeigt. So bleibt der
            Community-Kontext (Threads, Bewertungen) erhalten, ohne dass deine Identität damit
            verbunden ist.
          </p>
          <p className="mt-2 text-slate-300">
            Wenn du auch die Beiträge selbst entfernt haben möchtest, schreib uns bitte per E-Mail —
            wir prüfen das im Einzelfall (DSGVO-Art. 17 mit den dort vorgesehenen Ausnahmen).
          </p>
        </section>
        <div className="flex flex-wrap items-center gap-4">
          <a href="/" className="btn-outline btn-sm">
            Zurück
          </a>
          <button
            onClick={handleAnonymize}
            className="inline-flex items-center justify-center rounded-full bg-red-500/80 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-500"
            aria-label="Konto anonymisieren"
          >
            Konto anonymisieren
          </button>
        </div>
      </div>
    </main>
  );
}
