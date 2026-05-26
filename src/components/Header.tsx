import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { loginToGithub, loginToTwitch, logout, getMe, User } from '../services';
import { Routes } from '../config/routes';
import { safeHttpUrl } from '../lib/url';

/**
 * Top-Nav. Drei Bereichs-Dropdowns (Start, Blog, Streamclips) plus
 * Account-Dropdown rechts.
 *
 * UX-Pattern pro Bereich:
 *   - Top-Level ist ein RouterLink zur Bereichs-Übersicht. Klick navigiert.
 *   - Daneben ein Chevron-Knopf: Klick toggelt das Dropdown.
 *   - Hover/Focus auf dem Container öffnet das Dropdown ebenfalls
 *     (Desktop, schnellere Discovery).
 *   - Mobile: Tap auf den Bereich expandiert ein Akkordeon mit den
 *     Sub-Items; Top-Level-Navigation auf Mobile geht über das erste
 *     Sub-Item („Übersicht").
 *
 * Anchor-Items (Stack / Projekte / Kontakt) leben im Start-Dropdown
 * und werden NUR auf `/` gezeigt — auf jeder anderen Seite gibt es
 * keine Sections zum Scrollen. Das `HashScroll`-Helper-Komponent
 * scrollt nach SPA-Navigation zur Anchor-Position, damit
 * `<Link to="/#projects">` von `/blog` aus funktioniert.
 */

interface NavSubItem {
  label: string;
  /** SPA-Pfad (Router-Link). Genau einer von `to` / `href` muss gesetzt sein. */
  to?: string;
  /** Externer Pfad / `<a>`-Link. */
  href?: string;
  /** True ⇒ Item nur wenn der User eingeloggt ist. */
  authRequired?: boolean;
  /** Wenn gesetzt ⇒ Item nur wenn der User diese Permission hat. */
  permission?: string;
  /** Wenn gesetzt ⇒ Item nur wenn pathname diesen Wert hat (z. B. nur auf `/`). */
  onlyOnPath?: string;
}

interface NavGroup {
  label: string;
  /** Pfad, zu dem der Top-Level-Link führt. */
  to: string;
  /** Aktiv-Check für die Gruppe — bestimmt das Active-Indicator-Verhalten. */
  isActive: (pathname: string) => boolean;
  items: NavSubItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Start',
    to: '/',
    isActive: (p) => p === '/',
    items: [
      { label: 'Übersicht', to: '/' },
      // Anchor-Items: existieren nur in Home, daher Dropdown-Eintrag
      // nur auf `/` zeigen. Sonst landet der Klick auf einem leeren
      // Hash und der HashScroll-Helper findet kein Element.
      { label: 'Stack', to: '/#skills', onlyOnPath: '/' },
      { label: 'Projekte', to: '/#projects', onlyOnPath: '/' },
      { label: 'Kontakt', to: '/#contact', onlyOnPath: '/' }
    ]
  },
  {
    label: 'Blog',
    to: Routes.Blog,
    isActive: (p) => p.startsWith('/blog'),
    items: [
      { label: 'Alle Beiträge', to: Routes.Blog },
      // RSS ist ein API-Endpunkt; per `href` damit der Browser ihn als
      // Feed öffnet statt React-Router den Pfad als unbekannte Route
      // behandelt.
      { label: 'RSS-Feed', href: '/blog/rss.xml' }
    ]
  },
  {
    label: 'Streamclips',
    to: Routes.Streamclips.Home,
    isActive: (p) => p.startsWith('/streamclips'),
    items: [
      { label: 'Übersicht', to: Routes.Streamclips.Home },
      { label: 'Top-Clips', to: Routes.Streamclips.Leaderboard },
      { label: 'Top-Einreicher', to: Routes.Streamclips.Contributors },
      // Auth-/Permission-gegated — der User sieht im Dropdown nichts,
      // wozu er ohnehin nicht klicken könnte.
      { label: 'Clip einreichen', to: Routes.Streamclips.Submit, permission: 'clips.submit' },
      { label: 'Clips bewerten', to: Routes.Streamclips.Vote, authRequired: true },
      { label: 'Meine Clips', to: Routes.Streamclips.Me, authRequired: true }
    ]
  }
];

/**
 * Wenn eine Section im Viewport rückt, aber selbst kein eigener Nav-
 * Eintrag ist, ordnen wir sie einem benachbarten zu (z. B. `#about`
 * → „Übersicht"). So bleibt der Indikator auf Home stabil.
 */
const ANCHOR_TO_ITEM_TO: Record<string, string> = {
  top: '/',
  about: '/',
  skills: '/#skills',
  projects: '/#projects',
  contact: '/#contact'
};

/** IDs, die der Scroll-Tracker auf der Home-Page mitliest. */
const HOME_ANCHOR_IDS = ['top', 'about', 'skills', 'projects', 'contact'];

/**
 * Filtert Sub-Items basierend auf Auth/Permission/Pfad und entfernt
 * Items, die der aktuelle User/Pfad nicht sehen darf.
 */
function visibleItems(items: NavSubItem[], user: User | null, pathname: string): NavSubItem[] {
  return items.filter((item) => {
    if (item.onlyOnPath && pathname !== item.onlyOnPath) return false;
    if (item.authRequired && !user) return false;
    if (item.permission) {
      const perms = user?.permissions ?? [];
      if (!perms.includes(item.permission) && !perms.includes('admin.manage')) return false;
    }
    return true;
  });
}

/** True, wenn das Sub-Item bei der aktuellen Location als aktiv gilt. */
function isItemActive(item: NavSubItem, pathname: string, hash: string, activeAnchor: string | null): boolean {
  if (!item.to) return false;
  // Hash-Item (z. B. `/#skills`): nur auf `/` und wenn der Anchor passt.
  if (item.to.includes('#')) {
    if (pathname !== '/') return false;
    if (activeAnchor) {
      return ANCHOR_TO_ITEM_TO[activeAnchor] === item.to;
    }
    if (item.to === '/') {
      return hash === '' || hash === '#top';
    }
    return item.to === `/${hash}`;
  }
  // Plain SPA-Pfad: exakt oder per Prefix matched.
  return pathname === item.to;
}

export function Header() {
  const [user, setUser] = React.useState<User | null>(null);
  const [avatarBroken, setAvatarBroken] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [accountOpen, setAccountOpen] = React.useState(false);
  /** Aktuell hover/focus-geöffnetes Desktop-Dropdown (Label) oder null. */
  const [openGroup, setOpenGroup] = React.useState<string | null>(null);
  /** Im Mobile-Drawer expandierte Gruppe (Label) oder null. */
  const [mobileExpanded, setMobileExpanded] = React.useState<string | null>(null);
  const [activeAnchor, setActiveAnchor] = React.useState<string | null>(null);
  const location = useLocation();
  const accountMenuRef = React.useRef<HTMLDivElement | null>(null);
  const navMenuRef = React.useRef<HTMLUListElement | null>(null);
  /**
   * Verzögerter Schließ-Timer für Hover-Dropdowns. Beim Wechsel
   * zwischen Top-Level-Link und Panel quert die Maus den 4–8 px Gap;
   * sonst würde `onMouseLeave` der `<ul>` sofort schließen, bevor sie
   * das Panel erreicht. Jeder erneute `mouseenter` cancelt den Timer.
   */
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleClose = React.useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setOpenGroup(null);
      closeTimerRef.current = null;
    }, 180);
  }, []);

  const cancelClose = React.useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  React.useEffect(() => () => cancelClose(), [cancelClose]);

  const canSeeDashboard = Boolean(
    user?.permissions?.some((p) => p === 'dashboard.view' || p === 'admin.manage')
  );
  const canSeePrintRequest = Boolean(
    user?.permissions?.some(
      (p) => p === 'print.request' || p === 'print.moderate' || p === 'admin.manage'
    )
  );

  React.useEffect(() => {
    getMe().then((fetchedUser) => {
      setUser(fetchedUser);
      setAvatarBroken(false);
    }).catch(() => setUser(null));
  }, []);

  // Drawer & Dropdowns nach SPA-Navigation schließen.
  React.useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
    setOpenGroup(null);
    setMobileExpanded(null);
  }, [location.pathname, location.hash]);

  // Mobile-Drawer-Scrolllock.
  React.useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  // Active-Section-Tracking auf der Startseite — pixel-genau über
  // `scroll`-Listener (siehe original Implementation für Begründung).
  React.useEffect(() => {
    if (location.pathname !== '/') {
      setActiveAnchor(null);
      return;
    }
    const TRIGGER_OFFSET = 120;
    const elements = HOME_ANCHOR_IDS
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;
    let raf = 0;
    const pickActive = () => {
      raf = 0;
      let current: string | null = null;
      for (const el of elements) {
        const top = el.getBoundingClientRect().top;
        if (top <= TRIGGER_OFFSET) {
          current = el.id;
        } else break;
      }
      setActiveAnchor(current);
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(pickActive);
    };
    pickActive();
    globalThis.addEventListener('scroll', onScroll, { passive: true });
    globalThis.addEventListener('resize', onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      globalThis.removeEventListener('scroll', onScroll);
      globalThis.removeEventListener('resize', onScroll);
    };
  }, [location.pathname]);

  // Outside-Click + Escape schließen Dropdowns.
  React.useEffect(() => {
    if (!openGroup && !accountOpen) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (accountMenuRef.current?.contains(target)) return;
      if (navMenuRef.current?.contains(target)) return;
      setOpenGroup(null);
      setAccountOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenGroup(null);
        setAccountOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [openGroup, accountOpen]);

  const displayName = user?.displayName || user?.display_name || user?.name || '';
  const avatarUrl = safeHttpUrl(user?.avatarUrl);
  const initial = displayName.slice(0, 1).toUpperCase() || '?';

  const handleLogout = () => {
    setAccountOpen(false);
    logout().then(() => setUser(null));
  };

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-md"
      id="global-nav"
    >
      <div className="flex items-center justify-between gap-6 px-4 py-3 sm:px-6 sm:py-4 lg:px-16">
        <Link
          to="/"
          className="group flex items-center gap-2 shrink-0"
          onClick={() => { setMobileOpen(false); setAccountOpen(false); setOpenGroup(null); }}
        >
          <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,.7)] transition-transform group-hover:scale-125" />
          <span className="text-base font-semibold tracking-tight text-slate-100 group-hover:text-cyan-300 transition-colors">
            broiler<span className="text-cyan-400">.dev</span>
          </span>
        </Link>

        {/* Desktop nav — drei Bereichs-Dropdowns. Hover/Focus öffnet, Click
            auf dem Top-Level navigiert direkt zur Bereichs-Übersicht.
            `mouseLeave` schließt mit kleinem Delay, damit der Wechsel
            vom Top-Level-Link zum Panel den Gap überbrücken kann. */}
        <ul
          ref={navMenuRef}
          className="hidden md:flex items-center gap-1 lg:gap-2"
          onMouseLeave={scheduleClose}
          onMouseEnter={cancelClose}
        >
          {NAV_GROUPS.map((group) => (
            <DesktopGroup
              key={group.label}
              group={group}
              user={user}
              pathname={location.pathname}
              hash={location.hash}
              activeAnchor={activeAnchor}
              open={openGroup === group.label}
              onOpen={() => {
                cancelClose();
                setOpenGroup(group.label);
              }}
              onClose={() => setOpenGroup(null)}
              onToggle={() => {
                cancelClose();
                setOpenGroup((g) => (g === group.label ? null : group.label));
              }}
            />
          ))}
        </ul>

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

      {/* Mobile drawer — Akkordeon pro Bereich. */}
      <div
        id="mobile-menu"
        className={`md:hidden overflow-hidden border-t border-white/10 bg-slate-950/95 backdrop-blur-md transition-[max-height,opacity] duration-200 ${
          mobileOpen ? 'max-h-[85vh] overflow-y-auto opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
        }`}
      >
        <ul className="flex flex-col gap-1 px-2 py-3">
          {NAV_GROUPS.map((group) => (
            <MobileGroup
              key={group.label}
              group={group}
              user={user}
              pathname={location.pathname}
              hash={location.hash}
              activeAnchor={activeAnchor}
              expanded={mobileExpanded === group.label}
              onToggle={() =>
                setMobileExpanded((g) => (g === group.label ? null : group.label))
              }
            />
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

// ─── Desktop Group (Dropdown) ────────────────────────────────────────

interface DesktopGroupProps {
  group: NavGroup;
  user: User | null;
  pathname: string;
  hash: string;
  activeAnchor: string | null;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onToggle: () => void;
}

function DesktopGroup(props: DesktopGroupProps) {
  const { group, user, pathname, hash, activeAnchor, open, onOpen, onToggle } = props;
  const items = visibleItems(group.items, user, pathname);
  const groupActive = group.isActive(pathname);
  // Wenn nach dem Filter keine Items mehr da sind (z. B. Start ohne
  // Anchors auf Sub-Page), ist das Dropdown sinnlos — wir rendern den
  // Top-Level dann als simplen Link ohne Chevron.
  const hasItems = items.length > 0;

  return (
    <li
      className="relative"
      onMouseEnter={onOpen}
      onFocus={onOpen}
    >
      <div className="flex items-center">
        <Link
          to={group.to}
          className={`nav-link ${groupActive ? 'is-active' : ''}`}
          aria-current={groupActive ? 'page' : undefined}
        >
          {group.label}
        </Link>
        {hasItems && (
          <button
            type="button"
            onClick={onToggle}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label={`${group.label}-Untermenü`}
            className="ml-0.5 inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:text-slate-100"
          >
            <ChevronIcon open={open} />
          </button>
        )}
      </div>

      {hasItems && open && (
        // Outer Wrapper: `pt-2` ist unsichtbarer Hit-Bereich, der den
        // Gap zwischen Top-Level-Link und Panel überdeckt. Bewegt der
        // User die Maus vom Top-Level zum Panel, bleibt sie damit über
        // einem DOM-Kind der `<ul>` — kein vorzeitiges `mouseLeave`.
        <div className="absolute left-0 top-full pt-2 z-10">
          <div
            role="menu"
            className="w-56 origin-top-left overflow-hidden rounded-xl border border-white/10 bg-slate-900/95 shadow-xl shadow-black/40 backdrop-blur-md"
          >
            <div className="py-1">
              {items.map((item) => (
                <NavItemLink
                  key={item.label}
                  item={item}
                  active={isItemActive(item, pathname, hash, activeAnchor)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

function NavItemLink({ item, active }: { item: NavSubItem; active: boolean }) {
  const className = `menu-item ${active ? 'text-cyan-300' : ''}`;
  if (item.to) {
    return (
      <Link to={item.to} className={className} role="menuitem" aria-current={active ? 'page' : undefined}>
        {item.label}
      </Link>
    );
  }
  return (
    <a href={item.href} className={className} role="menuitem">
      {item.label}
    </a>
  );
}

// ─── Mobile Group (Accordion) ────────────────────────────────────────

interface MobileGroupProps {
  group: NavGroup;
  user: User | null;
  pathname: string;
  hash: string;
  activeAnchor: string | null;
  expanded: boolean;
  onToggle: () => void;
}

function MobileGroup({ group, user, pathname, hash, activeAnchor, expanded, onToggle }: MobileGroupProps) {
  const items = visibleItems(group.items, user, pathname);
  const groupActive = group.isActive(pathname);
  const hasItems = items.length > 0;

  return (
    <li>
      <div className="flex items-center">
        <Link
          to={group.to}
          className={`mobile-nav-link flex-1 ${groupActive ? 'is-active' : ''}`}
          aria-current={groupActive ? 'page' : undefined}
        >
          {group.label}
        </Link>
        {hasItems && (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-label={`${group.label}-Untermenü`}
            className="inline-flex h-10 w-10 items-center justify-center rounded text-slate-400"
          >
            <ChevronIcon open={expanded} />
          </button>
        )}
      </div>
      {hasItems && expanded && (
        <ul className="ml-3 mb-1 border-l border-white/10 pl-2">
          {items.map((item) => (
            <li key={item.label}>
              <NavItemMobileLink
                item={item}
                active={isItemActive(item, pathname, hash, activeAnchor)}
              />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function NavItemMobileLink({ item, active }: { item: NavSubItem; active: boolean }) {
  const className = `mobile-nav-link text-sm ${active ? 'text-cyan-300' : ''}`;
  if (item.to) {
    return (
      <Link to={item.to} className={className} aria-current={active ? 'page' : undefined}>
        {item.label}
      </Link>
    );
  }
  return <a href={item.href} className={className}>{item.label}</a>;
}

// ─── Account-Dropdown (rechts) — unverändert übernommen ──────────────

interface DesktopAccountProps {
  user: User | null;
  displayName: string;
  avatarUrl: string | undefined;
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
  avatarUrl: string | undefined;
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
