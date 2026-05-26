import * as React from "react";
import { useParams } from "react-router-dom";
import { HubLayout } from "../../components/streamclips/HubLayout";
import { getClipsByCategorySlug, ApiError, type CategoryHubData } from "../../services";

/**
 * Hub-Page für alle Clips einer Twitch-Kategorie.
 *
 * URL: `/streamclips/kategorie/<slug>`. Slug stammt aus
 * `slugifyTitle(category.name)` und wird vom Backend per inline-Slugify-
 * SQL gematcht — siehe `clipService.listByCategorySlug`.
 *
 * SEO-Hebel: rankt auf „<spiel> clips deutsch" — z. B. „league of
 * legends clips deutsch", „gta rp clips deutsch".
 */
export function CategoryHubPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = React.useState<CategoryHubData | null | undefined>(undefined);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!slug) return;
    getClipsByCategorySlug(slug)
      .then(setData)
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 404) {
          setData(null);
        } else {
          console.error(e);
          setError(e instanceof ApiError ? e.message : "Kategorie konnte nicht geladen werden.");
          setData(null);
        }
      });
  }, [slug]);

  const displayName = data?.category.name ?? slug ?? "Kategorie";
  const canonicalPath = `/streamclips/kategorie/${encodeURIComponent(slug ?? "")}`;

  return (
    <HubLayout
      eyebrow="Streamclips Germany · Kategorie"
      displayName={displayName}
      description={`Alle freigegebenen Clips aus der Twitch-Kategorie ${displayName} — von der Community gewählt.`}
      seoTitle={`${displayName} — Clips auf Streamclips Germany`}
      seoDescription={`Alle freigegebenen Twitch-Clips aus der Kategorie ${displayName}, von der Community bewertet. Streamclips Germany.`}
      canonicalPath={canonicalPath}
      breadcrumbName={displayName}
      loading={data === undefined && !error}
      error={error}
      clips={data?.clips ?? null}
      emptyState={
        <>
          Für die Kategorie <span className="text-slate-100">{displayName}</span> haben wir noch
          keine freigegebenen Clips.
        </>
      }
    />
  );
}
