import * as React from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "../components/DashboardLayout";
import { Routes } from "../config/routes";
import { formatDate } from "../lib/asset-helpers";
import { ClipEmbed } from "../components/streamclips/ClipEmbed";
import {
  adminListClips,
  adminSetClipStatus,
  ApiError,
  type ClipStatus,
  type ClipWithContext
} from "../services";

const STATUS_META: Record<ClipStatus, { label: string; className: string }> = {
  pending: { label: "In Prüfung", className: "bg-amber-500/20 text-amber-200" },
  approved: { label: "Freigegeben", className: "bg-emerald-500/20 text-emerald-200" },
  rejected: { label: "Abgelehnt", className: "bg-red-500/20 text-red-200" },
  flagged: { label: "Gemeldet", className: "bg-orange-500/20 text-orange-200" }
};

const FILTER_TABS: { label: string; value: ClipStatus[] }[] = [
  { label: "In Prüfung", value: ["pending"] },
  { label: "Gemeldet", value: ["flagged"] },
  { label: "Freigegeben", value: ["approved"] },
  { label: "Abgelehnt", value: ["rejected"] }
];

export function DashboardClipsPage() {
  return (
    <DashboardLayout
      requiredPermission="dashboard.clips"
      kicker="Dashboard · Streamclips"
      title="Clip-Moderation"
      description="Eingereichte Clips freigeben oder ablehnen. Nur freigegebene Clips erscheinen im Vote-Feed."
      actions={
        <>
          <Link to={Routes.Dashboard.ClipsAwards} className="btn-outline btn-sm">Awards</Link>
          <Link to={Routes.Dashboard.ClipsCategories} className="btn-outline btn-sm">Kategorien</Link>
          <Link to={Routes.Dashboard.ClipsReports} className="btn-outline btn-sm">Meldungen</Link>
        </>
      }
    >
      {() => <ClipsQueue />}
    </DashboardLayout>
  );
}

function ClipsQueue() {
  const [filter, setFilter] = React.useState(FILTER_TABS[0]);
  const [rows, setRows] = React.useState<ClipWithContext[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(() => {
    setRows(null);
    adminListClips(filter.value)
      .then(setRows)
      .catch((err: unknown) => {
        console.error(err);
        setError(err instanceof ApiError ? err.message : "Queue konnte nicht geladen werden.");
      });
  }, [filter]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="max-w-3xl space-y-5">
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
                  ? "shrink-0 whitespace-nowrap rounded-full border border-[#9146FF]/50 bg-[#9146FF]/15 px-3 py-1 text-xs font-semibold text-[#bf94ff]"
                  : "shrink-0 whitespace-nowrap rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-400 transition hover:text-slate-200"
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}
      {rows === null && !error && <p className="text-sm text-slate-400">Lade…</p>}
      {rows !== null && rows.length === 0 && (
        <p className="text-sm text-slate-500">Keine Clips im aktuellen Filter.</p>
      )}

      <div className="space-y-3">
        {rows?.map((clip) => (
          <ClipModCard key={clip.id} clip={clip} onChanged={reload} />
        ))}
      </div>
    </div>
  );
}

function ClipModCard({ clip, onChanged }: { clip: ClipWithContext; onChanged: () => void }) {
  const [preview, setPreview] = React.useState(false);
  const [rejecting, setRejecting] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const meta = STATUS_META[clip.status];

  async function setStatus(status: ClipStatus, rejectionReason?: string) {
    setBusy(true);
    setError(null);
    try {
      await adminSetClipStatus(clip.id, status, rejectionReason);
      onChanged();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Status konnte nicht gesetzt werden.");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex gap-3">
        {clip.thumbnailUrl && (
          <button type="button" onClick={() => setPreview((p) => !p)} className="shrink-0">
            <img src={clip.thumbnailUrl} alt="" className="h-16 w-28 rounded-lg border border-white/10 object-cover" loading="lazy" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded-full px-2 py-0.5 ${meta.className}`}>{meta.label}</span>
            <span className="text-slate-500">{formatDate(clip.createdAt)}</span>
          </div>
          <p className="mt-1 truncate text-sm font-semibold text-slate-50">{clip.title}</p>
          <p className="truncate text-xs text-slate-500">
            {clip.broadcasterName ?? "?"}
            {clip.categoryName && <> · {clip.categoryName}</>}
            {" · eingereicht von "}
            {clip.submitterDisplayName || clip.submitterName}
          </p>
        </div>
      </div>

      {preview && (
        <div className="mt-3">
          <ClipEmbed clipId={clip.twitchClipId} title={clip.title} />
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}

      {rejecting ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Ablehnungsgrund (für den Einreicher sichtbar)"
            className="block w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setStatus("rejected", reason.trim() || undefined)}
              className="btn-sm bg-red-500/80 hover:bg-red-500"
            >
              Ablehnen bestätigen
            </button>
            <button type="button" onClick={() => setRejecting(false)} className="btn-outline btn-sm">
              Abbrechen
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {clip.videoUrl && (
            <a
              href={clip.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline btn-sm"
            >
              Auf Twitch ansehen ↗
            </a>
          )}
          {clip.status !== "approved" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setStatus("approved")}
              className="btn-sm bg-emerald-500/80 hover:bg-emerald-500"
            >
              Freigeben
            </button>
          )}
          {clip.status !== "rejected" && (
            <button type="button" disabled={busy} onClick={() => setRejecting(true)} className="btn-outline btn-sm">
              Ablehnen
            </button>
          )}
        </div>
      )}
    </div>
  );
}
