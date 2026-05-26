import * as React from "react";
import { Link } from "react-router-dom";
import { Routes } from "../../config/routes";
import { formatDate } from "../../lib/asset-helpers";
import { safeHttpUrl } from "../../lib/url";
import { clipDetailPath } from "../../lib/clip-path";
import { StarRating } from "../../components/streamclips/StarRating";
import { StreamclipsNav } from "../../components/streamclips/StreamclipsNav";
import {
  getMe,
  getMyClips,
  loginToTwitch,
  type User,
  type ClipWithContext,
  type ClipStatus
} from "../../services";

const STATUS_BADGE: Record<ClipStatus, { label: string; className: string }> = {
  pending: { label: "In Prüfung", className: "bg-amber-500/20 text-amber-200" },
  approved: { label: "Freigegeben", className: "bg-emerald-500/20 text-emerald-200" },
  rejected: { label: "Abgelehnt", className: "bg-red-500/20 text-red-200" },
  flagged: { label: "Gemeldet", className: "bg-orange-500/20 text-orange-200" }
};

const TWITCH_BTN =
  "inline-flex items-center justify-center gap-2 rounded-full bg-[#9146FF] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#772ce8]";

/** Eigenes Streamclips-Profil: eingereichte Clips + deren Status. */
export function MyClipsPage() {
  const [me, setMe] = React.useState<User | null | undefined>(undefined);
  const [clips, setClips] = React.useState<ClipWithContext[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    getMe()
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  React.useEffect(() => {
    if (!me) return;
    getMyClips()
      .then(setClips)
      .catch((e: unknown) => {
        console.error(e);
        setError("Clips konnten nicht geladen werden.");
      });
  }, [me]);

  return (
    <main className="min-h-screen bg-slate-950 pt-20 pb-16 sm:pt-24" id="top">
      <div className="mx-auto max-w-2xl px-4 pt-6 sm:px-6 sm:pt-12 lg:pt-16">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#bf94ff] sm:tracking-[0.3em]">
              Streamclips Germany 🇩🇪
            </p>
            <h1 className="text-2xl font-semibold text-slate-50 sm:text-3xl">Meine Clips</h1>
          </div>
          <Link to={Routes.Streamclips.Submit} className={TWITCH_BTN}>
            Clip einreichen
          </Link>
        </header>

        <StreamclipsNav />

        {me === undefined && <p className="text-sm text-slate-400">Lade…</p>}

        {me === null && (
          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
            <p className="text-sm text-slate-300">
              Melde dich mit Twitch an, um deine Clips zu sehen.
            </p>
            <button type="button" onClick={() => loginToTwitch()} className={TWITCH_BTN}>
              Mit Twitch anmelden
            </button>
          </div>
        )}

        {me && (
          <>
            {error && <p className="text-sm text-red-300">{error}</p>}
            {clips === null && !error && <p className="text-sm text-slate-400">Lade…</p>}
            {clips !== null && clips.length === 0 && (
              <p className="text-sm text-slate-500">
                Du hast noch keine Clips eingereicht.{" "}
                <Link to={Routes.Streamclips.Submit} className="text-[#bf94ff] hover:underline">
                  Jetzt loslegen →
                </Link>
              </p>
            )}
            <ul className="space-y-3">
              {clips?.map((clip) => {
                const badge = STATUS_BADGE[clip.status];
                const thumb = safeHttpUrl(clip.thumbnailUrl);
                return (
                  <li key={clip.id}>
                    <Link
                      to={clipDetailPath(clip)}
                      className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 transition hover:border-[#9146FF]/40"
                    >
                      {thumb && (
                        <img
                          src={thumb}
                          alt=""
                          className="h-14 w-24 shrink-0 rounded-lg object-cover"
                          loading="lazy"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className={`rounded-full px-2 py-0.5 ${badge.className}`}>
                            {badge.label}
                          </span>
                          <span className="text-slate-500">{formatDate(clip.createdAt)}</span>
                        </div>
                        <p className="mt-1 truncate text-sm font-semibold text-slate-50">
                          {clip.title}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <StarRating value={Math.round(clip.avgScore ?? 0)} readOnly size="sm" />
                          <span className="text-xs text-slate-500">{clip.ratingCount} Stimmen</span>
                        </div>
                        {clip.status === "rejected" && clip.rejectionReason && (
                          <p className="mt-1 text-xs text-red-300/80">
                            Grund: {clip.rejectionReason}
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
