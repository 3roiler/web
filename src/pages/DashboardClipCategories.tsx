import * as React from "react";
import { DashboardLayout } from "../components/DashboardLayout";
import {
  adminListCategories,
  adminSetCategorySection,
  ApiError,
  type TwitchCategory,
  type ClipSection
} from "../services";

const SECTIONS: { key: ClipSection; label: string }[] = [
  { key: "gaming", label: "Gaming" },
  { key: "just_chatting", label: "Just Chatting" },
  { key: "irl", label: "IRL" },
  { key: "music", label: "Musik" },
  { key: "esports", label: "Esports" },
  { key: "creative", label: "Kreativ" },
  { key: "other", label: "Sonstiges" }
];

/** Twitch box-art-URLs enthalten {width}x{height}-Platzhalter. */
function boxArt(url: string | null): string | null {
  if (!url) return null;
  return url.replace("{width}", "40").replace("{height}", "53");
}

export function DashboardClipCategoriesPage() {
  return (
    <DashboardLayout
      requiredPermission="dashboard.clips"
      kicker="Dashboard · Streamclips"
      title="Kategorie-Sektionen"
      description="Ordne die (automatisch beim Einreichen angelegten) Twitch-Kategorien einer Sektion zu. Die Sektion steuert die Filter Gaming/IRL/… auf der Streamclips-Seite."
    >
      {() => <CategoriesManager />}
    </DashboardLayout>
  );
}

function CategoriesManager() {
  const [cats, setCats] = React.useState<TwitchCategory[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(() => {
    adminListCategories()
      .then(setCats)
      .catch((err: unknown) => {
        console.error(err);
        setError(
          err instanceof ApiError ? err.message : "Kategorien konnten nicht geladen werden."
        );
      });
  }, []);

  React.useEffect(() => {
    reload();
  }, [reload]);

  async function change(id: string, section: ClipSection) {
    try {
      const updated = await adminSetCategorySection(id, section);
      setCats(
        (prev) => prev?.map((c) => (c.id === id ? { ...c, section: updated.section } : c)) ?? null
      );
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Sektion konnte nicht gesetzt werden.");
    }
  }

  return (
    <div className="max-w-2xl space-y-3">
      {error && <p className="text-sm text-red-300">{error}</p>}
      {cats === null && !error && <p className="text-sm text-slate-400">Lade…</p>}
      {cats !== null && cats.length === 0 && (
        <p className="text-sm text-slate-500">
          Noch keine Kategorien — sie entstehen automatisch, sobald Clips mit Twitch-Kategorie
          eingereicht werden.
        </p>
      )}

      <ul className="space-y-2">
        {cats?.map((cat) => {
          const art = boxArt(cat.boxArtUrl);
          return (
            <li
              key={cat.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                {art && (
                  <img
                    src={art}
                    alt=""
                    className="h-10 w-8 shrink-0 rounded object-cover"
                    loading="lazy"
                  />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-50">{cat.name}</p>
                  <p className="text-xs text-slate-500">{cat.clipCount} Clip(s)</p>
                </div>
              </div>
              <select
                value={cat.section}
                onChange={(e) => change(cat.id, e.target.value as ClipSection)}
                className="shrink-0 rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1.5 text-xs text-slate-100"
                aria-label={`Sektion für ${cat.name}`}
              >
                {SECTIONS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
