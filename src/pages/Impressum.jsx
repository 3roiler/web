import React from 'react';

export function ImpressumPage() {
  return (
    <main className="bg-slate-950/60 py-24" id="top">
      <div className="mx-auto max-w-4xl px-6 sm:px-10 lg:px-16 space-y-16 pt-24">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">Impressum</p>
        <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight text-slate-50 sm:text-5xl lg:text-6xl">Anbieterkennzeichnung & rechtliche Hinweise</h1>
        <p className="mt-8 max-w-2xl text-lg leading-relaxed text-slate-300">Private, nicht-kommerzielle Hobby-Webseite (HomeLab / Projekte). Keine journalistisch-redaktionellen Inhalte i.S.d. § 18 MStV. Keine Waren- oder Dienstleistungsangebote.</p>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-50">Verantwortlich gemäß § 5 TMG</h2>
          <div className="section-panel space-y-4 text-sm leading-relaxed text-slate-300">
            <p><strong className="text-slate-200">Name:</strong> (Privat) Paul Wechselberger</p>
            <p><strong className="text-slate-200">Anschrift:</strong> 38820 Halberstadt, Wehrstedter Str. 8</p>
            <p><strong className="text-slate-200">E-Mail:</strong> <a href="mailto:hello@broiler.dev" className="text-cyan-300 hover:text-cyan-200">hello@broiler.dev</a></p>
            <p><strong className="text-slate-200">Web:</strong> <a href="https://broiler.dev" className="text-cyan-300 hover:text-cyan-200" rel="noopener">https://broiler.dev</a></p>
            <p>Private Hobby-Seite (HomeLab / Experimente). Keine gewerbliche Tätigkeit, kein Angebot kostenpflichtiger Leistungen.</p>
            <p>Keine journalistisch-redaktionellen Inhalte i.S.d. § 18 MStV.</p>
            <p>Keine USt-ID, keine Registereintragung.</p>
            <p>Letzte inhaltliche Aktualisierung: 2025-11-15</p>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-50">Kontakt</h2>
          <div className="section-panel space-y-4 text-sm leading-relaxed text-slate-300">
            <p>Für Anfragen nutzen Sie bitte das Kontaktformular oder senden Sie eine E-Mail.</p>
            <p><a href="/#contact" className="inline-flex items-center rounded-full border border-white/10 bg-cyan-500/10 px-4 py-2 text-xs font-medium text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-400/40">Zum Kontaktbereich</a></p>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-50">Haftung für Inhalte</h2>
          <div className="section-panel space-y-4 text-sm leading-relaxed text-slate-300">
            <p>Alle Inhalte wurden mit Sorgfalt erstellt. Es wird keine Gewähr für Aktualität, Vollständigkeit oder Fehlerfreiheit übernommen. Technische Beschreibungen können sich ändern. Diese Seite dient ausschließlich der privaten Darstellung von Projekten.</p>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-50">Haftung für externe Links</h2>
          <div className="section-panel space-y-4 text-sm leading-relaxed text-slate-300">
            <p>Verlinkte Seiten wurden zum Zeitpunkt der Verlinkung kurz geprüft. Für deren aktuelle Inhalte besteht keine Verantwortung. Bei Kenntnis von Rechtsverstößen werden entsprechende Links entfernt.</p>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-50">Urheberrecht</h2>
          <div className="section-panel space-y-4 text-sm leading-relaxed text-slate-300">
            <p>Eigene Inhalte (Text / einfache Gestaltung) dürfen zum privaten Gebrauch referenziert werden. Weitergehende Nutzung, insbesondere automatisiertes Kopieren größerer Textteile, nur nach vorheriger vorheriger Zustimmung.</p>
            <p>Logos und Marken Dritter liegen bei den jeweiligen Rechteinhabern.</p>
            <p>Es werden keine Tracking-Cookies oder Analyse-Dienste eingesetzt.</p>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-50">Datenschutz</h2>
          <div className="section-panel space-y-4 text-sm leading-relaxed text-slate-300">
            <p>Personenbezogene Daten über das Kontaktformular werden ausschließlich zur Bearbeitung der Anfrage (Art. 6 Abs. 1 lit. b bzw. f DSGVO) verwendet. Keine Weitergabe an Dritte ohne Rechtsgrund.</p>
            <p><a href="/datenschutz" className="text-cyan-300 hover:text-cyan-200">Ausführliche Hinweise ansehen</a></p>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-50">EU-Streitschlichtung</h2>
          <div className="section-panel space-y-4 text-sm leading-relaxed text-slate-300">
            <p>Keine Teilnahme an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle, da keine gewerbliche Leistungen angeboten werden.</p>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-50">Technische Hinweise</h2>
          <div className="section-panel space-y-4 text-sm leading-relaxed text-slate-300">
            <p>Bereitstellung über eine Cloud-Umgebung. Logs zur Betriebs- und Sicherheitsanalyse können zeitlich begrenzt IP-bezogene Verbindungsdaten enthalten.</p>
            <p>Quelltext: <a href="https://github.com/3roiler/web" target="_blank" rel="noopener" className="text-cyan-300 hover:text-cyan-200">Repository</a></p>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-50">Änderungen</h2>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 space-y-4 text-sm leading-relaxed text-slate-300">
            <p>Inhalte und Hinweise können bei Bedarf angepasst werden. Letzte Aktualisierung: 2025-11-15.</p>
          </div>
        </section>

        <div className="pt-4">
          <a href="#top" className="nav-link text-xs">Nach oben</a>
        </div>
      </div>
    </main>
  );
}
