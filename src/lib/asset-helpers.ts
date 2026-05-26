/**
 * Tiny helpers shared between the asset-management pages
 * (`Gcode.tsx`, `Stl.tsx`, future slicer outputs etc.).
 *
 * Lives in its own file so SonarCloud doesn't flag the inevitable
 * "two pages with the same upload card" duplication — and so the
 * formatting style is consistent across every file-list view.
 */

/**
 * Server-side default upload cap. Mirrors `GCODE_MAX_BYTES` in the API
 * (50 MiB). STL uploads share the same limit until evidence shows they
 * need their own. Both file-list pages let the operator override at
 * runtime via the matching `window.__gcodeMaxBytes` /
 * `window.__stlMaxBytes` global.
 */
export const DEFAULT_ASSET_MAX_BYTES = 52428800;

/**
 * Reads a runtime override from `globalThis` if present, otherwise
 * falls back to the shared default. Stays a function so the read
 * happens at render time — useful if someone tweaks the global from
 * the devtools mid-session.
 */
export function readMaxBytes(globalKey: string): number {
  const override = (globalThis as unknown as Record<string, unknown>)[globalKey];
  return typeof override === "number" && Number.isFinite(override) && override > 0
    ? override
    : DEFAULT_ASSET_MAX_BYTES;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Localised "11.04.26, 14:32" — short on purpose so it fits in tight
 * file-list rows next to the size badge.
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

/**
 * "1h 23m" / "23m" / `null` when the value is missing. Returns null
 * rather than "—" so callers can compose without dealing with
 * placeholder strings.
 */
export function formatDuration(seconds: number | undefined): string | null {
  if (seconds === undefined) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
