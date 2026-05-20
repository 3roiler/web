import * as React from "react";
import { useLocation } from "react-router-dom";

/**
 * Per-Seiten-SEO. Nutzt React 19: in einer Komponente gerenderte
 * `<title>`/`<meta>`/`<link>`-Tags werden automatisch in den <head> gehoben.
 * Googlebot rendert JS und liest diese pro Route — anders als das statische
 * `index.html`, das (ohne Prerendering) für alle URLs gleich ist.
 */
export const SITE_URL = "https://broiler.dev";
export const SITE_NAME = "broiler.dev";

const DEFAULT_DESCRIPTION =
  "Portfolio von Paul Wechselberger: Platform- & Backend-Engineering, Blog und Streamclips Germany — die Community-Plattform für deutsche Twitch-Clips.";
// 1200×630-Vorschaubild. Liegt auf dem DigitalOcean-Spaces-CDN; bitte dort
// hochladen (siehe PR-Beschreibung). Bis dahin zeigen Vorschauen kein Bild.
const DEFAULT_IMAGE = "https://broiler.fra1.cdn.digitaloceanspaces.com/og-image.png";

interface SeoProps {
  /** Seitentitel ohne Site-Suffix (wird als „Titel · broiler.dev" gesetzt). */
  title?: string;
  description?: string;
  image?: string;
  type?: "website" | "article";
  /** Setzt robots auf noindex (z. B. 404 / private Seiten). */
  noindex?: boolean;
  /** Überschreibt den kanonischen Pfad (Default: aktueller Pfad). */
  canonicalPath?: string;
}

export function Seo({
  title,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
  type = "website",
  noindex = false,
  canonicalPath
}: SeoProps) {
  const location = useLocation();
  const path = canonicalPath ?? location.pathname;
  const url = `${SITE_URL}${path}`;
  const fullTitle = title ? `${title} · ${SITE_NAME}` : SITE_NAME;

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={noindex ? "noindex,follow" : "index,follow"} />
      <link rel="canonical" href={url} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta property="og:locale" content="de_DE" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </>
  );
}

/**
 * Rendert ein JSON-LD-`<script>` für strukturierte Daten (schema.org).
 * `<` wird escaped, damit ein versehentliches "</script>" in einem
 * String-Wert nicht aus dem Script-Block ausbrechen kann.
 */
export function JsonLd({ data }: { data: object }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
