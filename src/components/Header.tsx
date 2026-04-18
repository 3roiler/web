import React from 'react';
import { Link } from 'react-router-dom';
import { loginToGithub, logout, getMe, User } from '../services';
import { Routes } from '../config/routes';


export function Header() {
  const [user, setUser] = React.useState<User | null>(null);

  const isAuthor = Boolean(user?.permissions?.includes('blog.write'));
  const isAdmin = Boolean(user?.permissions?.includes('admin.manage'));

  React.useEffect(() => {
    getMe().then(fetchedUser => {
      setUser(fetchedUser);
    }).catch(() => {
      setUser(null);
    });
  }, []);

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
      </ul>

    { user ? (
      <div className="flex items-center gap-4">
        <span className="text-sm text-slate-300">{user.display_name || user.name}</span>
        <button onClick={() => { logout().then(() => setUser(null)); }} className="btn btn-sm">Abmelden</button>
      </div>
    ) : (
      <button onClick={() => loginToGithub()} className="btn btn-sm">Mit GitHub anmelden</button>
    ) }
    </nav>
  );
}
