import * as React from "react";
import { Link } from "react-router-dom";
import { Routes } from "../../config/routes";
import { Seo, JsonLd, SITE_URL } from "../Seo";
import { StreamclipsNav } from "./StreamclipsNav";
import { ClipCard } from "./ClipCard";
import { clipDetailPath } from "../../lib/clip-path";
import type { ClipWithContext } from "../../services";

/**
 * Gemeinsame Schale für die drei SEO-Hub-Pages (Streamer / Kategorie /
 * Award). Lieferung der Hub-spezifischen Daten erfolgt über Props; das
 * Layout selbst kümmert sich um die JSON-LD-Signale, Header-Typografie
 * und Empty/Loading/Error-States.
 *
 * Hintergrund: die drei Hub-Pages hatten ursprünglich eigene Komponenten
 * mit fast identischem Boilerplate — Sonar's Duplication-Gate (3 %) hat
 * das (und zu Recht) als Wartungsfalle markiert. Diese Komponente ist
 * die einzige Stelle, an der das gemeinsame Layout lebt.
 */
export interface HubLayoutProps {
  /** Sektions-Label oben über der h1 (z. B. „Streamclips Germany · Streamer"). */
  eyebrow: string;
  /** Optionales Emoji links vor dem h1 (z. B. das Award-Emoji). */
  emoji?: string | null;
  /** Anzeigename der Hub-Entität (Streamer-Name / Kategorie / Award). */
  displayName: string;
  /** Lead-Satz unter der h1. */
  description: string;
  /** SEO-Title (volle Variante, wird vom `<Seo>` mit „· broiler.dev" suffixed). */
  seoTitle: string;
  /** SEO-Description (Meta + OG/Twitter). */
  seoDescription: string;
  /** Kanonischer Pfad — wird auch in BreadcrumbList und CollectionPage-URL genutzt. */
  canonicalPath: string;
  /** Name für den letzten Breadcrumb-Eintrag (z. B. Display-Name). */
  breadcrumbName: string;
  /** Optionaler Name für `CollectionPage.name` — Default: `displayName`. */
  collectionName?: string;
  /** Loading: Daten kommen noch. */
  loading: boolean;
  /** Fehlertext, falls die API einen nicht-404-Fehler liefert. */
  error: string | null;
  /** Liste der Clips. Leer/`null` rendert den Empty-State. */
  clips: ClipWithContext[] | null;
  /** Erklärtext für den Empty-State (z. B. „Für <name> haben wir noch keine …"). */
  emptyState: React.ReactNode;
}

/**
 * Render-Helfer: rendert Status-Block (Loading / Error / Empty / Grid).
 * Separate Funktion, damit die Haupt-Komponente unter dem Cognitive-
 * Complexity-Limit bleibt.
 */
function HubBody({
  loading,
  error,
  clips,
  emptyState
}: Pick<HubLayoutProps, "loading" | "error" | "clips" | "emptyState">) {
  if (loading) return <p className="text-sm text-slate-400">Lade…</p>;
  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (!clips || clips.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-sm text-slate-300">{emptyState}</div>
        <Link to={Routes.Streamclips.Home} className="btn-outline mt-4 inline-block">
          Zur Streamclips-Übersicht
        </Link>
      </div>
    );
  }
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {clips.map((clip) => (
        <li key={clip.id}>
          <ClipCard clip={clip} />
        </li>
      ))}
    </ul>
  );
}

export function HubLayout({
  eyebrow,
  emoji,
  displayName,
  description,
  seoTitle,
  seoDescription,
  canonicalPath,
  breadcrumbName,
  collectionName,
  loading,
  error,
  clips,
  emptyState
}: HubLayoutProps) {
  // Wenn die API 404 lieferte, ist `clips === null` und der Aufrufer
  // hat `loading = false` gesetzt — wir markieren die Seite dann als
  // `noindex`, damit Google sie nicht aufnimmt.
  const noindex = !loading && (clips === null || clips.length === 0);
  const hasClips = clips !== null && clips.length > 0;

  return (
    <main className="min-h-screen bg-slate-950 pt-20 pb-16 sm:pt-24" id="top">
      <Seo
        title={seoTitle}
        description={seoDescription}
        canonicalPath={canonicalPath}
        noindex={noindex}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Start", item: `${SITE_URL}/` },
            { "@type": "ListItem", position: 2, name: "Streamclips Germany", item: `${SITE_URL}/streamclips` },
            { "@type": "ListItem", position: 3, name: breadcrumbName, item: `${SITE_URL}${canonicalPath}` }
          ]
        }}
      />
      {hasClips && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: collectionName ?? displayName,
            url: `${SITE_URL}${canonicalPath}`,
            inLanguage: "de",
            isPartOf: { "@type": "WebSite", name: "broiler.dev", url: SITE_URL },
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: clips!.length,
              itemListElement: clips!.map((c, i) => ({
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
            {eyebrow}
          </p>
          <h1 className="text-2xl font-semibold text-slate-50 sm:text-4xl">
            {emoji && <span className="mr-2" aria-hidden="true">{emoji}</span>}
            {displayName}
          </h1>
          <p className="text-sm text-slate-400">{description}</p>
        </header>

        <StreamclipsNav />

        <HubBody loading={loading} error={error} clips={clips} emptyState={emptyState} />
      </div>
    </main>
  );
}
