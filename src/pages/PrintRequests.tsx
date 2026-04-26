import * as React from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "../components/DashboardLayout";
import { Routes } from "../config/routes";
import { formatDate } from "../lib/asset-helpers";
import {
  listPrintRequests,
  ApiError,
  type User,
  type PrintRequestStatus,
  type PrintRequestWithContext
} from "../services";

const STATUS_META: Record<PrintRequestStatus, { label: string; className: string }> = {
  new: { label: "Neu", className: "bg-amber-500/20 text-amber-200" },
  accepted: { label: "Angenommen", className: "bg-cyan-500/20 text-cyan-200" },
  printing: { label: "Druckt", className: "bg-violet-500/20 text-violet-200" },
  done: { label: "Fertig", className: "bg-emerald-500/20 text-emerald-200" },
  rejected: { label: "Abgelehnt", className: "bg-red-500/20 text-red-200" },
  cancelled: { label: "Zurückgezogen", className: "bg-slate-500/20 text-slate-300" }
};

const FILTER_TABS: { label: string; value: PrintRequestStatus[] | null }[] = [
  { label: "Alle", value: null },
  { label: "Aktiv", value: ["new", "accepted", "printing"] },
  { label: "Neu", value: ["new"] },
  { label: "Angenommen", value: ["accepted"] },
  { label: "Druckt", value: ["printing"] },
  { label: "Fertig", value: ["done"] },
  { label: "Abgelehnt / Zurückgezogen", value: ["rejected", "cancelled"] }
];

function isModerator(me: User): boolean {
  return Boolean(
    me.permissions?.some((p) => p === "print.moderate" || p === "admin.manage")
  );
}

export function PrintRequestsPage() {
  return (
    <DashboardLayout
      requiredPermission="print.request"
      kicker="Dashboard · Druckanfragen"
      title="Druckanfragen"
      description={
        <>
          Anfragen-Tickets von Freunden plus deine eigenen Einreichungen.
          Statuswechsel und Drucker-Zuweisung sind Moderatoren vorbehalten;
          jeder kann im Thread mitschreiben.
        </>
      }
      actions={
        <Link to={Routes.PrintRequest} className="btn btn-sm">
          Neue Anfrage
        </Link>
      }
    >
      {({ me }) => <RequestsContent me={me} />}
    </DashboardLayout>
  );
}

function RequestsContent({ me }: { me: User }) {
  const [rows, setRows] = React.useState<PrintRequestWithContext[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<typeof FILTER_TABS[number]>(FILTER_TABS[1]);
  const [showOnlyMine, setShowOnlyMine] = React.useState(false);

  const moderator = isModerator(me);

  const reload = React.useCallback(() => {
    listPrintRequests({
      mine: !moderator || showOnlyMine,
      status: filter.value ?? undefined
    })
      .then(setRows)
      .catch((err: unknown) => {
        console.error(err);
        setError(err instanceof ApiError ? err.message : "Anfragen konnten nicht geladen werden.");
      });
  }, [moderator, showOnlyMine, filter]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTER_TABS.map((tab) => {
            const active = tab === filter;
            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => setFilter(tab)}
                className={
                  active
                    ? "shrink-0 whitespace-nowrap rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200"
                    : "shrink-0 whitespace-nowrap rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-400 transition hover:text-slate-200"
                }
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        {moderator && (
          <label className="flex shrink-0 items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={showOnlyMine}
              onChange={(e) => setShowOnlyMine(e.target.checked)}
            />
            Nur meine
          </label>
        )}
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      {rows === null && <p className="text-sm text-slate-400">Lade…</p>}
      {rows !== null && rows.length === 0 && (
        <p className="text-sm text-slate-500">
          {moderator && !showOnlyMine
            ? "Keine Anfragen im aktuellen Filter."
            : "Du hast hier noch keine Anfragen."}
        </p>
      )}

      <div className="space-y-3">
        {rows?.map((row) => {
          const meta = STATUS_META[row.status];
          const requesterLabel = row.requesterDisplayName || row.requesterName;
          return (
            <Link
              key={row.id}
              to={Routes.Dashboard.PrintRequestDetail.replace(":id", row.id)}
              className="block rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-cyan-400/40 hover:bg-cyan-500/5 sm:p-5"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-full px-2 py-0.5 ${meta.className}`}>{meta.label}</span>
                <span className="text-slate-500">{formatDate(row.createdAt)}</span>
                {row.printerName && (
                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-slate-300">
                    🖨 {row.printerName}
                  </span>
                )}
              </div>
              <p className="mt-2 truncate text-sm font-semibold text-slate-50">{row.title}</p>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {requesterLabel} · {row.sourceType === "stl_upload" ? `STL: ${row.stlFilename ?? "Datei gelöscht"}` : `Link: ${row.externalUrl}`}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
