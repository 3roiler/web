import { Link } from 'react-router-dom';
import { Routes } from '../config/routes';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-white/10 bg-slate-950 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 sm:px-10 lg:px-16">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-sm font-semibold text-slate-100">broiler.dev</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Platform- und Backend-Engineering von Paul Wechselberger.
              Pragmatisch, dokumentiert, zuverlässig.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Navigation
            </p>
            <ul className="mt-3 space-y-2 text-xs text-slate-400">
              <li><a href="/#top" className="hover:text-cyan-300">Start</a></li>
              <li><a href="/#skills" className="hover:text-cyan-300">Stack</a></li>
              <li><a href="/#projects" className="hover:text-cyan-300">Projekte</a></li>
              <li><Link to={Routes.Blog} className="hover:text-cyan-300">Blog</Link></li>
              <li><a href="/#contact" className="hover:text-cyan-300">Kontakt</a></li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Rechtliches &amp; Quellen
            </p>
            <ul className="mt-3 space-y-2 text-xs text-slate-400">
              <li>
                <Link to={Routes.Impressum} className="hover:text-cyan-300">
                  Impressum
                </Link>
              </li>
              <li>
                <Link to={Routes.Datenschutz} className="hover:text-cyan-300">
                  Datenschutz
                </Link>
              </li>
              <li>
                <a
                  href={Routes.External.GithubRepositoryWeb}
                  target="_blank"
                  rel="noopener"
                  className="hover:text-cyan-300"
                >
                  Quellcode dieser Seite
                </a>
              </li>
              <li>
                <a
                  href={Routes.External.PayPal}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-cyan-300"
                >
                  Kaffee spendieren
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-6 text-xs text-slate-500 sm:flex-row">
          <p>© {year} broiler.dev · Paul Wechselberger</p>
          <div className="flex items-center gap-4">
            <a href={Routes.External.Sonarcloud} target="_blank" rel="noopener">
              <img
                src="https://sonarcloud.io/images/project_badges/sonarcloud-light.svg"
                alt="SonarCloud"
                className="h-5"
              />
            </a>
            <a href={Routes.External.DigitalOcean} target="_blank" rel="noopener">
              <img
                src="https://web-platforms.sfo2.cdn.digitaloceanspaces.com/WWW/Badge%201.svg"
                alt="DigitalOcean Referral Badge"
                className="h-5"
              />
            </a>
            <a href="#top" className="hover:text-cyan-300">
              ↑ Nach oben
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
