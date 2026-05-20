import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { loginToGithub, loginToTwitch, logout, getMe, User } from '../services';
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
  { label: 'Streamclips', to: Routes.Streamclips.Home },
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

  /** Public link to the print-request submission page. Visible to anyone
   *  who can submit (`print.request`) or moderate (`print.moderate`,
   *  which usually comes via `admin.manage`). */
  const canSeePrintRequest = Boolean(
    user?.permissions?.some(
      (p) => p === 'print.request' || p === 'print.moderate' || p === 'admin.manage'
    )
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
          {canSeePrintRequest && (
            <li><Link to={Routes.PrintRequest} className="nav-link">Druckanfrage</Link></li>
          )}
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
          {canSeePrintRequest && (
            <li>
              <Link to={Routes.PrintRequest} className="mobile-nav-link">Druckanfrage</Link>
            </li>
          )}
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
      <>
        <button
          type="button"
          onClick={() => loginToGithub()}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400"
        >
          <GithubIcon /> GitHub
        </button>
        <button
          type="button"
          onClick={() => loginToTwitch()}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#9146FF] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#772ce8]"
        >
          <TwitchIcon /> Twitch
        </button>
      </>
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
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => loginToGithub()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
        >
          <GithubIcon /> GitHub
        </button>
        <button
          type="button"
          onClick={() => loginToTwitch()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#9146FF] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#772ce8]"
        >
          <TwitchIcon /> Twitch
        </button>
      </div>
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

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-4 w-4">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
    </svg>
  );
}

function TwitchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-4 w-4">
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
    </svg>
  );
}
