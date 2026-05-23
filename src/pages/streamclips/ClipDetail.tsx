import * as React from "react";
import { useParams, Link } from "react-router-dom";
import { Routes } from "../../config/routes";
import { ClipEmbed } from "../../components/streamclips/ClipEmbed";
import { ClipCarousel } from "../../components/streamclips/ClipCarousel";
import { Comments } from "../../components/comments/Comments";
import { AwardChip } from "../../components/streamclips/AwardChip";
import { StarRating } from "../../components/streamclips/StarRating";
import { Seo } from "../../components/Seo";
import {
  getClip,
  reportClip,
  getMe,
  loginToTwitch,
  listClipsByBroadcaster,
  ApiError,
  type ClipDetail as ClipDetailType,
  type ClipStatus,
  type ClipWithContext
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
  const [loggedIn, setLoggedIn] = React.useState(false);
  const [related, setRelated] = React.useState<ClipWithContext[]>([]);
  const [seekToSeconds, setSeekToSeconds] = React.useState<number | null>(null);
  const [seekNonce, setSeekNonce] = React.useState(0);

  const handleSeek = React.useCallback((seconds: number) => {
    setSeekToSeconds(seconds);
    setSeekNonce((n) => n + 1);
    // Sanftes Scroll-to-Player, damit der Sprung sichtbar ist auch wenn
    // der User gerade in den Kommentaren weiter unten gelesen hat.
    globalThis.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  React.useEffect(() => {
    getMe().then(() => setLoggedIn(true)).catch(() => setLoggedIn(false));
  }, []);

  React.useEffect(() => {
    if (!id) return;
    setRelated([]); // Vorherige related-Liste verwerfen, wenn der Clip wechselt.
    getClip(id)
      .then(setClip)
      .catch((e: unknown) => {
        console.error(e);
        setError(e instanceof ApiError ? e.message : "Clip konnte nicht geladen werden.");
        setClip(null);
      });
  }, [id]);

  // Lädt „Mehr von diesem Streamer", sobald der Clip da ist und einen
  // broadcasterId trägt. Fehler still verschlucken — das Karussell ist
  // optional, der eigentliche Clip soll davon unbeeindruckt bleiben.
  React.useEffect(() => {
    if (!clip?.broadcasterId) return;
    listClipsByBroadcaster(clip.broadcasterId, { excludeId: clip.id, limit: 8 })
      .then(setRelated)
      .catch(() => undefined);
  }, [clip?.broadcasterId, clip?.id]);

  return (
    <main className="min-h-screen bg-slate-950 pt-20 pb-16 sm:pt-24" id="top">
      <div className="mx-auto max-w-4xl px-4 pt-6 sm:px-6 sm:pt-12 lg:pt-16">
        <Link to={Routes.Streamclips.Leaderboard} className="text-xs text-slate-400 hover:text-slate-200">
          ← Zurück zum Leaderboard
        </Link>

        {clip === undefined && !error && <p className="mt-6 text-sm text-slate-400">Lade…</p>}
        {error && <p className="mt-6 text-sm text-red-300">{error}</p>}

        {clip && (
          <div className="mt-4 space-y-5">
            <Seo
              title={clip.title}
              description={`Clip${clip.broadcasterName ? ` von ${clip.broadcasterName}` : ""}${clip.categoryName ? ` · ${clip.categoryName}` : ""} — bewertet auf Streamclips Germany.`}
              type="article"
            />
            <ClipEmbed
              clipId={clip.twitchClipId}
              title={clip.title}
              seekToSeconds={seekToSeconds}
              seekNonce={seekNonce}
            />

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

            {loggedIn ? <ReportBlock clipId={clip.id} /> : <LoginHint />}

            <Comments targetType="clip" targetKey={clip.id} onSeek={handleSeek} />
          </div>
        )}

        {/* „Mehr von diesem Streamer" — bewusst außerhalb der max-w-4xl-
            Spalte, damit das Karussell den vollen Container-Breitenraum
            nutzen kann. Erst gerendert, wenn wirklich etwas da ist. */}
        {clip && related.length > 0 && (
          <div className="mt-10 -mx-4 sm:-mx-6 lg:-mx-16">
            <div className="px-4 sm:px-6 lg:px-16">
              <ClipCarousel
                title={<>Mehr von {clip.broadcasterName ?? "diesem Streamer"}</>}
                clips={related}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function LoginHint() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
      <p className="text-sm text-slate-400">Melde dich an, um Clips zu bewerten und zu melden.</p>
      <button
        type="button"
        onClick={() => loginToTwitch()}
        className="mt-3 inline-flex items-center justify-center gap-2 rounded-full bg-[#9146FF] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#772ce8]"
      >
        Mit Twitch anmelden
      </button>
    </div>
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
