import React from 'react';
import { Link } from 'react-router-dom';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-white/10 bg-slate-950/80 py-10">
      <div className="mx-auto flex flex-col items-center justify-between gap-4 px-6 text-xs text-slate-400 sm:flex-row sm:px-10 lg:px-16">
        <p>© {year} broiler.dev</p>
        <div className="flex items-center gap-4">
          <a href="https://sonarcloud.io/project/overview?id=3roiler_web"><img src="https://sonarcloud.io/images/project_badges/sonarcloud-light.svg" alt="SonarQube Badge" /></a>
          <a href="https://www.digitalocean.com/?refcode=203d563657de&utm_campaign=Referral_Invite&utm_medium=Referral_Program&utm_source=badge"><img src="https://web-platforms.sfo2.cdn.digitaloceanspaces.com/WWW/Badge%201.svg" alt="DigitalOcean Referral Badge" /></a>
          <a href="https://github.com/3roiler/web" target="_blank" rel="noopener" className="hover:text-cyan-300">Repository</a>
          <a
            href="https://paypal.me/bleikind"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-slate-300 transition hover:border-cyan-300 hover:text-cyan-200"
          >
            Kaffee spendieren
          </a>
          <a href="#top" className="hover:text-cyan-300">Nach oben</a>
          <Link to="/impressum" className="hover:text-cyan-300">Impressum</Link>
        </div>
      </div>
    </footer>
  );
}
