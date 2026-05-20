import * as React from "react";
import { DashboardLayout } from "../components/DashboardLayout";
import {
  getModerationSettings,
  updateModerationSettings,
  ApiError,
  type ModerationSettings,
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

export function DashboardClipSettingsPage() {
  return (
    <DashboardLayout
      requiredPermission="dashboard.clips"
      kicker="Dashboard · Streamclips"
      title="Eingangsprüfung"
      description="Steuert, welche eingereichten Clips direkt freigegeben werden und welche erst geprüft werden müssen."
    >
      {() => <SettingsForm />}
    </DashboardLayout>
  );
}

function SettingsForm() {
  const [settings, setSettings] = React.useState<ModerationSettings | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    getModerationSettings()
      .then(setSettings)
      .catch((err: unknown) => {
        console.error(err);
        setError(err instanceof ApiError ? err.message : "Einstellungen konnten nicht geladen werden.");
      });
  }, []);

  if (error && !settings) return <p className="text-sm text-red-300">{error}</p>;
  if (!settings) return <p className="text-sm text-slate-400">Lade…</p>;

  function patch(p: Partial<ModerationSettings>) {
    setSettings((s) => (s ? { ...s, ...p } : s));
    setSaved(false);
  }

  function toggleSection(key: ClipSection) {
    setSettings((s) => {
      if (!s) return s;
      const reviewSections = s.reviewSections.includes(key)
        ? s.reviewSections.filter((x) => x !== key)
        : [...s.reviewSections, key];
      return { ...s, reviewSections };
    });
    setSaved(false);
  }

  async function save() {
    if (!settings) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await updateModerationSettings(settings);
      setSettings(updated);
      setSaved(true);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      {/* Tageslimit */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <label htmlFor="daily-limit" className="block text-sm font-semibold text-slate-50">
          Auto-Freigabe pro Tag und Nutzer
        </label>
        <p className="mt-1 text-xs text-slate-400">
          Die ersten <span className="text-slate-200">N</span> Clips pro Tag gehen ohne Prüfung rein, alle
          weiteren landen zur Prüfung. <span className="text-slate-200">0</span> = jeder Clip wird geprüft.
        </p>
        <input
          id="daily-limit"
          type="number"
          min={0}
          max={1000}
          value={settings.autoApproveDailyLimit}
          onChange={(e) => patch({ autoApproveDailyLimit: Math.max(0, Number.parseInt(e.target.value, 10) || 0) })}
          className="mt-3 w-28 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
        />
      </div>

      {/* Globaler Toggle */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={settings.requireReviewAll}
            onChange={(e) => patch({ requireReviewAll: e.target.checked })}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            <span className="block text-sm font-semibold text-slate-50">Alle Clips müssen geprüft werden</span>
            <span className="mt-0.5 block text-xs text-slate-400">
              Übersteuert Tageslimit und Sektionen — nichts wird automatisch freigegeben.
            </span>
          </span>
        </label>
      </div>

      {/* Sektions-Prüfpflicht */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm font-semibold text-slate-50">Prüfpflicht pro Sektion</p>
        <p className="mt-1 text-xs text-slate-400">
          Clips dieser Sektionen werden immer geprüft (z. B. IRL), unabhängig vom Tageslimit. Die
          Sektion ergibt sich aus der{" "}
          <span className="text-slate-200">Kategorie→Sektion-Zuordnung</span>.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SECTIONS.map((s) => (
            <label
              key={s.key}
              className={`flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm ${
                settings.requireReviewAll ? "opacity-40" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={settings.reviewSections.includes(s.key)}
                onChange={() => toggleSection(s.key)}
                disabled={settings.requireReviewAll}
                className="h-4 w-4"
              />
              <span className="text-slate-200">{s.label}</span>
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={busy} className="btn btn-sm">
          {busy ? "Speichere…" : "Speichern"}
        </button>
        {saved && <span className="text-sm text-emerald-300">Gespeichert ✓</span>}
      </div>
    </div>
  );
}
