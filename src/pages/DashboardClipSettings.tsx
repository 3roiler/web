import * as React from "react";
import { DashboardLayout } from "../components/DashboardLayout";
import {
  getModerationSettings,
  updateModerationSettings,
  getForYouSettings,
  updateForYouSettings,
  ApiError,
  type ModerationSettings,
  type ForYouSettings,
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
      title="Einstellungen"
      description={<>Eingangsprüfung und „Für dich&quot;-Algorithmus konfigurieren.</>}
    >
      {() => (
        <div className="max-w-2xl space-y-10">
          <SettingsForm />
          <ForYouSettingsForm />
        </div>
      )}
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
        setError(
          err instanceof ApiError ? err.message : "Einstellungen konnten nicht geladen werden."
        );
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
    <section className="space-y-6">
      <header>
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
          Eingangsprüfung
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Wann läuft ein Clip durch die Prüfung, wann geht er direkt online?
        </p>
      </header>
      {/* Tageslimit */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <label htmlFor="daily-limit" className="block text-sm font-semibold text-slate-50">
          Auto-Freigabe pro Tag und Nutzer
        </label>
        <p className="mt-1 text-xs text-slate-400">
          Die ersten <span className="text-slate-200">N</span> Clips pro Tag gehen ohne Prüfung
          rein, alle weiteren landen zur Prüfung. <span className="text-slate-200">0</span> = jeder
          Clip wird geprüft.
        </p>
        <input
          id="daily-limit"
          type="number"
          min={0}
          max={1000}
          value={settings.autoApproveDailyLimit}
          onChange={(e) =>
            patch({ autoApproveDailyLimit: Math.max(0, Number.parseInt(e.target.value, 10) || 0) })
          }
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
            <span className="block text-sm font-semibold text-slate-50">
              Alle Clips müssen geprüft werden
            </span>
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
    </section>
  );
}

/**
 * „Für dich"-Algorithmus. Drei Gewichts-Slider (0…1) + drei numerische
 * Fenster-Inputs. Die Gewichte werden im Backend normalisiert, summieren
 * sich also nicht zwingend auf 1.0 — die UI zeigt zur Orientierung den
 * relativen Anteil neben jedem Slider.
 */
function ForYouSettingsForm() {
  const [settings, setSettings] = React.useState<ForYouSettings | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    getForYouSettings()
      .then(setSettings)
      .catch((err: unknown) => {
        console.error(err);
        setError(
          err instanceof ApiError
            ? err.message
            : '„Für dich"-Einstellungen konnten nicht geladen werden.'
        );
      });
  }, []);

  if (error && !settings) return <p className="text-sm text-red-300">{error}</p>;
  if (!settings) return <p className="text-sm text-slate-400">Lade „Für dich"-Einstellungen…</p>;

  function patch(p: Partial<ForYouSettings>) {
    setSettings((s) => (s ? { ...s, ...p } : s));
    setSaved(false);
  }

  async function save() {
    if (!settings) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await updateForYouSettings(settings);
      setSettings(updated);
      setSaved(true);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  const sumWeights = settings.weightMatching + settings.weightQuality + settings.weightRecency;
  const pct = (v: number) => (sumWeights > 0 ? Math.round((v / sumWeights) * 100) : 0);

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
          „Für dich"-Algorithmus
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Gewichtung der Signale im Personal-Feed. Anteile werden serverseitig normalisiert.
        </p>
      </header>

      <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <WeightSlider
          id="weight-matching"
          label="Kategorie-Match"
          hint="Wie stark zählt es, wenn der Clip in einer der Lieblings-Kategorien des Users liegt."
          value={settings.weightMatching}
          percent={pct(settings.weightMatching)}
          onChange={(v) => patch({ weightMatching: v })}
        />
        <WeightSlider
          id="weight-quality"
          label="Bayesian-Qualität"
          hint="Wie stark zählt der global gemittelte Score des Clips (gegen Globalmittel gedämpft)."
          value={settings.weightQuality}
          percent={pct(settings.weightQuality)}
          onChange={(v) => patch({ weightQuality: v })}
        />
        <WeightSlider
          id="weight-recency"
          label="Frische-Boost"
          hint="Wie stark zählt es, dass der Clip neu eingereicht wurde (linearer Falloff)."
          value={settings.weightRecency}
          percent={pct(settings.weightRecency)}
          onChange={(v) => patch({ weightRecency: v })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <NumberField
          id="recency-window"
          label="Recency-Fenster"
          suffix="Tage"
          min={1}
          max={365}
          value={settings.recencyWindowDays}
          onChange={(v) => patch({ recencyWindowDays: v })}
          hint="Innerhalb dieses Fensters bekommt ein Clip noch Recency-Punkte."
        />
        <NumberField
          id="freshness-pool"
          label="Frische-Pool"
          suffix="Tage"
          min={1}
          max={90}
          value={settings.freshnessPoolDays}
          onChange={(v) => patch({ freshnessPoolDays: v })}
          hint="Clips dieser Tage qualifizieren auch ohne Kategorie-Match."
        />
        <NumberField
          id="min-positive"
          label="Min-Score (Kategorie)"
          suffix="★"
          min={1}
          max={5}
          value={settings.minPositiveScore}
          onChange={(v) => patch({ minPositiveScore: v })}
          hint="Ab welcher Bewertung gilt eine Kategorie als „mag der User“."
        />
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={busy} className="btn btn-sm">
          {busy ? "Speichere…" : "Speichern"}
        </button>
        {saved && <span className="text-sm text-emerald-300">Gespeichert ✓</span>}
      </div>
    </section>
  );
}

function WeightSlider({
  id,
  label,
  hint,
  value,
  percent,
  onChange
}: {
  id: string;
  label: string;
  hint: string;
  value: number;
  percent: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-slate-200">
          {label}
        </label>
        <span className="font-mono text-xs text-cyan-300 tabular-nums">
          {value.toFixed(2)} · {percent}%
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-cyan-500"
      />
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function NumberField({
  id,
  label,
  suffix,
  value,
  min,
  max,
  onChange,
  hint
}: {
  id: string;
  label: string;
  suffix: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <label htmlFor={id} className="text-sm font-medium text-slate-200">
        {label}
      </label>
      <div className="mt-2 flex items-center gap-2">
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const n = Number.parseInt(e.target.value, 10);
            if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, n)));
          }}
          className="w-20 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
        />
        <span className="text-xs text-slate-500">{suffix}</span>
      </div>
      <p className="mt-2 text-xs text-slate-500">{hint}</p>
    </div>
  );
}
