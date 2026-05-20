import * as React from "react";
import { DashboardLayout } from "../components/DashboardLayout";
import { AwardChip } from "../components/streamclips/AwardChip";
import {
  adminListAwards,
  adminCreateAward,
  adminUpdateAward,
  adminDeleteAward,
  ApiError,
  type AwardCategory
} from "../services";

const COLORS = ["amber", "emerald", "orange", "red", "pink", "purple", "cyan"];

export function DashboardAwardsPage() {
  return (
    <DashboardLayout
      requiredPermission="dashboard.clips"
      kicker="Dashboard · Streamclips"
      title="Award-Kategorien"
      description="Die Labels, die Nutzer beim Bewerten vergeben (lustigster, bester Play, …). Inaktive Awards verschwinden aus dem Vote-Feed, bleiben aber an alten Stimmen erhalten."
    >
      {() => <AwardsManager />}
    </DashboardLayout>
  );
}

function AwardsManager() {
  const [awards, setAwards] = React.useState<AwardCategory[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(() => {
    adminListAwards()
      .then(setAwards)
      .catch((err: unknown) => {
        console.error(err);
        setError(err instanceof ApiError ? err.message : "Awards konnten nicht geladen werden.");
      });
  }, []);

  React.useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="max-w-2xl space-y-6">
      <CreateAwardForm onCreated={reload} />

      {error && <p className="text-sm text-red-300">{error}</p>}
      {awards === null && !error && <p className="text-sm text-slate-400">Lade…</p>}

      <ul className="space-y-2">
        {awards?.map((award) => (
          <li key={award.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center gap-3">
              <AwardChip emoji={award.emoji} label={award.displayName} color={award.color} />
              <code className="text-xs text-slate-500">{award.key}</code>
              {!award.isActive && <span className="text-xs text-slate-500">(inaktiv)</span>}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  adminUpdateAward(award.id, { isActive: !award.isActive }).then(reload).catch(console.error)
                }
                className="btn-outline btn-sm"
              >
                {award.isActive ? "Deaktivieren" : "Aktivieren"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (globalThis.confirm(`Award „${award.displayName}" wirklich löschen?`)) {
                    adminDeleteAward(award.id).then(reload).catch(console.error);
                  }
                }}
                className="text-xs text-slate-500 hover:text-red-300"
              >
                Löschen
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CreateAwardForm({ onCreated }: { onCreated: () => void }) {
  const [key, setKey] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [emoji, setEmoji] = React.useState("");
  const [color, setColor] = React.useState(COLORS[0]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await adminCreateAward({
        key: key.trim(),
        displayName: displayName.trim(),
        emoji: emoji.trim() || null,
        color
      });
      setKey("");
      setDisplayName("");
      setEmoji("");
      onCreated();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Anlegen fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Neue Award-Kategorie</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Anzeigename (z.B. Bester Play)"
          required
          className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
        />
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="key (z.B. best_play)"
          required
          className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
        />
        <input
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          placeholder="Emoji (optional)"
          className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
        />
        <select
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
        >
          {COLORS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      {error && <p className="text-sm text-red-300">{error}</p>}
      <button type="submit" disabled={busy} className="btn btn-sm">
        {busy ? "Lege an…" : "Anlegen"}
      </button>
    </form>
  );
}
