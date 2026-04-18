import * as React from "react";
import { Link } from "react-router-dom";
import { DashboardLayout, hasPermission } from "../components/DashboardLayout";
import { Routes } from "../config/routes";
import type { User } from "../services";

interface DashboardTile {
  title: string;
  description: string;
  to: string;
  permission: string;
}

/**
 * Order matches the sidebar. `dashboard.view` is gate-only — it gets you
 * into this landing page but doesn't carry its own tile, since the whole
 * page *is* the overview.
 */
const TILES: DashboardTile[] = [
  {
    title: "Blog",
    description: "Beiträge schreiben, bearbeiten, veröffentlichen. Sichtbarkeit pro Beitrag regeln.",
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
  }
];

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
      description="Zentrale Verwaltung für Inhalte, Nutzer und Gruppen. Bereiche, für die dir die Berechtigung fehlt, werden ausgeblendet."
    >
      {({ me }) => <Tiles me={me} />}
    </DashboardLayout>
  );
}

function Tiles({ me }: { me: User }) {
  const visible = React.useMemo(
    () => TILES.filter((tile) => hasPermission(me, tile.permission)),
    [me]
  );

  if (visible.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        Du hast aktuell Zugriff auf das Dashboard, aber auf keinen der Unterbereiche. Bitte wende
        dich an einen Admin.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {visible.map((tile) => (
        <TileCard key={tile.to} tile={tile} />
      ))}
    </div>
  );
}
