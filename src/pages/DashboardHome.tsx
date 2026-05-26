import * as React from "react";
import { Link } from "react-router-dom";
import { DashboardLayout, hasPermission } from "../components/DashboardLayout";
import { Routes } from "../config/routes";
import { getDashboardStats, type DashboardStats, type User } from "../services";

/**
 * Dashboard-Startseite.
 *
 * Drei Schichten von oben nach unten:
 *  1. Stats-Widgets — kompakte Zahlen-Karten. Pro Karte ein Permission-
 *     Check, damit Anwender ohne z. B. Blog-Recht keine Drafts-Zahl sehen.
 *  2. Bereichs-Tiles — Navigations-Eintritte zu Unterseiten (Originalzweck
 *     der Seite, blieb für Permission-Gruppen mit wenig Stats sinnvoll).
 *
 * Stats werden best-effort geladen — wenn der API-Call fehlschlägt
 * (Netzwerk, fehlende Berechtigung), zeigen wir nur die Tiles ohne den
 * Widget-Bereich. Niemand bekommt ein leeres Dashboard, nur weil die
 * Aggregations-Query mal hakt.
 */

interface DashboardTile {
  title: string;
  description: string;
  to: string;
  permission: string;
}

const TILES: DashboardTile[] = [
  {
    title: "Blog",
    description:
      "Beiträge schreiben, bearbeiten, veröffentlichen. Sichtbarkeit pro Beitrag regeln.",
    to: Routes.Dashboard.Blog,
    permission: "dashboard.blog"
  },
  {
    title: "Nutzer",
    description: "Benutzerliste, Profile, Berechtigungen direkt vergeben oder entziehen.",
    to: Routes.Dashboard.Users,
    permission: "dashboard.users"
  },
  {
    title: "Gruppen",
    description: "Gruppen anlegen, Mitglieder zuordnen, Permissions auf Gruppenebene.",
    to: Routes.Dashboard.Groups,
    permission: "dashboard.groups"
  },
  {
    title: "Einstellungen",
    description:
      "Site-Konfiguration und verschlüsselte Secrets (DigitalOcean-Token, Feature-Flags).",
    to: Routes.Dashboard.Settings,
    permission: "dashboard.settings"
  },
  {
    title: "Metriken",
    description: "DigitalOcean App-Platform und Managed-Postgres: CPU, Memory, Disk, Status.",
    to: Routes.Dashboard.Metrics,
    permission: "dashboard.metrics"
  },
  {
    title: "Drucker",
    description: "3D-Drucker registrieren, Agent-Token verwalten und Zugriffe vergeben.",
    to: Routes.Dashboard.Printers,
    permission: "dashboard.printers"
  },
  {
    title: "G-Code",
    description: "G-Code-Dateien hochladen, verwalten und für Druckjobs bereitstellen.",
    to: Routes.Dashboard.Gcode,
    permission: "dashboard.printers"
  }
];

interface StatCardSpec {
  /** Eindeutige React-Key. */
  key: string;
  /** Großes Label in der Karte. */
  label: string;
  /** Permission, die für die Anzeige nötig ist. */
  permission: string;
  /** Wert aus den Stats holen. Liefert `null`, wenn der Wert fehlt. */
  value: (stats: DashboardStats) => number | null;
  /** Optionale Sekundärzeile, z. B. „… davon 3 gemeldet". */
  hint?: (stats: DashboardStats) => string | null;
  /** Zielroute für den Click — wird die Karte zum Link. */
  to?: string;
  /** Akzent-Farbe für den großen Wert (cyan = Standard). */
  tone?: "cyan" | "amber" | "emerald" | "red" | "purple";
}

const STAT_CARDS: StatCardSpec[] = [
  {
    key: "clips-pending",
    label: "Clips in Prüfung",
    permission: "dashboard.clips",
    value: (s) => s.clips.pending,
    hint: (s) => (s.clips.flagged > 0 ? `${s.clips.flagged} gemeldet` : null),
    to: Routes.Dashboard.Clips,
    tone: "amber"
  },
  {
    key: "reports-open",
    label: "Offene Meldungen",
    permission: "dashboard.clips",
    value: (s) => s.reports.open,
    to: Routes.Dashboard.ClipsReports,
    tone: "red"
  },
  {
    key: "blog-drafts",
    label: "Blog-Drafts",
    permission: "dashboard.blog",
    value: (s) => s.blog.drafts,
    hint: (s) => `${s.blog.published} veröffentlicht`,
    to: Routes.Dashboard.Blog,
    tone: "cyan"
  },
  {
    key: "print-requests",
    label: "Offene Druckanfragen",
    permission: "dashboard.printers",
    value: (s) => s.printRequests.open,
    to: Routes.Dashboard.PrintRequests,
    tone: "purple"
  },
  {
    key: "users-new",
    label: "Neue User (30 T.)",
    permission: "dashboard.users",
    value: (s) => s.users.new30d,
    hint: (s) => `${s.users.total} insgesamt`,
    to: Routes.Dashboard.Users,
    tone: "emerald"
  },
  {
    key: "ratings",
    label: "Bewertungen (7 T.)",
    permission: "dashboard.clips",
    value: (s) => s.ratings.last7d,
    hint: (s) => `${s.clips.approved} Clips freigegeben`,
    to: Routes.Dashboard.Clips,
    tone: "cyan"
  }
];

const TONE_CLASS: Record<NonNullable<StatCardSpec["tone"]>, string> = {
  cyan: "text-cyan-300",
  amber: "text-amber-300",
  emerald: "text-emerald-300",
  red: "text-red-300",
  purple: "text-[#bf94ff]"
};

function StatCard({ spec, stats }: { spec: StatCardSpec; stats: DashboardStats }) {
  const value = spec.value(stats);
  const hint = spec.hint?.(stats) ?? null;
  const valueClass = TONE_CLASS[spec.tone ?? "cyan"];

  const body = (
    <>
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {spec.label}
      </p>
      <p className={`mt-2 text-3xl font-semibold tabular-nums ${valueClass}`}>{value ?? "—"}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </>
  );

  const className =
    "group rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/30";

  if (spec.to) {
    return (
      <Link to={spec.to} className={`${className} block`}>
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}

function TileCard({ tile }: { tile: DashboardTile }) {
  return (
    <Link
      to={tile.to}
      className="group block rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-cyan-400/40 hover:bg-cyan-500/5"
    >
      <h2 className="text-lg font-semibold text-slate-50 group-hover:text-cyan-200">
        {tile.title}
      </h2>
      <p className="mt-2 text-sm text-slate-400">{tile.description}</p>
    </Link>
  );
}

export function DashboardHomePage() {
  return (
    <DashboardLayout
      requiredPermission="dashboard.view"
      kicker="Dashboard"
      title="Übersicht"
      description="Live-Zahlen pro Bereich plus Direktlinks. Was du nicht sehen darfst, wird ausgeblendet."
    >
      {({ me }) => <DashboardContent me={me} />}
    </DashboardLayout>
  );
}

function DashboardContent({ me }: { me: User }) {
  const [stats, setStats] = React.useState<DashboardStats | null>(null);

  React.useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  const visibleStats = React.useMemo(
    () => STAT_CARDS.filter((card) => hasPermission(me, card.permission)),
    [me]
  );

  const visibleTiles = React.useMemo(
    () => TILES.filter((tile) => hasPermission(me, tile.permission)),
    [me]
  );

  if (visibleStats.length === 0 && visibleTiles.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        Du hast aktuell Zugriff auf das Dashboard, aber auf keinen der Unterbereiche. Bitte wende
        dich an einen Admin.
      </p>
    );
  }

  return (
    <div className="space-y-10">
      {stats && visibleStats.length > 0 && (
        <section>
          <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Aktuelle Lage
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6">
            {visibleStats.map((card) => (
              <StatCard key={card.key} spec={card} stats={stats} />
            ))}
          </div>
        </section>
      )}

      {visibleTiles.length > 0 && (
        <section>
          <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Bereiche
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {visibleTiles.map((tile) => (
              <TileCard key={tile.to} tile={tile} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
