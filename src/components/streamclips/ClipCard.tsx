import * as React from "react";
import { Link } from "react-router-dom";
import { Routes } from "../../config/routes";
import { StarRating } from "./StarRating";
import { safeHttpUrl } from "../../lib/url";
import type { ClipWithContext } from "../../services";

/** Kompakte Clip-Kachel für Carousels und Suchergebnisse. */
export function ClipCard({ clip }: { clip: ClipWithContext }) {
  const thumb = safeHttpUrl(clip.thumbnailUrl);
  return (
    <Link
      to={Routes.Streamclips.ClipDetail.replace(":id", clip.id)}
      className="group block overflow-hidden rounded-xl border border-white/10 bg-white/5 transition hover:border-[#9146FF]/40"
    >
      <div className="relative w-full overflow-hidden bg-black" style={{ aspectRatio: "16 / 9" }}>
        {thumb && (
          <img
            src={thumb}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        )}
      </div>
      <div className="p-2.5">
        <p className="truncate text-sm font-semibold text-slate-50">{clip.title}</p>
        <p className="truncate text-xs text-slate-400">
          {clip.broadcasterName ?? "?"}
          {clip.categoryName && <> · {clip.categoryName}</>}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          <StarRating value={Math.round(clip.avgScore ?? 0)} readOnly size="sm" />
          <span className="text-xs text-slate-500 tabular-nums">{clip.ratingCount}</span>
        </div>
      </div>
    </Link>
  );
}
