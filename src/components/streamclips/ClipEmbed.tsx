import * as React from "react";

interface ClipEmbedProps {
  /** Twitch-Clip-Slug (twitchClipId). */
  clipId: string;
  title?: string;
  className?: string;
  autoplay?: boolean;
}

/**
 * Bettet einen Twitch-Clip als 16:9-iframe ein. Twitch verlangt einen
 * `parent`-Parameter mit der einbettenden Domain — wir nehmen den
 * aktuellen Hostname (broiler.dev in Prod, localhost in Dev).
 */
export function ClipEmbed({ clipId, title, className, autoplay = false }: ClipEmbedProps) {
  const parent = globalThis.location.hostname;
  const src =
    `https://clips.twitch.tv/embed?clip=${encodeURIComponent(clipId)}` +
    `&parent=${encodeURIComponent(parent)}&autoplay=${autoplay ? "true" : "false"}`;

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black ${className ?? ""}`}
      style={{ aspectRatio: "16 / 9" }}
    >
      <iframe
        src={src}
        title={title ?? "Twitch Clip"}
        allowFullScreen
        loading="lazy"
        className="absolute inset-0 h-full w-full"
      />
    </div>
  );
}
