import * as React from "react";
import { useParams } from "react-router-dom";
import { HubLayout } from "../../components/streamclips/HubLayout";
import { getClipsByBroadcasterName, ApiError, type StreamerHubData } from "../../services";

/**
 * Hub-Page für alle Clips eines Twitch-Streamers.
 *
 * URL: `/streamclips/streamer/<lowercased-login>`. Der Backend-Endpoint
 * matched case-insensitive auf `broadcaster_name`, gibt Display-Name +
 * broadcaster_id mit zurück und sortiert nach `avg_score * count`
 * (gleiche Logik wie Leaderboard).
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
    <HubLayout
      eyebrow="Streamclips Germany · Streamer"
      displayName={displayName}
      description={`Alle freigegebenen Clips von ${displayName} auf Streamclips Germany.`}
      seoTitle={`${displayName} — Clips auf Streamclips Germany`}
      seoDescription={`Alle freigegebenen Twitch-Clips von ${displayName}, von der Community bewertet. Streamclips Germany.`}
      canonicalPath={canonicalPath}
      breadcrumbName={displayName}
      loading={data === undefined && !error}
      error={error}
      clips={data?.clips ?? null}
      emptyState={
        <>
          Für <span className="text-slate-100">{displayName}</span> haben wir noch keine
          freigegebenen Clips.
        </>
      }
    />
  );
}
