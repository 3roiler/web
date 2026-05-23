import { Link } from 'react-router-dom';
import { Routes } from '../config/routes';

/**
 * Footer in vier Blöcken: Brand · Navigation · Rechtliches · Verbindung.
 * Die Aufteilung hält jede Spalte sehr schlank und lässt den Footer trotz
 * mehr Inhalt ruhig wirken. Bottom-Bar trägt das Copyright und die
 * Qualitäts-/Hosting-Badges, plus einen „Nach oben"-Sprungmark.
 *
 * Branding nutzt denselben cyan-Dot + Wordmark wie der Header — so
 * fühlt sich die Seite oben und unten zusammenhängend an, ohne ein
 * zweites Logo-Asset bauen zu müssen.
 */
export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-white/10 bg-slate-950 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 sm:px-10 lg:px-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <Link to="/" className="group inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,.6)] transition-transform group-hover:scale-125" />
              <span className="text-sm font-semibold tracking-tight text-slate-100 group-hover:text-cyan-300">
                broiler<span className="text-cyan-400">.dev</span>
              </span>
            </Link>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              Platform- und Backend-Engineering von Paul Wechselberger.
              Pragmatisch, dokumentiert, zuverlässig.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Navigation
            </p>
            <ul className="mt-3 space-y-2 text-xs text-slate-400">
              <li><a href="/#top" className="transition hover:text-cyan-300">Start</a></li>
              <li><a href="/#skills" className="transition hover:text-cyan-300">Stack</a></li>
              <li><a href="/#projects" className="transition hover:text-cyan-300">Projekte</a></li>
              <li><Link to={Routes.Blog} className="transition hover:text-cyan-300">Blog</Link></li>
              <li><Link to={Routes.Streamclips.Home} className="transition hover:text-cyan-300">Streamclips</Link></li>
              <li><a href="/#contact" className="transition hover:text-cyan-300">Kontakt</a></li>
            </ul>
          </div>

          {/* Rechtliches & Quellen */}
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Rechtliches &amp; Quellen
            </p>
            <ul className="mt-3 space-y-2 text-xs text-slate-400">
              <li>
                <Link to={Routes.Impressum} className="transition hover:text-cyan-300">
                  Impressum
                </Link>
              </li>
              <li>
                <Link to={Routes.Datenschutz} className="transition hover:text-cyan-300">
                  Datenschutz
                </Link>
              </li>
              <li>
                <a
                  href={Routes.External.GithubRepositoryWeb}
                  target="_blank"
                  rel="noopener"
                  className="transition hover:text-cyan-300"
                >
                  Quellcode dieser Seite
                </a>
              </li>
              <li>
                <a
                  href={Routes.External.PayPal}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition hover:text-cyan-300"
                >
                  Kaffee spendieren
                </a>
              </li>
            </ul>
          </div>

          {/* Verbindung */}
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Verbindung
            </p>
            <ul className="mt-3 space-y-2 text-xs text-slate-400">
              <li>
                <a
                  href={`mailto:${Routes.External.WebmasterEmail}`}
                  className="transition hover:text-cyan-300"
                >
                  E-Mail
                </a>
              </li>
              <li>
                <a
                  href={Routes.External.GithubProfile}
                  target="_blank"
                  rel="noopener"
                  className="transition hover:text-cyan-300"
                >
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href={Routes.External.LinkedIn}
                  target="_blank"
                  rel="noopener"
                  className="transition hover:text-cyan-300"
                >
                  LinkedIn
                </a>
              </li>
              <li>
                <a
                  href={Routes.External.Mastodon}
                  rel="me noopener"
                  target="_blank"
                  className="transition hover:text-cyan-300"
                >
                  Mastodon
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-6 text-xs text-slate-500 sm:flex-row">
          <p>© {year} broiler.dev · Paul Wechselberger</p>
          <div className="flex items-center gap-4">
            <a href={Routes.External.Sonarcloud} target="_blank" rel="noopener" aria-label="SonarCloud">
              <img
                src="https://sonarcloud.io/images/project_badges/sonarcloud-light.svg"
                alt="SonarCloud"
                className="h-5 opacity-80 transition hover:opacity-100"
              />
            </a>
            <a href={Routes.External.DigitalOcean} target="_blank" rel="noopener" aria-label="DigitalOcean">
              <img
                src="https://web-platforms.sfo2.cdn.digitaloceanspaces.com/WWW/Badge%201.svg"
                alt="DigitalOcean Referral Badge"
                className="h-5 opacity-80 transition hover:opacity-100"
              />
            </a>
            <a href="#top" className="transition hover:text-cyan-300">
              ↑ Nach oben
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
