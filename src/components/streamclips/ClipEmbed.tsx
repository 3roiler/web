import * as React from "react";

interface ClipEmbedProps {
  /** Twitch-Clip-Slug (twitchClipId). */
  clipId: string;
  title?: string;
  className?: string;
  autoplay?: boolean;
  /**
   * Wenn gesetzt, wird die Sekundenmarke in den iframe-URL geschrieben
   * (`&time=Ns`) und der iframe via `key`-Wechsel neu geladen, sodass
   * der Twitch-Player an dieser Stelle startet. Ein Toggle reicht zum
   * Re-Seek auf die gleiche Stelle, weil der React-Key zusätzlich einen
   * Counter trägt.
   */
  seekToSeconds?: number | null;
  /** Optionaler Counter, der bei jedem Seek-Klick erhöht wird. Ohne ihn
   *  würde ein zweiter Klick auf dieselbe Sekunde keinen Re-Mount
   *  auslösen — der Player bliebe stehen, wo er gerade war. */
  seekNonce?: number;
}

/**
 * Bettet einen Twitch-Clip als responsive 16:9-iframe ein. Twitch verlangt
 * einen `parent`-Parameter mit der einbettenden Domain — wir nehmen den
 * aktuellen Hostname (broiler.dev in Prod, localhost in Dev).
 *
 * Programmatic Seeking funktioniert über den `time`-Query-Parameter im
 * Embed-URL + Re-Mount via React-Key. Twitch hätte eine JS-Embed-API mit
 * `.seek()`, aber die kostet uns einen zusätzlichen Script-Tag — der
 * URL-Parameter-Pfad reicht für unsere UX und bleibt zero-runtime.
 */
export function ClipEmbed({
  clipId,
  title,
  className,
  autoplay = false,
  seekToSeconds = null,
  seekNonce = 0
}: ClipEmbedProps) {
  const parent = globalThis.location.hostname;
  const params = new URLSearchParams({
    clip: clipId,
    parent,
    autoplay: autoplay || seekToSeconds !== null ? 'true' : 'false'
  });
  if (seekToSeconds !== null && Number.isFinite(seekToSeconds) && seekToSeconds > 0) {
    params.set('time', `${Math.floor(seekToSeconds)}s`);
  }
  const src = `https://clips.twitch.tv/embed?${params.toString()}`;
  // Key kombiniert clipId + seekNonce, damit ein erneuter Klick auf
  // dieselbe Sekunde den iframe neu mountet (sonst kein Seek).
  const iframeKey = `${clipId}:${seekToSeconds ?? 'none'}:${seekNonce}`;

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black ${className ?? ""}`}
      style={{ aspectRatio: "16 / 9" }}
    >
      <iframe
        key={iframeKey}
        src={src}
        title={title ?? "Twitch Clip"}
        allowFullScreen
        loading="lazy"
        className="absolute inset-0 h-full w-full"
      />
    </div>
  );
}
