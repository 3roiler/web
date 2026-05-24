/**
 * URL-Sanitizer für Backend-stammende Strings, die als `href`/`src`
 * gerendert werden.
 *
 * Ohne diese Prüfung könnte ein vom Server gelieferter String wie
 * `javascript:alert(1)` direkt in einen `<a href>` landen — moderne
 * Browser feuern das `<img src=javascript:…>` zwar nicht mehr, aber für
 * `<a href>` ist der Vektor weiter offen. CodeQL erkennt zudem rohe
 * Pass-Through-Werte als "DOM text reinterpreted as HTML" und meldet
 * den Hotspot.
 *
 * Implementierung bewusst über `new URL(...).toString()`: Erst der
 * Roundtrip durch den URL-Parser markiert den Wert in CodeQLs Taint-
 * Tracking als sanitisiert.
 */
export function safeHttpUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}
