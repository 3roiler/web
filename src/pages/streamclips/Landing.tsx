import * as React from "react";
import { Link } from "react-router-dom";
import { Routes } from "../../config/routes";
import { StreamclipsNav } from "../../components/streamclips/StreamclipsNav";
import { Seo, JsonLd, SITE_URL } from "../../components/Seo";
import { ClipCarousel } from "../../components/streamclips/ClipCarousel";
import { ClipCard } from "../../components/streamclips/ClipCard";
import {
  getMe,
  browseClips,
  searchClips,
  getLeaderboard,
  getPersonalClipFeed,
  loginToTwitch,
  type User,
  type BrowseData,
  type ClipWithContext
} from "../../services";

const TWITCH_BTN =
  "inline-flex items-center justify-center gap-2 rounded-full bg-[#9146FF] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#772ce8]";

/**
 * Streamclips-Startseite: Pitch + Volltextsuche + "Laufbänder" (Carousels)
 * der freigegebenen Clips — gruppiert nach Twitch-Kategorie und nach
 * Award-Label. Sobald gesucht wird, ersetzt ein Ergebnis-Grid die Reihen.
 */
export function StreamclipsHomePage() {
  const [me, setMe] = React.useState<User | null | undefined>(undefined);
  const [browse, setBrowse] = React.useState<BrowseData | null>(null);
  const [browseError, setBrowseError] = React.useState<string | null>(null);
  const [top30, setTop30] = React.useState<ClipWithContext[]>([]);
  const [forYou, setForYou] = React.useState<ClipWithContext[]>([]);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<ClipWithContext[] | null>(null);
  const [searching, setSearching] = React.useState(false);

  React.useEffect(() => {
    getMe()
      .then((user) => {
        setMe(user);
        // „Für dich" nur für eingeloggte User. Fehler still schlucken —
        // bei einem leeren Feed fallen wir auf die anderen Carousels
        // zurück und zeigen einfach kein „Für dich"-Band.
        if (user) {
          getPersonalClipFeed(12).then(setForYou).catch(() => undefined);
        }
      })
      .catch(() => setMe(null));
    browseClips()
      .then(setBrowse)
      .catch(() => setBrowseError("Übersicht konnte nicht geladen werden."));
    getLeaderboard(undefined, 12, "month").then(setTop30).catch(() => undefined);
  }, []);

  // Debounced Volltextsuche.
  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      searchClips(q)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const isSearching = query.trim().length >= 2;

  return (
    <main className="min-h-screen bg-slate-950 pt-20 pb-16 sm:pt-24" id="top">
      <Seo title="Streamclips Germany — deutsche Twitch-Clips" description="Die besten deutschen Twitch-Clips, von der Community gewählt. Entdecken, bewerten und einreichen." />
      {/* CollectionPage — explizites Signal an Google, dass diese Seite
          eine Sammlung weiterer Inhalte ist (kein einzelner Artikel/Video).
          Hilft bei der korrekten Klassifizierung als „Hub" der Plattform.
          BreadcrumbList: Home > Streamclips. */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Streamclips Germany",
          description:
            "Die besten deutschen Twitch-Clips, von der Community gewählt. Entdecken, bewerten und einreichen.",
          url: `${SITE_URL}/streamclips`,
          inLanguage: "de",
          isPartOf: { "@type": "WebSite", name: "broiler.dev", url: SITE_URL }
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Start", item: `${SITE_URL}/` },
            { "@type": "ListItem", position: 2, name: "Streamclips Germany", item: `${SITE_URL}/streamclips` }
          ]
        }}
      />
      {/* ItemList der Top-Monatsclips. Wird im UI als „Top-30 (Monat)"
          Karussell gezeigt; im JSON-LD geben wir die exakt selbe
          Reihenfolge weiter — bei leerer Liste (z. B. ganz frischer
          DB-Stand) das Element weglassen, damit kein leeres Markup
          rumliegt. */}
      {top30.length > 0 && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Top-Clips (30 Tage)",
            itemListOrder: "https://schema.org/ItemListOrderDescending",
            numberOfItems: top30.length,
            itemListElement: top30.map((c, i) => ({
              "@type": "ListItem",
              position: i + 1,
              url: `${SITE_URL}/streamclips/clip/${c.id}`,
              name: c.title
            }))
          }}
        />
      )}
      <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6 sm:pt-12 lg:px-16 lg:pt-16">
        <header className="mb-6 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#bf94ff] sm:tracking-[0.3em]">
            Streamclips Germany 🇩🇪
          </p>
          <h1 className="text-2xl font-semibold text-slate-50 sm:text-4xl">
            Die besten deutschen Twitch-Clips — von der Community gewählt.
          </h1>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link to={Routes.Streamclips.Vote} className={TWITCH_BTN}>Clips bewerten</Link>
            <Link to={Routes.Streamclips.Submit} className="btn-outline">Clip einreichen</Link>
            {me === null && (
              <button type="button" onClick={() => loginToTwitch()} className="btn-outline">
                Mit Twitch anmelden
              </button>
            )}
          </div>
        </header>

        <StreamclipsNav />

        <div className="mb-8">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suche nach Titel, Streamer, Kategorie oder Award…"
            aria-label="Clips durchsuchen"
            className="w-full rounded-full border border-white/10 bg-slate-950/60 px-5 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-[#9146FF]/50 focus:outline-none"
          />
        </div>

        {isSearching ? (
          <SearchResults query={query} results={results} searching={searching} />
        ) : (
          <BrowseSections browse={browse} error={browseError} top30={top30} forYou={forYou} />
        )}
      </div>
    </main>
  );
}

function SearchResults({
  query,
  results,
  searching
}: {
  query: string;
  results: ClipWithContext[] | null;
  searching: boolean;
}) {
  if (results === null) {
    return <p className="text-sm text-slate-400">{searching ? "Suche…" : null}</p>;
  }
  if (results.length === 0) {
    return <p className="text-sm text-slate-500">Keine Treffer für „{query.trim()}".</p>;
  }
  return (
    <section className="space-y-3">
      <p className="text-xs text-slate-400">{results.length} Treffer</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {results.map((c) => (
          <ClipCard key={c.id} clip={c} />
        ))}
      </div>
    </section>
  );
}

function BrowseSections({
  browse,
  error,
  top30,
  forYou
}: {
  browse: BrowseData | null;
  error: string | null;
  top30: ClipWithContext[];
  forYou: ClipWithContext[];
}) {
  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (browse === null) return <p className="text-sm text-slate-400">Lade…</p>;

  const empty = browse.byCategory.length === 0 && browse.byAward.length === 0;
  if (empty) {
    return (
      <p className="text-sm text-slate-500">
        Noch keine freigegebenen Clips.{" "}
        <Link to={Routes.Streamclips.Submit} className="text-[#bf94ff] hover:underline">Reiche den ersten ein →</Link>
      </p>
    );
  }

  return (
    <div className="space-y-12">
      {forYou.length > 0 && (
        <ClipCarousel
          title={
            <>
              <span aria-hidden="true">✨</span>Für dich
            </>
          }
          clips={forYou}
        />
      )}
      <ClipCarousel
        title={
          <>
            <span aria-hidden="true">🔥</span>Beste der letzten 30 Tage
          </>
        }
        clips={top30}
      />
      {browse.byCategory.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Nach Kategorie</h2>
          {browse.byCategory.map((row) => (
            <ClipCarousel key={row.gameId} title={row.name} clips={row.clips} />
          ))}
        </div>
      )}
      {browse.byAward.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Nach Bewertung</h2>
          {browse.byAward.map((row) => (
            <ClipCarousel
              key={row.key}
              title={
                <>
                  {row.emoji && <span aria-hidden="true">{row.emoji}</span>}
                  {row.displayName}
                </>
              }
              clips={row.clips}
            />
          ))}
        </div>
      )}
    </div>
  );
}
