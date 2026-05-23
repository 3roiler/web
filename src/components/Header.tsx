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

/**
 * Top-level Navi. Hash-Einträge (`/#anchor`) sind Sprungmarken auf der
 * Startseite, `to`-Einträge sind echte SPA-Routen. Dashboard/Druckanfrage
 * sind permission-gegated und leben deshalb im Avatar-Dropdown — die
 * Hauptzeile soll auf den ersten Blick lesbar bleiben.
 */
interface NavLinkSpec {
  label: string;
  href?: string;
  to?: string;
  /** Pfad-Präfixe, die den Eintrag als aktiv markieren (zusätzlich zu `to`). */
  prefixes?: string[];
}

const NAV_LINKS: NavLinkSpec[] = [
  { label: 'Start',       href: '/#top' },
  { label: 'Stack',       href: '/#skills' },
  { label: 'Projekte',    href: '/#projects' },
  { label: 'Blog',        to: Routes.Blog, prefixes: ['/blog'] },
  { label: 'Streamclips', to: Routes.Streamclips.Home, prefixes: ['/streamclips'] },
  { label: 'Kontakt',     href: '/#contact' }
];

/**
 * Liefert `true` wenn der Eintrag bei der aktuellen Location als aktiv
 * gelten soll. Hash-Einträge (Anchors) sind nur auf `/` aktiv und müssen
 * den Hash treffen — andernfalls würden alle Anchor-Items auf jeder
 * Subseite den Active-Indikator zeigen.
 */
function isNavActive(entry: NavLinkSpec, pathname: string, hash: string): boolean {
  if (entry.to) {
    if (pathname === entry.to) return true;
    return entry.prefixes?.some((p) => pathname.startsWith(p)) ?? false;
  }
  if (entry.href && pathname === '/') {
    // Anker greifen nur, wenn der Hash 1:1 matched. Für `/#top` zählt auch
    // der Default-Zustand (kein Hash) als aktiv, sonst hätte die Startseite
    // beim ersten Aufruf keinen Indikator.
    if (entry.href === '/#top') {
      return hash === '' || hash === '#top';
    }
    return entry.href === `/${hash}`;
  }
  return false;
}

export function Header() {
  const [user, setUser] = React.useState<User | null>(null);
  const [avatarBroken, setAvatarBroken] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [accountOpen, setAccountOpen] = React.useState(false);
  const location = useLocation();
  const accountMenuRef = React.useRef<HTMLDivElement | null>(null);

  /**
   * Zeigt den Dashboard-Eintrag, sobald der Nutzer mindestens `dashboard.view`
   * (direkt oder via `admin.manage`) besitzt. Die einzelnen Unterbereiche
   * (Blog / Nutzer / Gruppen) werden im Dashboard selbst weiter gefiltert.
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
   * Close the mobile drawer and the account dropdown whenever we navigate
   * to a new path/hash. Otherwise the overlays would stay open behind the
   * new page after a click on a link inside them.
   */
  React.useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
  }, [location.pathname, location.hash]);

  /**
   * Lock background scroll while the drawer is open so the user can't
   * accidentally scroll the underlying page when swiping the menu.
   */
  React.useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  /**
   * Outside-click + Escape schließen das Account-Dropdown. Wir hängen die
   * Listener nur ein, wenn das Menü offen ist — spart in 99 % der Zeit
   * einen Document-Listener, der gar nichts zu tun hätte.
   */
  React.useEffect(() => {
    if (!accountOpen) return;
    const onPointer = (event: MouseEvent) => {
      if (!accountMenuRef.current) return;
      if (accountMenuRef.current.contains(event.target as Node)) return;
      setAccountOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [accountOpen]);

  const displayName = user?.displayName || user?.display_name || user?.name || '';
  const avatarUrl = safeHttpUrl(user?.avatarUrl);
  const initial = displayName.slice(0, 1).toUpperCase() || '?';

  const handleLogout = () => {
    setAccountOpen(false);
    logout().then(() => setUser(null));
  };

  /** Renders one nav entry — RouterLink for SPA paths, anchor otherwise. */
  function renderNavEntry(entry: NavLinkSpec, baseClass: string) {
    const active = isNavActive(entry, location.pathname, location.hash);
    const className = active ? `${baseClass} is-active` : baseClass;
    const aria = active ? 'page' : undefined;
    if (entry.to) {
      return <Link to={entry.to} className={className} aria-current={aria}>{entry.label}</Link>;
    }
    return <a href={entry.href} className={className} aria-current={aria}>{entry.label}</a>;
  }

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-md"
      id="global-nav"
    >
      <div className="flex items-center justify-between gap-6 px-4 py-3 sm:px-6 sm:py-4 lg:px-16">
        <Link
          to="/"
          className="group flex items-center gap-2 shrink-0"
          onClick={() => { setMobileOpen(false); setAccountOpen(false); }}
        >
          <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,.7)] transition-transform group-hover:scale-125" />
          <span className="text-base font-semibold tracking-tight text-slate-100 group-hover:text-cyan-300 transition-colors">
            broiler<span className="text-cyan-400">.dev</span>
          </span>
        </Link>

        {/* Desktop nav — collapses into the hamburger drawer below `md`.
            Pure text links with cyan active-underline. Gated entries
            (Dashboard / Druckanfrage) live in the account dropdown right. */}
        <ul className="hidden md:flex items-center gap-3 lg:gap-5">
          {NAV_LINKS.map((entry) => (
            <li key={entry.label}>{renderNavEntry(entry, 'nav-link')}</li>
          ))}
        </ul>

        {/* Right side: account/auth dropdown. Single anchor for everything
            user-related — keeps the bar quiet, gives users one consistent
            place to find "everything that is mine". */}
        <div className="hidden md:flex items-center gap-3" ref={accountMenuRef}>
          <DesktopAccount
            user={user}
            displayName={displayName}
            avatarUrl={avatarUrl}
            avatarBroken={avatarBroken}
            initial={initial}
            open={accountOpen}
            onToggle={() => setAccountOpen((o) => !o)}
            onClose={() => setAccountOpen(false)}
            onAvatarError={() => setAvatarBroken(true)}
            onLogout={handleLogout}
            canSeeDashboard={canSeeDashboard}
            canSeePrintRequest={canSeePrintRequest}
          />
        </div>

        {/* Mobile hamburger. Larger hit area (40×40) than the visual icon. */}
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
          natural and CSS `border-b` of the bar separates it visually.
          Mobile keeps the two login buttons visible (no dropdown) because
          there's enough vertical space and a dropdown-inside-drawer would
          feel like double-tap UX. */}
      <div
        id="mobile-menu"
        className={`md:hidden overflow-hidden border-t border-white/10 bg-slate-950/95 backdrop-blur-md transition-[max-height,opacity] duration-200 ${
          mobileOpen ? 'max-h-[85vh] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
        }`}
      >
        <ul className="flex flex-col gap-1 px-4 py-3">
          {NAV_LINKS.map((entry) => (
            <li key={entry.label}>{renderNavEntry(entry, 'mobile-nav-link')}</li>
          ))}
          {(canSeePrintRequest || canSeeDashboard) && (
            <li aria-hidden="true" className="my-2 border-t border-white/5" />
          )}
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

interface DesktopAccountProps {
  user: User | null;
  displayName: string;
  avatarUrl: string | null;
  avatarBroken: boolean;
  initial: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onAvatarError: () => void;
  onLogout: () => void;
  canSeeDashboard: boolean;
  canSeePrintRequest: boolean;
}

function DesktopAccount(props: DesktopAccountProps) {
  const {
    user, displayName, avatarUrl, avatarBroken, initial,
    open, onToggle, onClose, onAvatarError, onLogout,
    canSeeDashboard, canSeePrintRequest
  } = props;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        className={
          user
            ? 'inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1 pl-1 pr-3 text-sm font-medium text-slate-200 transition hover:border-cyan-400/40 hover:bg-cyan-500/10'
            : 'inline-flex items-center gap-1.5 rounded-full bg-cyan-500 px-4 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400 sm:text-sm'
        }
      >
        {user ? (
          <>
            {avatarUrl && !avatarBroken ? (
              <img
                src={avatarUrl}
                alt=""
                onError={onAvatarError}
                className="h-7 w-7 rounded-full border border-white/10 bg-slate-900 object-cover"
              />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-slate-900 text-[11px] font-semibold text-slate-300">
                {initial}
              </span>
            )}
            <span className="hidden lg:inline max-w-[10rem] truncate">{displayName}</span>
            <ChevronIcon open={open} />
          </>
        ) : (
          <>
            Anmelden
            <ChevronIcon open={open} />
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 origin-top-right overflow-hidden rounded-xl border border-white/10 bg-slate-900/95 shadow-xl shadow-black/40 backdrop-blur-md"
        >
          {user ? (
            <AccountMenuAuthed
              displayName={displayName}
              canSeeDashboard={canSeeDashboard}
              canSeePrintRequest={canSeePrintRequest}
              onLogout={onLogout}
              onClose={onClose}
            />
          ) : (
            <AccountMenuGuest onClose={onClose} />
          )}
        </div>
      )}
    </div>
  );
}

function AccountMenuAuthed(props: {
  displayName: string;
  canSeeDashboard: boolean;
  canSeePrintRequest: boolean;
  onLogout: () => void;
  onClose: () => void;
}) {
  const { displayName, canSeeDashboard, canSeePrintRequest, onLogout, onClose } = props;
  return (
    <>
      <div className="border-b border-white/5 px-4 py-3">
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Angemeldet als</p>
        <p className="mt-1 truncate text-sm font-semibold text-slate-100">{displayName}</p>
      </div>
      <div className="py-1">
        <Link to={Routes.Profile} className="menu-item" role="menuitem" onClick={onClose}>
          Profil
        </Link>
        {canSeePrintRequest && (
          <Link to={Routes.PrintRequest} className="menu-item" role="menuitem" onClick={onClose}>
            Druckanfrage
          </Link>
        )}
        {canSeeDashboard && (
          <Link to={Routes.Dashboard.Home} className="menu-item" role="menuitem" onClick={onClose}>
            Dashboard
          </Link>
        )}
      </div>
      <div className="border-t border-white/5 py-1">
        <button
          type="button"
          onClick={onLogout}
          className="menu-item w-full text-left text-slate-400 hover:text-red-300"
          role="menuitem"
        >
          Abmelden
        </button>
      </div>
    </>
  );
}

function AccountMenuGuest({ onClose }: { onClose: () => void }) {
  return (
    <div className="p-2">
      <button
        type="button"
        onClick={() => { onClose(); loginToGithub(); }}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/5"
        role="menuitem"
      >
        <GithubIcon /> <span>Mit GitHub anmelden</span>
      </button>
      <button
        type="button"
        onClick={() => { onClose(); loginToTwitch(); }}
        className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/5"
        role="menuitem"
      >
        <TwitchIcon /> <span>Mit Twitch anmelden</span>
      </button>
    </div>
  );
}

interface MobileAuthProps {
  user: User | null;
  displayName: string;
  avatarUrl: string | null;
  avatarBroken: boolean;
  initial: string;
  onAvatarError: () => void;
  onLogout: () => void;
}

function MobileAuth(props: MobileAuthProps) {
  const { user, displayName, avatarUrl, avatarBroken, initial, onAvatarError, onLogout } = props;
  if (!user) {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => loginToGithub()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
        >
          <GithubIcon /> Mit GitHub anmelden
        </button>
        <button
          type="button"
          onClick={() => loginToTwitch()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#9146FF] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#772ce8]"
        >
          <TwitchIcon /> Mit Twitch anmelden
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

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className={`transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
