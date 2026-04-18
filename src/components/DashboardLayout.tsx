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
  { label: "Einstellungen", to: Routes.Dashboard.Settings, permission: "dashboard.settings" },
  { label: "Metriken", to: Routes.Dashboard.Metrics, permission: "dashboard.metrics" }
];

/**
 * `true` if the user holds the given permission, either directly or via
 * the `admin.manage` umbrella. The backend applies the same rule when
 * bootstrapping permissions, so keep the two in sync.
 */
export function hasPermission(me: User | null | undefined, permission: string): boolean {
  if (!me?.permissions) return false;
  return me.permissions.includes(permission) || me.permissions.includes("admin.manage");
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
      <main className="min-h-screen bg-slate-950 py-24">
        <div className="mx-auto max-w-6xl px-6 sm:px-10 lg:px-16 pt-16 text-sm text-slate-400">
          Lade…
        </div>
      </main>
    );
  }

  if (!allowed || !me) {
    return (
      <main className="min-h-screen bg-slate-950 py-24">
        <div className="mx-auto max-w-6xl px-6 sm:px-10 lg:px-16 pt-16">
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
    <main className="min-h-screen bg-slate-950 py-24" id="top">
      <div className="mx-auto max-w-6xl px-6 sm:px-10 lg:px-16 pt-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">
              {kicker}
            </p>
            <h1 className="mt-4 text-4xl font-semibold text-slate-50 sm:text-5xl">
              {title}
            </h1>
            {description && (
              <div className="mt-3 max-w-2xl text-sm text-slate-400">{description}</div>
            )}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>

        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside>
            <nav className="flex flex-row flex-wrap gap-2 lg:flex-col" aria-label="Dashboard-Navigation">
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
                        ? "rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200"
                        : "rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-400 transition hover:text-slate-200"
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
