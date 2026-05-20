import * as React from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "../components/DashboardLayout";
import { Routes } from "../config/routes";
import { formatDate } from "../lib/asset-helpers";
import {
  adminListReports,
  adminResolveReport,
  ApiError,
  type ClipReportWithContext
} from "../services";

export function DashboardReportsPage() {
  return (
    <DashboardLayout
      requiredPermission="dashboard.clips"
      kicker="Dashboard · Streamclips"
      title="Gemeldete Clips"
      description="Von Nutzern gemeldete Clips. Erledigen heißt: gesichtet — den Clip selbst lehnst du bei Bedarf in der Moderation ab."
    >
      {() => <ReportsList />}
    </DashboardLayout>
  );
}

function ReportsList() {
  const [rows, setRows] = React.useState<ClipReportWithContext[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(() => {
    adminListReports("open")
      .then(setRows)
      .catch((err: unknown) => {
        console.error(err);
        setError(err instanceof ApiError ? err.message : "Meldungen konnten nicht geladen werden.");
      });
  }, []);

  React.useEffect(() => {
    reload();
  }, [reload]);

  async function resolve(id: string, status: "resolved" | "dismissed") {
    try {
      await adminResolveReport(id, status);
      reload();
    } catch (err: unknown) {
      console.error(err);
    }
  }

  return (
    <div className="max-w-2xl space-y-3">
      {error && <p className="text-sm text-red-300">{error}</p>}
      {rows === null && !error && <p className="text-sm text-slate-400">Lade…</p>}
      {rows !== null && rows.length === 0 && (
        <p className="text-sm text-slate-500">Keine offenen Meldungen. 🎉</p>
      )}

      {rows?.map((report) => (
        <div key={report.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex gap-3">
            {report.clipThumbnailUrl && (
              <img src={report.clipThumbnailUrl} alt="" className="h-14 w-24 shrink-0 rounded-lg object-cover" loading="lazy" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500">{formatDate(report.createdAt)} · {report.reporterName}</p>
              <Link
                to={Routes.Streamclips.ClipDetail.replace(":id", report.clipId)}
                className="truncate text-sm font-semibold text-slate-50 hover:text-[#bf94ff]"
              >
                {report.clipTitle}
              </Link>
              <p className="mt-1 text-sm text-slate-300">„{report.reason}"</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => resolve(report.id, "resolved")} className="btn-sm bg-emerald-500/80 hover:bg-emerald-500">
              Erledigt
            </button>
            <button type="button" onClick={() => resolve(report.id, "dismissed")} className="btn-outline btn-sm">
              Verwerfen
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
