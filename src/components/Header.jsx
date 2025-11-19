import { Link } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import { isAuthenticated, loginWithGitHub, logout, onAuthChange } from '../services/service.ts';

export function Header() {
  const [authed, setAuthed] = useState(isAuthenticated());
  const [loadingLogout, setLoadingLogout] = useState(false);

  useEffect(() => {
    const off = onAuthChange((isAuthed) => setAuthed(isAuthed));
    return off;
  }, []);

  const handleLogin = () => {
    loginWithGitHub();
  };

  const handleLogout = async () => {
    setLoadingLogout(true);
    await logout();
    setLoadingLogout(false);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-6 bg-slate-900/80 backdrop-blur-md px-6 py-4 sm:px-10 lg:px-16" id="global-nav">
  <Link to="/" className="text-base font-semibold text-cyan-400">broiler.dev</Link>
      <ul className="flex sm:gap-4">
  <li><Link to="/" className="nav-link">Start</Link></li>
  <li><a href="/#projects" className="nav-link">Projekte</a></li>
  <li><a href="/#contact" className="nav-link">Kontakt</a></li>
  <li className="hidden sm:block"><Link to="/impressum" className="nav-link">Impressum</Link></li>
  <li className="hidden sm:block"><Link to="/datenschutz" className="nav-link">Datenschutz</Link></li>
        <li>
          {authed ? (
            <button
              onClick={handleLogout}
              disabled={loadingLogout}
              className="nav-link px-3 py-1 rounded bg-red-600/80 hover:bg-red-600 text-white disabled:opacity-50"
            >
              {loadingLogout ? 'Abmelden…' : 'Abmelden'}
            </button>
          ) : (
            <button
              onClick={handleLogin}
              className="nav-link px-3 py-1 rounded bg-emerald-600/80 hover:bg-emerald-600 text-white"
            >
              Anmelden per GitHub
            </button>
          )}
        </li>
      </ul>
    </nav>
  );
}
