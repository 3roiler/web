import React from 'react';
import { Link } from 'react-router-dom';
import { loginToGithub, logout, getMe, User } from '../services';
import { Routes } from '../config/routes';


export function Header() {
  const [user, setUser] = React.useState<User | null>(null);
  const [avatarBroken, setAvatarBroken] = React.useState(false);

  const isAuthor = Boolean(user?.permissions?.includes('blog.write'));
  const isAdmin = Boolean(user?.permissions?.includes('admin.manage'));

  React.useEffect(() => {
    getMe().then(fetchedUser => {
      setUser(fetchedUser);
      setAvatarBroken(false);
    }).catch(() => {
      setUser(null);
    });
  }, []);

  const displayName = user?.displayName || user?.display_name || user?.name || '';
  const avatarUrl = user?.avatarUrl || null;
  const initial = displayName.slice(0, 1).toUpperCase() || '?';

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-6 bg-slate-900/80 backdrop-blur-md px-6 py-4 sm:px-10 lg:px-16" id="global-nav">
      <Link to="/" className="text-base font-semibold text-cyan-400">broiler.dev</Link>
      <ul className="flex flex-wrap gap-2 sm:gap-4">
        <li><a href="/#top" className="nav-link">Start</a></li>
        <li><a href="/#skills" className="nav-link">Stack</a></li>
        <li><a href="/#projects" className="nav-link">Projekte</a></li>
        <li><Link to={Routes.Blog} className="nav-link">Blog</Link></li>
        <li><a href="/#contact" className="nav-link">Kontakt</a></li>
        {isAuthor && (
          <li><Link to={Routes.BlogAdmin} className="nav-link">Blog-Admin</Link></li>
        )}
        {isAdmin && (
          <li><Link to={Routes.AdminUsers} className="nav-link">Nutzer</Link></li>
        )}
        {isAdmin && (
          <li><Link to={Routes.AdminGroups} className="nav-link">Gruppen</Link></li>
        )}
      </ul>

    { user ? (
      <div className="flex items-center gap-3">
        <Link to={Routes.Profile} className="flex items-center gap-2 group" aria-label="Profil">
          {avatarUrl && !avatarBroken ? (
            <img
              src={avatarUrl}
              alt=""
              onError={() => setAvatarBroken(true)}
              className="h-8 w-8 rounded-full border border-white/10 bg-slate-900 object-cover group-hover:border-cyan-400/60"
            />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-slate-900 text-xs font-semibold text-slate-300 group-hover:border-cyan-400/60">
              {initial}
            </span>
          )}
          <span className="text-sm text-slate-300 group-hover:text-cyan-300">{displayName}</span>
        </Link>
        <button onClick={() => { logout().then(() => setUser(null)); }} className="btn btn-sm">Abmelden</button>
      </div>
    ) : (
      <button onClick={() => loginToGithub()} className="btn btn-sm">Mit GitHub anmelden</button>
    ) }
    </nav>
  );
}
