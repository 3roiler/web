/**
 * Helpers für die kanonische Streamclip-URL:
 *
 *     /streamclips/clip/<slug>-<shortid>
 *
 * - `slug` stammt aus dem Titel (siehe Backend `slugifyTitle` /
 *   Migration `040_clip_slugs.js`) und trägt die Keywords für SEO.
 * - `shortid` sind die ersten 8 Hex-Zeichen der UUID (Bindestriche
 *   entfernt) und sind der eigentliche Lookup-Key. Ohne shortid wäre
 *   die URL nicht eindeutig (zwei Clips mit identischem Titel würden
 *   denselben Slug erzeugen).
 *
 * Die alte UUID-Form (`/streamclips/clip/<uuid>`) bleibt funktional:
 * der React-Router-Pattern `:id` matched beides; der ClipDetail-Page
 * erkennt das Format und navigiert per `replace` zur kanonischen Slug-
 * Form. Für Crawler erledigt das ein 301-Redirect im API-OG-Renderer.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHORTID_RE = /^[0-9a-f]{8}$/i;
const SLUG_ID_RE = /^([a-z0-9][a-z0-9-]{0,118}?)-([0-9a-f]{8})$/i;

/** Erste 8 Hex-Zeichen der UUID — Disambiguator in der Slug-URL. */
export function shortidFromId(id: string): string {
  return id.replace(/-/g, '').slice(0, 8).toLowerCase();
}

/**
 * Baut den kanonischen Detail-Pfad für einen Clip.
 *
 * Das `clip` muss mindestens `id` und `slug` mitliefern — beides ist
 * im `Clip`-Interface Pflicht (siehe `services/index.tsx`). Vor der
 * Backend-Migration `040_clip_slugs.js` haben ältere Builds des
 * Frontends ggf. noch keinen Slug erhalten; in dem Fall fällt der
 * Pfad auf die UUID-Form zurück, damit nichts crashed.
 */
export function clipDetailPath(clip: { id: string; slug?: string | null }): string {
  if (!clip.slug) return `/streamclips/clip/${clip.id}`;
  return `/streamclips/clip/${clip.slug}-${shortidFromId(clip.id)}`;
}

export type ParsedClipPathId =
  | { kind: 'uuid'; uuid: string }
  | { kind: 'shortid'; slug: string; shortid: string }
  | null;

/**
 * URL-Slugify für Hub-Page-URLs (Streamer / Kategorie / Award). Muss
 * Byte-genau dasselbe Ergebnis liefern wie `slugifyTitle` im Backend
 * (`api/src/services/clip.ts`) — sonst rendert die Hub-Page-Liste
 * Links auf Slugs, die der Backend-Lookup nicht findet. Pflege beide
 * Funktionen synchron.
 */
export function slugifyTitle(title: string | null | undefined): string {
  let s = (title ?? '').toLowerCase();
  // Single-char Substitutionen via `replaceAll` (Sonar S7781) — kein Regex
  // nötig und liest sich klarer als `/ä/g`.
  s = s.replaceAll('ä', 'ae').replaceAll('ö', 'oe').replaceAll('ü', 'ue').replaceAll('ß', 'ss');
  s = s.replaceAll('ç', 'c').replaceAll('ñ', 'n');
  // Diakritika gleicher Grundvokale in einem Schritt — hier muss Regex sein
  // (Character Class).
  s = s.replace(/[éèêë]/g, 'e');
  s = s.replace(/[áàâãå]/g, 'a');
  s = s.replace(/[óòôõø]/g, 'o');
  s = s.replace(/[úùûü]/g, 'u');
  s = s.replace(/[íìîï]/g, 'i');
  s = s.replace(/[^a-z0-9]+/g, '-');
  // Leading/trailing dashes ohne Regex trimmen (Sonar S5852). `codePointAt`
  // statt `charCodeAt` (Sonar S7758) — für ASCII identisch, aber Unicode-
  // korrekt; `'-'` ist Code Point 0x2D = 45.
  const dashCp = 0x2D;
  let start = 0;
  while (start < s.length && s.codePointAt(start) === dashCp) start++;
  let end = s.length;
  while (end > start && s.codePointAt(end - 1) === dashCp) end--;
  s = s.slice(start, end).slice(0, 100);
  return s || 'clip';
}

/**
 * Baut den Pfad zur Streamer-Hub-Seite. Broadcaster-Namen sind Twitch-
 * Logins (`[a-zA-Z0-9_]`), wir lowercasen für eine einheitliche URL-
 * Form. `null` Broadcaster (sehr selten — Helix lieferte keinen Namen)
 * → `null`, der Aufrufer sollte den Link dann nicht rendern.
 */
export function streamerHubPath(broadcasterName: string | null | undefined): string | null {
  if (!broadcasterName) return null;
  return `/streamclips/streamer/${encodeURIComponent(broadcasterName.toLowerCase())}`;
}

/** Pfad zur Twitch-Kategorie-Hub-Seite. Slug aus dem Kategorie-Namen. */
export function categoryHubPath(categoryName: string | null | undefined): string | null {
  if (!categoryName) return null;
  return `/streamclips/kategorie/${slugifyTitle(categoryName)}`;
}

/** Pfad zur Award-Hub-Seite. Award-`key` ist bereits Slug-Form. */
export function awardHubPath(awardKey: string | null | undefined): string | null {
  if (!awardKey) return null;
  return `/streamclips/award/${encodeURIComponent(awardKey)}`;
}

/**
 * Klassifiziert den `:id`-Parameter der ClipDetail-Route.
 *
 * - UUID-Form → kommt vermutlich aus einem alten, geteilten Link;
 *   wird vom Detail-Page nach erfolgreichem Lookup zur Slug-Form
 *   umnavigiert (302 clientseitig per `navigate(replace)`).
 * - Slug-Form (`text-<8hex>`) → kanonische URL.
 * - Sonst → `null`, Detail-Page rendert NotFound.
 */
export function parseClipPathId(raw: string | undefined | null): ParsedClipPathId {
  if (!raw) return null;
  if (UUID_RE.test(raw)) return { kind: 'uuid', uuid: raw.toLowerCase() };
  const match = SLUG_ID_RE.exec(raw);
  if (match) {
    return { kind: 'shortid', slug: match[1].toLowerCase(), shortid: match[2].toLowerCase() };
  }
  // Toleranz: nur eine 8-Hex-shortid ohne Slug-Prefix („/clip/-a1b2c3d4"
  // oder „/clip/a1b2c3d4") akzeptieren, damit copy-paste aus Logs nicht
  // direkt auf 404 läuft.
  if (SHORTID_RE.test(raw)) return { kind: 'shortid', slug: '', shortid: raw.toLowerCase() };
  return null;
}
