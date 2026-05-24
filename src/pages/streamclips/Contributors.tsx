import * as React from "react";
import { Link } from "react-router-dom";
import { Routes } from "../../config/routes";
import { Seo } from "../../components/Seo";
import { StreamclipsNav } from "../../components/streamclips/StreamclipsNav";
import { safeHttpUrl } from "../../lib/url";
import { listClipContributors, ApiError, type ClipContributor } from "../../services";

/**
 * Hall of Fame der Top-Einreicher.
 *
 * Sortierung kommt aus der API (kombinierter Score aus avg_score und
 * log(count)). Hier rendern wir die Liste mit Rang, Avatar, Klick auf
 * den Top-Clip, kompakten Metrik-Pills.
 */
export function StreamclipsContributorsPage() {
  const [rows, setRows] = React.useState<ClipContributor[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    listClipContributors(50)
      .then(setRows)
      .catch((e: unknown) => {
        console.error(e);
        setError(e instanceof ApiError ? e.message : 'Top-Einreicher konnten nicht geladen werden.');
      });
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 pt-20 pb-16 sm:pt-24" id="top">
      <Seo
        title="Top-Einreicher — Streamclips Germany"
        description="Die Hall of Fame: Nutzer mit den meisten und bestbewertetsten Clips bei Streamclips Germany."
      />
      <div className="mx-auto max-w-4xl px-4 pt-6 sm:px-6 sm:pt-12 lg:px-16 lg:pt-16">
        <header className="mb-6 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#bf94ff] sm:tracking-[0.3em]">
            Streamclips Germany · Hall of Fame
          </p>
          <h1 className="text-2xl font-semibold text-slate-50 sm:text-4xl">
            Top-Einreicher
          </h1>
          <p className="max-w-2xl text-sm text-slate-400">
            Wer hat die besten Clips eingereicht? Ranking aus Anzahl
            freigegebener Clips und durchschnittlichem Score.
          </p>
        </header>

        <StreamclipsNav />

        {error && <p className="text-sm text-red-300">{error}</p>}
        {!error && rows === null && <p className="text-sm text-slate-400">Lade…</p>}
        {!error && rows !== null && rows.length === 0 && (
          <p className="text-sm text-slate-500">Noch keine freigegebenen Clips.</p>
        )}

        <ol className="mt-8 space-y-3">
          {rows?.map((row, index) => (
            <ContributorRow key={row.userId} row={row} rank={index + 1} />
          ))}
        </ol>
      </div>
    </main>
  );
}

function ContributorRow({ row, rank }: { row: ClipContributor; rank: number }) {
  // Top 3 bekommen Akzent-Borders und einen Glanz auf der Rang-Zahl.
  const rankTone =
    rank === 1
      ? 'border-amber-300/40 bg-amber-500/[0.04]'
      : rank === 2
        ? 'border-slate-300/30 bg-slate-100/[0.03]'
        : rank === 3
          ? 'border-orange-400/30 bg-orange-500/[0.03]'
          : 'border-white/10 bg-white/5';

  const rankColor =
    rank === 1
      ? 'text-amber-300'
      : rank === 2
        ? 'text-slate-200'
        : rank === 3
          ? 'text-orange-300'
          : 'text-slate-500';

  const displayName = row.displayName ?? row.name;
  const avatar = safeHttpUrl(row.avatarUrl);

  return (
    <li className={`flex items-center gap-4 rounded-2xl border p-4 ${rankTone}`}>
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-slate-950/60 font-mono text-sm font-semibold ${rankColor}`}
      >
        {rank}
      </span>
      {avatar ? (
        <img
          src={avatar}
          alt=""
          className="h-12 w-12 shrink-0 rounded-full border border-white/10 bg-slate-900 object-cover"
        />
      ) : (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-slate-900 text-sm font-semibold text-slate-300">
          {displayName.slice(0, 1).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-100">{displayName}</p>
        {row.topClipId && row.topClipTitle && (
          <p className="mt-0.5 truncate text-xs text-slate-500">
            Top-Clip:{' '}
            <Link
              to={Routes.Streamclips.ClipDetail.replace(':id', row.topClipId)}
              className="text-cyan-300 hover:text-cyan-200"
            >
              {row.topClipTitle}
            </Link>
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="rounded-full border border-white/10 bg-slate-950/60 px-2 py-0.5 text-[0.7rem] font-mono text-slate-300">
          {row.clipCount} {row.clipCount === 1 ? 'Clip' : 'Clips'}
        </span>
        {row.avgScore !== null && (
          <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[0.7rem] font-mono text-cyan-200">
            ⌀ {row.avgScore.toFixed(2)} ★
          </span>
        )}
      </div>
    </li>
  );
}
