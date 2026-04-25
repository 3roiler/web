import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { loginToGithub, logout, getMe, User } from '../services';
import { Routes } from '../config/routes';


/**
 * Only returns `url` if it parses as http(s). Prevents user-controlled
 * strings from landing in an <img src=> that CodeQL would flag as
 * "DOM text reinterpreted as HTML".
 */
function safeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    // Return the parser's canonical string so CodeQL's taint analysis
    // considers the value sanitized (raw pass-through is not recognised).
    return parsed.toString();
  } catch {
    return null;
  }
}

interface NavLinkSpec {
  label: string;
  href?: string;
  to?: string;
}

const NAV_LINKS: NavLinkSpec[] = [
  { label: 'Start',    href: '/#top' },
  { label: 'Stack',    href: '/#skills' },
  { label: 'Projekte', href: '/#projects' },
  { label: 'Blog',     to: Routes.Blog },
  { label: 'Kontakt',  href: '/#contact' }
];

export function Header() {
  const [user, setUser] = React.useState<User | null>(null);
  const [avatarBroken, setAvatarBroken] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const location = useLocation();

  /**
   * Zeigt den Dashboard-Link, sobald der Nutzer mindestens `dashboard.view`
   * (direkt oder via `admin.manage`) besitzt. Die einzelnen Unterbereiche
   * (Blog / Nutzer / Gruppen) werden im Dashboard selbst weiter gefiltert,
   * damit der Header nicht zuwuchert.
   */
  const canSeeDashboard = Boolean(
    user?.permissions?.some((p) => p === 'dashboard.view' || p === 'admin.manage')
  );

  React.useEffect(() => {
    getMe().then(fetchedUser => {
      setUser(fetchedUser);
      setAvatarBroken(false);
    }).catch(() => {
      setUser(null);
    });
  }, []);

  /**
   * Close the mobile drawer whenever we navigate to a new path. Otherwise
   * the menu would stay open behind the new page after a click on a link.
   */
  React.useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.hash]);

  /**
   * Lock background scroll while the drawer is open so the user can't
   * accidentally scroll the underlying page when swiping the menu.
   * Restored on cleanup so navigation away leaves the body untouched.
   */
  React.useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  const displayName = user?.displayName || user?.display_name || user?.name || '';
  const avatarUrl = safeHttpUrl(user?.avatarUrl);
  const initial = displayName.slice(0, 1).toUpperCase() || '?';

  const handleLogout = () => {
    logout().then(() => setUser(null));
  };

  /** Renders one nav entry — RouterLink for SPA paths, anchor otherwise. */
  function renderNavEntry(entry: NavLinkSpec, className: string) {
    if (entry.to) {
      return <Link to={entry.to} className={className}>{entry.label}</Link>;
    }
    return <a href={entry.href} className={className}>{entry.label}</a>;
  }

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-slate-900/80 backdrop-blur-md"
      id="global-nav"
    >
      <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4 lg:px-16">
        <Link to="/" className="text-base font-semibold text-cyan-400 shrink-0" onClick={() => setMobileOpen(false)}>
          broiler.dev
        </Link>

        {/* Desktop nav — collapses into the hamburger drawer below `md`. */}
        <ul className="hidden md:flex items-center gap-2 lg:gap-3">
          {NAV_LINKS.map((entry) => (
            <li key={entry.label}>{renderNavEntry(entry, 'nav-link')}</li>
          ))}
          {canSeeDashboard && (
            <li><Link to={Routes.Dashboard.Home} className="nav-link">Dashboard</Link></li>
          )}
        </ul>

        {/* Desktop auth area. On mobile this lives inside the drawer. */}
        <div className="hidden md:flex items-center gap-3">
          <DesktopAuth
            user={user}
            displayName={displayName}
            avatarUrl={avatarUrl}
            avatarBroken={avatarBroken}
            initial={initial}
            onAvatarError={() => setAvatarBroken(true)}
            onLogout={handleLogout}
          />
        </div>

        {/* Mobile hamburger. Larger hit area (44×44) than the visual icon. */}
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-slate-200 transition hover:border-cyan-400/40 hover:bg-cyan-500/10"
          aria-label={mobileOpen ? 'Menü schließen' : 'Menü öffnen'}
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
        >
          {mobileOpen ? <CloseIcon /> : <BurgerIcon />}
        </button>
      </div>

      {/* Mobile drawer. Rendered inside the same nav so focus order stays
          natural and CSS `border-b` of the bar separates it visually. */}
      <div
        id="mobile-menu"
        className={`md:hidden overflow-hidden border-t border-white/10 bg-slate-900/95 backdrop-blur-md transition-[max-height,opacity] duration-200 ${
          mobileOpen ? 'max-h-[80vh] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
        }`}
      >
        <ul className="flex flex-col gap-1 px-4 py-3">
          {NAV_LINKS.map((entry) => (
            <li key={entry.label}>{renderNavEntry(entry, 'mobile-nav-link')}</li>
          ))}
          {canSeeDashboard && (
            <li>
              <Link to={Routes.Dashboard.Home} className="mobile-nav-link">Dashboard</Link>
            </li>
          )}
        </ul>
        <div className="border-t border-white/10 px-4 py-3">
          <MobileAuth
            user={user}
            displayName={displayName}
            avatarUrl={avatarUrl}
            avatarBroken={avatarBroken}
            initial={initial}
            onAvatarError={() => setAvatarBroken(true)}
            onLogout={handleLogout}
          />
        </div>
      </div>
    </nav>
  );
}

interface AuthBlockProps {
  user: User | null;
  displayName: string;
  avatarUrl: string | null;
  avatarBroken: boolean;
  initial: string;
  onAvatarError: () => void;
  onLogout: () => void;
}

function DesktopAuth(props: AuthBlockProps) {
  const { user, displayName, avatarUrl, avatarBroken, initial, onAvatarError, onLogout } = props;
  if (!user) {
    return (
      <button type="button" onClick={() => loginToGithub()} className="btn btn-sm">
        Mit GitHub anmelden
      </button>
    );
  }
  return (
    <>
      <Link to={Routes.Profile} className="flex items-center gap-2 group" aria-label="Profil">
        {avatarUrl && !avatarBroken ? (
          <img
            src={avatarUrl}
            alt=""
            onError={onAvatarError}
            className="h-8 w-8 rounded-full border border-white/10 bg-slate-900 object-cover group-hover:border-cyan-400/60"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-slate-900 text-xs font-semibold text-slate-300 group-hover:border-cyan-400/60">
            {initial}
          </span>
        )}
        <span className="hidden lg:inline text-sm text-slate-300 group-hover:text-cyan-300">
          {displayName}
        </span>
      </Link>
      <button type="button" onClick={onLogout} className="btn btn-sm">Abmelden</button>
    </>
  );
}

function MobileAuth(props: AuthBlockProps) {
  const { user, displayName, avatarUrl, avatarBroken, initial, onAvatarError, onLogout } = props;
  if (!user) {
    return (
      <button type="button" onClick={() => loginToGithub()} className="btn w-full justify-center">
        Mit GitHub anmelden
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <Link to={Routes.Profile} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/5">
        {avatarUrl && !avatarBroken ? (
          <img
            src={avatarUrl}
            alt=""
            onError={onAvatarError}
            className="h-10 w-10 rounded-full border border-white/10 bg-slate-900 object-cover"
          />
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-slate-900 text-sm font-semibold text-slate-300">
            {initial}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-100">
          {displayName}
        </span>
        <span className="text-xs text-slate-500">Profil</span>
      </Link>
      <button type="button" onClick={onLogout} className="btn-outline w-full justify-center">
        Abmelden
      </button>
    </div>
  );
}

function BurgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
