import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getMe, type User } from "../services";
import { Routes } from "../config/routes";

/**
 * Shared shell for every `/dashboard/*` page. Handles:
 *   - `getMe()` + a configurable permission gate (server also enforces;
 *     we want a nicer UX than a raw 403),
 *   - sidebar navigation between Blog / Users / Groups / … – only items
 *     the current user actually has the permission for are shown,
 *   - consistent spacing / max width so sub-pages don't drift.
 *
 * Children receive the resolved `User` object so sub-pages don't need to
 * call `getMe()` themselves again.
 */
export interface DashboardLayoutProps {
  /** Permission required to view this page, e.g. `dashboard.blog`. */
  requiredPermission: string;
  /** Label shown as the uppercase kicker above the H1, e.g. "Dashboard · Blog". */
  kicker: string;
  /** Page title rendered as the H1. */
  title: string;
  /** Intro paragraph under the title. Optional. */
  description?: React.ReactNode;
  /** Right-aligned action area (primary buttons etc.). Optional. */
  actions?: React.ReactNode;
  /** Child content rendered once the user passes the gate. */
  children: (ctx: { me: User }) => React.ReactNode;
}

interface NavItem {
  label: string;
  to: string;
  /** Permission required to see this item at all. */
  permission: string;
  /** Also highlight when the location starts with one of these prefixes. */
  prefixes?: string[];
}

/**
 * Single source of truth for the dashboard menu. Adding a new section is
 * just a new entry here plus the matching permission in the API's
 * `ADMIN_PERMISSIONS`. The `admin.manage` umbrella permission implies all
 * `dashboard.*` keys on the backend, so admins always see everything.
 */
const NAV_ITEMS: NavItem[] = [
  { label: "Übersicht", to: Routes.Dashboard.Home, permission: "dashboard.view" },
  { label: "Blog", to: Routes.Dashboard.Blog, permission: "dashboard.blog", prefixes: ["/dashboard/blog"] },
  { label: "Nutzer", to: Routes.Dashboard.Users, permission: "dashboard.users" },
  { label: "Gruppen", to: Routes.Dashboard.Groups, permission: "dashboard.groups", prefixes: ["/dashboard/groups"] },
  { label: "Drucker", to: Routes.Dashboard.Printers, permission: "dashboard.printers", prefixes: ["/dashboard/printers"] },
  { label: "G-Code", to: Routes.Dashboard.Gcode, permission: "dashboard.printers", prefixes: ["/dashboard/gcode"] },
  // Editor sits next to the list because the most common entry is
  // "let me edit something quickly" rather than "show me the library".
  // The list page still owns deletion / per-file viewing.
  { label: "Editor", to: Routes.Dashboard.GcodeNew, permission: "dashboard.printers" },
  { label: "STL", to: Routes.Dashboard.Stl, permission: "dashboard.printers", prefixes: ["/dashboard/stl"] },
  // Druckanfragen erscheinen sowohl für Anfrager (`print.request`) als
  // auch für Moderatoren (`print.moderate`) — der Backend-Filter
  // entscheidet was sie sehen. Wir gaten hier auf das schwächere
  // Recht, damit jeder Anfrager den Eintrag findet.
  { label: "Druckanfragen", to: Routes.Dashboard.PrintRequests, permission: "print.request", prefixes: ["/dashboard/druckanfragen"] },
  { label: "Einstellungen", to: Routes.Dashboard.Settings, permission: "dashboard.settings" },
  { label: "Metriken", to: Routes.Dashboard.Metrics, permission: "dashboard.metrics" }
];

/**
 * `true` if the user holds the given permission, either directly or via
 * the `admin.manage` umbrella. The backend applies the same rule when
 * bootstrapping permissions, so keep the two in sync.
 *
 * Special case: a user who only holds `print.request` (a friend
 * granted submission rights without full dashboard access) still
 * needs to enter `/dashboard/*` to follow the request thread.
 * `dashboard.view` is purely a frontend gate (the backend doesn't
 * check it), so we synthesise it here rather than mass-granting it
 * via bootstrap.
 */
export function hasPermission(me: User | null | undefined, permission: string): boolean {
  if (!me?.permissions) return false;
  if (me.permissions.includes(permission)) return true;
  if (me.permissions.includes("admin.manage")) return true;
  if (
    permission === "dashboard.view" &&
    me.permissions.includes("print.request")
  ) {
    return true;
  }
  return false;
}

export function DashboardLayout({
  requiredPermission,
  kicker,
  title,
  description,
  actions,
  children
}: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [me, setMe] = React.useState<User | null | undefined>(undefined);

  const allowed = hasPermission(me, requiredPermission);

  React.useEffect(() => {
    getMe()
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  if (me === undefined) {
    return (
      <main className="min-h-screen bg-slate-950 pt-20 pb-12 sm:pt-24 sm:pb-16">
        <div className="mx-auto max-w-6xl px-4 pt-6 text-sm text-slate-400 sm:px-6 sm:pt-12 lg:px-16 lg:pt-16">
          Lade…
        </div>
      </main>
    );
  }

  if (!allowed || !me) {
    return (
      <main className="min-h-screen bg-slate-950 pt-20 pb-12 sm:pt-24 sm:pb-16">
        <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 sm:pt-12 lg:px-16 lg:pt-16">
          <p className="text-sm text-red-300">
            Kein Zugriff. Dir fehlt die Berechtigung <code>{requiredPermission}</code>.
          </p>
          <button
            type="button"
            onClick={() => navigate(Routes.Home)}
            className="btn-outline mt-8 inline-block"
          >
            Zur Startseite
          </button>
        </div>
      </main>
    );
  }

  const visibleItems = NAV_ITEMS.filter((item) => hasPermission(me, item.permission));

  return (
    <main className="min-h-screen bg-slate-950 pt-20 pb-12 sm:pt-24 sm:pb-16" id="top">
      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 sm:pt-12 lg:px-16 lg:pt-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400 sm:text-sm sm:tracking-[0.3em]">
              {kicker}
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-50 sm:mt-4 sm:text-4xl lg:text-5xl">
              {title}
            </h1>
            {description && (
              <div className="mt-2 max-w-2xl text-xs text-slate-400 sm:mt-3 sm:text-sm">{description}</div>
            )}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 sm:mt-10 sm:gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
          {/*
            On phones the sidebar becomes a horizontally scrollable tab strip:
            the same items, just one row that overflow-scrolls instead of
            wrapping into 4 lines of pills. `-mx-4 px-4` lets the strip bleed
            to the screen edge on tiny viewports so the active item is always
            grabable without inset thumb-space. From `lg` it reverts to the
            classic vertical sidebar.
          */}
          <aside className="lg:sticky lg:top-24">
            <nav
              aria-label="Dashboard-Navigation"
              className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 sm:pb-0 lg:flex-col [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {visibleItems.map((item) => {
                const active =
                  location.pathname === item.to ||
                  (item.prefixes?.some((p) => location.pathname.startsWith(p)) ?? false);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={
                      active
                        ? "shrink-0 whitespace-nowrap rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200 sm:text-sm"
                        : "shrink-0 whitespace-nowrap rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-400 transition hover:text-slate-200 sm:text-sm"
                    }
                    aria-current={active ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          <div className="min-w-0">{children({ me })}</div>
        </div>
      </div>
    </main>
  );
}
