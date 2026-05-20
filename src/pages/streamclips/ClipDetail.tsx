import * as React from "react";
import { useParams, Link } from "react-router-dom";
import { Routes } from "../../config/routes";
import { ClipEmbed } from "../../components/streamclips/ClipEmbed";
import { AwardChip } from "../../components/streamclips/AwardChip";
import { StarRating } from "../../components/streamclips/StarRating";
import {
  getClip,
  reportClip,
  ApiError,
  type ClipDetail as ClipDetailType,
  type ClipStatus
} from "../../services";

const STATUS_BADGE: Record<ClipStatus, { label: string; className: string }> = {
  pending: { label: "In Prüfung", className: "bg-amber-500/20 text-amber-200" },
  approved: { label: "Freigegeben", className: "bg-emerald-500/20 text-emerald-200" },
  rejected: { label: "Abgelehnt", className: "bg-red-500/20 text-red-200" },
  flagged: { label: "Gemeldet", className: "bg-orange-500/20 text-orange-200" }
};

export function ClipDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [clip, setClip] = React.useState<ClipDetailType | null | undefined>(undefined);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!id) return;
    getClip(id)
      .then(setClip)
      .catch((e: unknown) => {
        console.error(e);
        setError(e instanceof ApiError ? e.message : "Clip konnte nicht geladen werden.");
        setClip(null);
      });
  }, [id]);

  return (
    <main className="min-h-screen bg-slate-950 pt-20 pb-16 sm:pt-24" id="top">
      <div className="mx-auto max-w-2xl px-4 pt-6 sm:px-6 sm:pt-12 lg:pt-16">
        <Link to={Routes.Streamclips.Leaderboard} className="text-xs text-slate-400 hover:text-slate-200">
          ← Zurück zum Leaderboard
        </Link>

        {clip === undefined && !error && <p className="mt-6 text-sm text-slate-400">Lade…</p>}
        {error && <p className="mt-6 text-sm text-red-300">{error}</p>}

        {clip && (
          <div className="mt-4 space-y-5">
            <ClipEmbed clipId={clip.twitchClipId} title={clip.title} />

            <div>
              <h1 className="text-xl font-semibold text-slate-50">{clip.title}</h1>
              <p className="mt-1 text-xs text-slate-400">
                {clip.broadcasterName ?? "?"}
                {clip.categoryName && <> · {clip.categoryName}</>}
                {clip.creatorName && <> · Clip von {clip.creatorName}</>}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <StarRating value={Math.round(clip.avgScore ?? 0)} readOnly />
              <span className="text-sm text-slate-300 tabular-nums">
                {clip.avgScore !== null ? clip.avgScore.toFixed(2) : "—"}
              </span>
              <span className="text-xs text-slate-500">· {clip.ratingCount} Stimmen</span>
            </div>

            {clip.awards.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {clip.awards.map((a) => (
                  <AwardChip key={a.key} emoji={a.emoji} label={a.displayName} color={a.color} count={a.count} />
                ))}
              </div>
            )}

            {clip.myRating && (
              <div className="rounded-2xl border border-[#9146FF]/30 bg-[#9146FF]/5 p-4">
                <p className="text-xs uppercase tracking-wider text-[#bf94ff]">Deine Bewertung</p>
                {clip.myRating.isSkipped ? (
                  <p className="mt-1 text-sm text-slate-400">Übersprungen.</p>
                ) : (
                  <div className="mt-1">
                    <StarRating value={clip.myRating.score ?? 0} readOnly size="sm" />
                  </div>
                )}
              </div>
            )}

            <ReportBlock clipId={clip.id} />
          </div>
        )}
      </div>
    </main>
  );
}

function ReportBlock({ clipId }: { clipId: string }) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (done) {
    return <p className="text-xs text-emerald-300">Danke — die Meldung ist bei den Moderatoren.</p>;
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-slate-500 hover:text-red-300">
        Clip melden
      </button>
    );
  }

  async function send() {
    if (reason.trim().length === 0) {
      setError("Bitte einen Grund angeben.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await reportClip(clipId, reason.trim());
      setDone(true);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Melden fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
      <label htmlFor="report-reason" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
        Clip melden
      </label>
      <textarea
        id="report-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        maxLength={500}
        placeholder="Was stimmt mit dem Clip nicht?"
        className="block w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
      />
      {error && <p className="text-xs text-red-300">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={send} disabled={busy} className="btn-sm bg-red-500/80 hover:bg-red-500">
          {busy ? "Sende…" : "Melden"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-outline btn-sm">
          Abbrechen
        </button>
      </div>
    </div>
  );
}
