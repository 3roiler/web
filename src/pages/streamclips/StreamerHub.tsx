import * as React from "react";
import { useParams, Link } from "react-router-dom";
import { Routes } from "../../config/routes";
import { Seo, JsonLd, SITE_URL } from "../../components/Seo";
import { StreamclipsNav } from "../../components/streamclips/StreamclipsNav";
import { ClipCard } from "../../components/streamclips/ClipCard";
import { clipDetailPath } from "../../lib/clip-path";
import { getClipsByBroadcasterName, ApiError, type StreamerHubData } from "../../services";

/**
 * Hub-Page für alle Clips eines Twitch-Streamers.
 *
 * URL: `/streamclips/streamer/<lowercased-login>`. Der Backend-Endpoint
 * matched case-insensitive auf `broadcaster_name`, gibt Display-Name +
 * broadcaster_id mit zurück und sortiert nach `avg_score * count`
 * (Bayesian-Quality, gleiche Logik wie Leaderboard).
 *
 * SEO-Hebel: rankt auf „<streamer> clips deutsch" / „<streamer> twitch
 * highlights" — klassischer Long-Tail über die Eigenname-Suche.
 */
export function StreamerHubPage() {
  const { name } = useParams<{ name: string }>();
  const [data, setData] = React.useState<StreamerHubData | null | undefined>(undefined);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!name) return;
    getClipsByBroadcasterName(name)
      .then(setData)
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 404) {
          setData(null);
        } else {
          console.error(e);
          setError(e instanceof ApiError ? e.message : "Streamer konnte nicht geladen werden.");
          setData(null);
        }
      });
  }, [name]);

  const displayName = data?.broadcasterName ?? name ?? "Streamer";
  const canonicalPath = `/streamclips/streamer/${encodeURIComponent((name ?? "").toLowerCase())}`;

  return (
    <main className="min-h-screen bg-slate-950 pt-20 pb-16 sm:pt-24" id="top">
      <Seo
        title={`${displayName} — Clips auf Streamclips Germany`}
        description={`Alle freigegebenen Twitch-Clips von ${displayName}, von der Community bewertet. Streamclips Germany.`}
        canonicalPath={canonicalPath}
        noindex={data === null}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Start", item: `${SITE_URL}/` },
            { "@type": "ListItem", position: 2, name: "Streamclips Germany", item: `${SITE_URL}/streamclips` },
            { "@type": "ListItem", position: 3, name: displayName, item: `${SITE_URL}${canonicalPath}` }
          ]
        }}
      />
      {data && data.clips.length > 0 && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `${displayName} — Clips`,
            url: `${SITE_URL}${canonicalPath}`,
            inLanguage: "de",
            isPartOf: { "@type": "WebSite", name: "broiler.dev", url: SITE_URL },
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: data.clips.length,
              itemListElement: data.clips.map((c, i) => ({
                "@type": "ListItem",
                position: i + 1,
                url: `${SITE_URL}${clipDetailPath(c)}`,
                name: c.title
              }))
            }
          }}
        />
      )}

      <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6 sm:pt-12 lg:px-16 lg:pt-16">
        <header className="mb-6 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#bf94ff] sm:tracking-[0.3em]">
            Streamclips Germany · Streamer
          </p>
          <h1 className="text-2xl font-semibold text-slate-50 sm:text-4xl">
            {displayName}
          </h1>
          <p className="text-sm text-slate-400">
            Alle freigegebenen Clips von <span className="text-slate-200">{displayName}</span> auf
            Streamclips Germany.
          </p>
        </header>

        <StreamclipsNav />

        {data === undefined && !error && <p className="text-sm text-slate-400">Lade…</p>}
        {error && <p className="text-sm text-red-300">{error}</p>}
        {data === null && !error && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-slate-300">
              Für <span className="text-slate-100">{displayName}</span> haben wir noch keine
              freigegebenen Clips.
            </p>
            <Link to={Routes.Streamclips.Home} className="btn-outline mt-4 inline-block">
              Zur Streamclips-Übersicht
            </Link>
          </div>
        )}
        {data && data.clips.length > 0 && (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.clips.map((clip) => (
              <li key={clip.id}>
                <ClipCard clip={clip} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
