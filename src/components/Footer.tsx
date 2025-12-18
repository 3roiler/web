import { Link } from 'react-router-dom';
import { Routes } from '../config/routes';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-white/10 bg-slate-950/80 py-10">
      <div className="mx-auto flex flex-col items-center justify-between gap-4 px-6 text-xs text-slate-400 sm:flex-row sm:px-10 lg:px-16">
        <p>© {year} broiler.dev</p>
        <div className="flex items-center gap-4">
          <a href={Routes.External.Sonarcloud}>
            <img src="https://sonarcloud.io/images/project_badges/sonarcloud-light.svg" alt="SonarQube Badge" />
            </a>
          <a href={Routes.External.DigitalOcean} target="_blank" rel="noopener">
            <img src="https://web-platforms.sfo2.cdn.digitaloceanspaces.com/WWW/Badge%201.svg" alt="DigitalOcean Referral Badge" />
            </a>
          <a href={Routes.External.GithubRepositoryWeb} target="_blank" rel="noopener" className="hover:text-cyan-300">Repository</a>
          <a href={Routes.External.PayPal} target="_blank" rel="noopener noreferrer" className="hover:text-cyan-300">Kaffee spendieren</a>
          <a href={Routes.Impressum} target="_blank" rel="noopener noreferrer" className="hover:text-cyan-300">Impressum</a>
          <a href="#top" className="hover:text-cyan-300">Nach oben</a>
        </div>
      </div>
    </footer>
  );
}
