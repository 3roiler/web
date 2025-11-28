import { nuke } from "../services";

export function DatenschutzPage() {
  return (
    <main className="mt-24 pb-24 bg-slate-950" id="top">
      <div className="mx-auto max-w-3xl px-6 sm:px-10 lg:px-16 space-y-8">
        <h1 className="text-4xl font-semibold text-slate-50 sm:text-5xl">Datenschutz</h1>
        <p className="mt-4 text-slate-300 text-sm leading-relaxed">Kurzfassung: minimale Daten, keine Werbung, kein Tracking.</p>
        <div className="space-y-4 text-sm leading-relaxed text-slate-300">
          <section className="panel p-5">
            <h2 className="font-semibold text-slate-50">Verantwortlich</h2>
            <p>Privat: Paul Wechselberger<br />38820 Halberstadt, Wehrstedter Str. 8<br /><a href="mailto:paul@broiler.dev" className="text-cyan-300 hover:text-cyan-200">hello@broiler.dev</a></p>
          </section>
          <section className="panel p-5">
            <h2 className="font-semibold text-slate-50">Daten</h2>
            <p>Kontaktformular: Name, E-Mail, Nachricht. Server-Logs: IP, Zeit, URL, User-Agent (Kurzfristig, max. 30 Tage). GitHub-Login: GitHub-Benutzername + verifizierte E-Mail aus dem OAuth-Profil (nur zur Konto-Verwaltung gespeichert).</p>
          </section>
          <section className="panel p-5">
            <h2 className="font-semibold text-slate-50">Zweck & Rechtsgrundlage</h2>
            <p>Kommunikation (Art. 6(1)(f)); bei konkreten Vertragsanfragen Art. 6(1)(b). Freiwillige Zusatzinfos: Einwilligung Art. 6(1)(a) - widerrufbar.</p>
          </section>
          <section className="panel p-5">
            <h2 className="font-semibold text-slate-50">Speicherung</h2>
            <p>Kontakt max. 3 Monate, Logs rotierend ≤ 30 Tage (Art. 5(1)(e)).</p>
          </section>
          <section className="panel p-5">
            <h2 className="font-semibold text-slate-50">GitHub-Anmeldung & Cookie</h2>
            <p>Die Anmeldung läuft über GitHub OAuth. api.broiler.dev setzt dafür ein funktionsnotwendiges Cookie mit einer zufälligen Session-ID, um die Rückkehr von GitHub sicher einer Anfrage zuzuordnen (keine Werbe- oder Trackingzwecke).</p>
            <p>Über den Login werden ausschließlich GitHub-Benutzername und bestätigte E-Mail abgerufen und in der internen Datenbank hinterlegt, bis du das Konto löschst oder uns zur Löschung aufforderst.</p>
          </section>
          <section className="panel p-5">
            <h2 className="font-semibold text-slate-50">Hosting</h2>
            <p>DigitalOcean. Keine Weitergabe an Werbedritte. Etwaige Drittlandübertragung nach Art. 44 ff mit geeigneten Garantien.</p>
          </section>
          <section className="panel p-5">
            <h2 className="font-semibold text-slate-50">Rechte</h2>
            <p>Art. 15-21 DSGVO (Auskunft, Berichtigung, Löschung, Einschränkung, Übertragbarkeit, Widerspruch) + Widerruf Art. 7(3).</p>
          </section>
          <section className="panel p-5">
            <h2 className="font-semibold text-slate-50">Sicherheit & Logs</h2>
            <p>TLS, beschränkter Zugriff. Logs nur zur Stabilität/Missbrauchsschutz (Art. 6(1)(f), Art. 32). Keine Profilbildung.</p>
          </section>
          <section className="panel p-5">
            <h2 className="font-semibold text-slate-50">Cookies / Tracking</h2>
            <p>Keine Tracking-Cookies, keine Analyse-Dienste. Lediglich das oben genannte api.broiler.dev-Login-Cookie (Session, first-party, kurzlebig).</p>
          </section>
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="font-semibold text-slate-50">Automatisierte Entscheidungen</h2>
            <p>Kein Profiling / keine Entscheidungen nach Art. 22.</p>
          </section>
          <p className="text-xs text-slate-400">Stand: 2025-11-28</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <a href="/" className="nav-link">Zurück</a>
          <a
            onClick={
              async () => {
                try {
                  await nuke();
                  alert("Dein Konto wurde gelöscht. Du wirst zur Startseite weitergeleitet.");
                  window.location.href = "/";
                } catch {
                  alert("Beim Löschen deines Kontos ist ein Fehler aufgetreten. Bitte versuche es später erneut.");
                }
              }
            }
            className="inline-flex items-center justify-center rounded-2xl bg-cyan-400/90 px-5 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-300"
            aria-label="Automatische Kontolöschung starten"
          >
            Konto-Löschung anstoßen
          </a>
        </div>
      </div>
    </main>
  );
}