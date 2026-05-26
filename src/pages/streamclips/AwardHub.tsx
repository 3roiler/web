import * as React from "react";
import { useParams } from "react-router-dom";
import { HubLayout } from "../../components/streamclips/HubLayout";
import { getClipsByAwardKey, ApiError, type AwardHubData } from "../../services";

/**
 * Hub-Page für alle Clips, die einen bestimmten Award erhalten haben.
 *
 * URL: `/streamclips/award/<key>`. `award_category.key` ist bereits
 * Slug-Form (`funniest`, `best_play`, `clutch`, …) und wird ohne weitere
 * Normalisierung gegen die DB gematcht.
 *
 * SEO-Hebel: rankt auf „lustigster twitch clip deutsch" o. ä. Eher
 * schmaler Long-Tail, aber kostet wenig.
 */
export function AwardHubPage() {
  const { key } = useParams<{ key: string }>();
  const [data, setData] = React.useState<AwardHubData | null | undefined>(undefined);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!key) return;
    getClipsByAwardKey(key)
      .then(setData)
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 404) {
          setData(null);
        } else {
          console.error(e);
          setError(e instanceof ApiError ? e.message : "Award konnte nicht geladen werden.");
          setData(null);
        }
      });
  }, [key]);

  const displayName = data?.award.displayName ?? key ?? "Award";
  const canonicalPath = `/streamclips/award/${encodeURIComponent(key ?? "")}`;

  return (
    <HubLayout
      eyebrow="Streamclips Germany · Award"
      emoji={data?.award.emoji ?? "🏆"}
      displayName={displayName}
      description={`Alle Clips mit dem Award „${displayName}" — von der Community vergeben.`}
      seoTitle={`${displayName} — Award-Clips auf Streamclips Germany`}
      seoDescription={`Alle deutschen Twitch-Clips mit dem Award „${displayName}", von der Community vergeben. Streamclips Germany.`}
      canonicalPath={canonicalPath}
      breadcrumbName={displayName}
      collectionName={`${displayName} — Award-Clips`}
      loading={data === undefined && !error}
      error={error}
      clips={data?.clips ?? null}
      emptyState={
        <>
          Noch keine Clips mit dem Award <span className="text-slate-100">„{displayName}"</span>.
        </>
      }
    />
  );
}
