import * as React from "react";
import { Link } from "react-router-dom";
import { Routes } from "../../config/routes";
import { AwardChip } from "../../components/streamclips/AwardChip";
import { StarRating } from "../../components/streamclips/StarRating";
import { StreamclipsNav } from "../../components/streamclips/StreamclipsNav";
import {
  getLeaderboard,
  getSections,
  type ClipWithContext,
  type ClipSection,
  type SectionOption,
  type LeaderboardPeriod
} from "../../services";

const PERIODS: { value: LeaderboardPeriod; label: string }[] = [
  { value: "all", label: "Allzeit" },
  { value: "month", label: "30 Tage" },
  { value: "week", label: "7 Tage" }
];

/** Öffentliches Leaderboard — Top-Clips per Bayesian-Average, Zeitraum-gefiltert. */
export function LeaderboardPage() {
  const [sections, setSections] = React.useState<SectionOption[]>([]);
  const [section, setSection] = React.useState<ClipSection | undefined>(undefined);
  const [clips, setClips] = React.useState<ClipWithContext[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [period, setPeriod] = React.useState<LeaderboardPeriod>("all");

  React.useEffect(() => {
    getSections().then(setSections).catch(() => undefined);
  }, []);

  React.useEffect(() => {
    setClips(null);
    getLeaderboard(section, 25, period)
      .then(setClips)
      .catch((e: unknown) => {
        console.error(e);
        setError("Leaderboard konnte nicht geladen werden.");
      });
  }, [section, period]);

  return (
    <main className="min-h-screen bg-slate-950 pt-20 pb-16 sm:pt-24" id="top">
      <div className="mx-auto max-w-3xl px-4 pt-6 sm:px-6 sm:pt-12 lg:px-16 lg:pt-16">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#bf94ff] sm:tracking-[0.3em]">
              Streamclips Germany 🇩🇪
            </p>
            <h1 className="text-2xl font-semibold text-slate-50 sm:text-3xl">Top-Clips</h1>
          </div>
          {sections.length > 0 && (
            <select
              value={section ?? ""}
              onChange={(e) => setSection((e.target.value || undefined) as ClipSection | undefined)}
              className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1.5 text-xs text-slate-200"
              aria-label="Sektion filtern"
            >
              <option value="">Alle Sektionen</option>
              {sections.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          )}
        </header>

        <StreamclipsNav />

        <div className="mb-5 flex gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              aria-pressed={period === p.value}
              className={
                period === p.value
                  ? "rounded-full border border-[#9146FF]/50 bg-[#9146FF]/15 px-3 py-1 text-xs font-semibold text-[#bf94ff]"
                  : "rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-400 transition hover:text-slate-200"
              }
            >
              {p.label}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-red-300">{error}</p>}
        {clips === null && !error && <p className="text-sm text-slate-400">Lade…</p>}
        {clips !== null && clips.length === 0 && (
          <p className="text-sm text-slate-500">
            Noch keine bewerteten Clips{section ? " in dieser Sektion" : ""}
            {period !== "all" ? " in diesem Zeitraum" : ""}.
          </p>
        )}

        <ol className="space-y-3">
          {clips?.map((clip, i) => (
            <li key={clip.id}>
              <LeaderboardRow clip={clip} rank={i + 1} />
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}

function LeaderboardRow({ clip, rank }: { clip: ClipWithContext; rank: number }) {
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  return (
    <Link
      to={Routes.Streamclips.ClipDetail.replace(":id", clip.id)}
      className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 transition hover:border-[#9146FF]/40 hover:bg-[#9146FF]/5"
    >
      <div className="flex w-8 shrink-0 items-center justify-center text-lg font-bold tabular-nums text-slate-400">
        {medal ?? rank}
      </div>
      {clip.thumbnailUrl && (
        <img
          src={clip.thumbnailUrl}
          alt=""
          className="h-16 w-28 shrink-0 rounded-lg border border-white/10 object-cover"
          loading="lazy"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-50">{clip.title}</p>
        <p className="truncate text-xs text-slate-400">
          {clip.broadcasterName ?? "?"}
          {clip.categoryName && <> · {clip.categoryName}</>}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <StarRating value={Math.round(clip.avgScore ?? 0)} readOnly size="sm" />
          <span className="text-xs text-slate-500 tabular-nums">
            {clip.avgScore !== null ? clip.avgScore.toFixed(2) : "—"} · {clip.ratingCount} Stimmen
          </span>
        </div>
        {clip.awards.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {clip.awards.slice(0, 4).map((a) => (
              <AwardChip key={a.key} emoji={a.emoji} label={a.displayName} color={a.color} count={a.count} />
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
