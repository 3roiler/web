import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getMe, type User } from "../services";
import { Routes } from "../config/routes";

/**
 * Shared shell for every /admin/* page. Handles:
 *   - `getMe()` + `admin.manage` gate (server also enforces it, but we want
 *     a nicer UX than a raw 403),
 *   - section header with sub-navigation between Users and Groups,
 *   - consistent spacing/max-width so detail pages don't drift.
 *
 * Children are rendered only once the gate has passed; until then we show a
 * small "Lade…" state. Parent pages never have to re-implement any of this.
 */
export interface AdminLayoutProps {
  /** Label shown as the uppercase kicker above the H1, e.g. "Admin · Gruppen". */
  kicker: string;
  /** Page title rendered as the H1. */
  title: string;
  /** Intro paragraph under the title. Optional. */
  description?: React.ReactNode;
  /** Right-aligned action area (primary buttons etc.). Optional. */
  actions?: React.ReactNode;
  /** Child content rendered once the user passes the admin gate. */
  children: (ctx: { me: User }) => React.ReactNode;
}

interface SubnavItem {
  label: string;
  to: string;
  /** Also highlight when the location starts with one of these prefixes. */
  prefixes?: string[];
}

const SUBNAV: SubnavItem[] = [
  { label: "Nutzer", to: Routes.AdminUsers },
  { label: "Gruppen", to: Routes.AdminGroups, prefixes: ["/admin/groups"] }
];

export function AdminLayout({ kicker, title, description, actions, children }: AdminLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [me, setMe] = React.useState<User | null | undefined>(undefined);

  const isAdmin = Boolean(me?.permissions?.includes("admin.manage"));

  React.useEffect(() => {
    getMe()
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  if (me === undefined) {
    return (
      <main className="min-h-screen bg-slate-950 py-24">
        <div className="mx-auto max-w-5xl px-6 sm:px-10 lg:px-16 pt-16 text-sm text-slate-400">
          Lade…
        </div>
      </main>
    );
  }

  if (!isAdmin || !me) {
    return (
      <main className="min-h-screen bg-slate-950 py-24">
        <div className="mx-auto max-w-5xl px-6 sm:px-10 lg:px-16 pt-16">
          <p className="text-sm text-red-300">
            Kein Zugriff. Dir fehlt die Berechtigung <code>admin.manage</code>.
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

  return (
    <main className="min-h-screen bg-slate-950 py-24" id="top">
      <div className="mx-auto max-w-5xl px-6 sm:px-10 lg:px-16 pt-16">
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

        <nav className="mt-8 flex flex-wrap gap-2" aria-label="Admin-Subnavigation">
          {SUBNAV.map((item) => {
            const active =
              location.pathname === item.to ||
              (item.prefixes?.some((p) => location.pathname.startsWith(p)) ?? false);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={
                  active
                    ? "rounded-full border border-cyan-500/40 bg-cyan-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-cyan-200"
                    : "rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 transition hover:text-slate-200"
                }
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-10">{children({ me })}</div>
      </div>
    </main>
  );
}
