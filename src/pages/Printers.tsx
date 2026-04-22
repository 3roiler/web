import * as React from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "../components/DashboardLayout";
import { Routes } from "../config/routes";
import {
  listPrinters,
  type PrinterWithRole,
  type PrinterStatus,
  type PrinterRole
} from "../services";

const STATUS_BADGE: Record<PrinterStatus, { label: string; className: string }> = {
  offline: { label: "Offline", className: "bg-slate-500/20 text-slate-300" },
  online: { label: "Online", className: "bg-emerald-500/20 text-emerald-200" },
  error: { label: "Fehler", className: "bg-red-500/20 text-red-200" }
};

const ROLE_BADGE: Record<PrinterRole, { label: string; className: string }> = {
  owner: { label: "Owner", className: "bg-cyan-500/20 text-cyan-200" },
  operator: { label: "Operator", className: "bg-sky-500/20 text-sky-200" },
  viewer: { label: "Viewer", className: "bg-slate-500/20 text-slate-300" }
};

function formatLastSeen(iso: string | null): string {
  if (!iso) return "Noch nie verbunden";
  const d = new Date(iso);
  return d.toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

export function PrintersPage() {
  return (
    <DashboardLayout
      requiredPermission="dashboard.printers"
      kicker="Dashboard · Drucker"
      title="3D-Drucker"
      description={
        <>
          Registrierte Drucker + Agent-Verbindungsstatus. Neue Drucker bekommen einen
          einmaligen Agent-Token, den du auf dem Drucker-Host hinterlegst.
        </>
      }
      actions={
        <Link to={Routes.Dashboard.PrinterNew} className="btn">
          Neuer Drucker
        </Link>
      }
    >
      {() => <PrintersList />}
    </DashboardLayout>
  );
}

function PrintersList() {
  const [printers, setPrinters] = React.useState<PrinterWithRole[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    listPrinters()
      .then(setPrinters)
      .catch((e: unknown) => {
        console.error(e);
        setError("Drucker konnten nicht geladen werden.");
      });
  }, []);

  if (error) {
    return <p className="text-sm text-red-300">{error}</p>;
  }
  if (printers === null) {
    return <p className="text-sm text-slate-400">Lade…</p>;
  }
  if (printers.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        Noch keine Drucker registriert. Klick „Neuer Drucker", um deinen ersten
        Drucker einzurichten.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {printers.map((printer) => {
        const status = STATUS_BADGE[printer.status];
        const role = ROLE_BADGE[printer.role];
        return (
          <Link
            key={printer.id}
            to={Routes.Dashboard.PrinterDetail.replace(":id", printer.id)}
            className="block rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/40 hover:bg-cyan-500/5"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 ${status.className}`}>
                    {status.label}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 ${role.className}`}>
                    {role.label}
                  </span>
                  {printer.canViewCamera && (
                    <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-violet-200">
                      Kamera
                    </span>
                  )}
                </div>
                <h2 className="mt-2 truncate text-lg font-semibold text-slate-50">
                  {printer.name}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {printer.model} · Agent: {printer.agentVersion ?? "unbekannt"} ·
                  Zuletzt: {formatLastSeen(printer.lastSeenAt)}
                </p>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
