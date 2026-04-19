import * as React from "react";
import {
  listAppSettings,
  listAppSecrets,
  upsertAppSetting,
  deleteAppSetting,
  writeAppSecret,
  deleteAppSecret,
  ApiError,
  type AppSetting,
  type AppSecretMeta
} from "../services";
import { DashboardLayout } from "../components/DashboardLayout";

/**
 * Dashboard page for site-wide configuration and AES-GCM-encrypted secrets.
 *
 * Two UI blocks share the same data source:
 *
 *  1. **DigitalOcean**: a curated form with hand-picked keys (app ID, DB ID,
 *     token, metrics refresh interval) so the common case — "configure DO
 *     integration" — doesn't require the operator to know the exact dotted
 *     key strings.
 *
 *  2. **Erweitert**: a raw key/value list showing *every* plain setting and
 *     *every* secret that exists, with inline edit + delete. Anything the
 *     curated section doesn't know about lives here, and arbitrary keys can
 *     be added for future features without a code change.
 *
 * Both blocks read from the same underlying `listAppSettings()` /
 * `listAppSecrets()` responses so there's a single source of truth; saving
 * from either block triggers a shared reload.
 *
 * Server-side `requirePermission('dashboard.settings')` is the actual gate;
 * the `DashboardLayout` check is only there for UX so admins who open this
 * page without the permission see a friendly message instead of a 403.
 */

/** Curated key metadata used by the DigitalOcean form block. */
interface CuratedSetting {
  key: string;
  label: string;
  description: string;
  /** `text` for freeform strings, `number` for numeric settings. */
  kind: "text" | "number";
  placeholder?: string;
}

const CURATED_DO_SETTINGS: CuratedSetting[] = [
  {
    key: "digitalocean.database_id",
    label: "Datenbank-ID",
    description: "UUID des DigitalOcean Managed-Postgres-Clusters.",
    kind: "text",
    placeholder: "z. B. db-postgresql-…"
  },
  {
    key: "metrics.refresh_default_seconds",
    label: "Refresh-Intervall (Sekunden)",
    description: "Voreinstellung für Auto-Refresh auf der Metrics-Seite.",
    kind: "number",
    placeholder: "30"
  }
];

/**
 * The apps list is stored as a JSON array under `digitalocean.apps`. Rendered
 * by its own dedicated editor (see `DigitalOceanAppsEditor`) rather than the
 * generic curated row because the shape — list of `{id, label}` — needs
 * add/remove/reorder UI. The key is included in `CURATED_SETTING_KEYS` so the
 * Advanced section doesn't also show it as a raw JSON blob.
 */
const CURATED_DO_APPS_KEY = "digitalocean.apps";

/**
 * Pre-multi-app deployments stored a single app UUID here. New code reads
 * the list at `digitalocean.apps`; the server falls back to this key only if
 * the list is empty. The settings UI surfaces it as a migration prompt and
 * leaves it to the operator to decide when to delete it.
 */
const LEGACY_APP_ID_KEY = "digitalocean.app_id";

const CURATED_DO_SECRETS: { key: string; label: string; description: string }[] = [
  {
    key: "digitalocean.token",
    label: "API-Token",
    description:
      "Persönlicher DigitalOcean API-Token mit Lese-Scope auf App Platform und Databases. Wird AES-256-GCM-verschlüsselt gespeichert."
  }
];

const CURATED_SETTING_KEYS = new Set<string>([
  ...CURATED_DO_SETTINGS.map((s) => s.key),
  CURATED_DO_APPS_KEY,
  LEGACY_APP_ID_KEY
]);
const CURATED_SECRET_KEYS = new Set(CURATED_DO_SECRETS.map((s) => s.key));

export function DashboardSettingsPage() {
  return (
    <DashboardLayout
      requiredPermission="dashboard.settings"
      kicker="Dashboard · Einstellungen"
      title="Site-Konfiguration"
      description={
        <>
          Zentrale Konfiguration für Integrationen wie DigitalOcean und Feature-Flags. Secrets
          werden mit AES-256-GCM verschlüsselt — nach dem Speichern siehst du nur noch eine
          Kurzvorschau, keinen Klartext.
        </>
      }
    >
      {() => <SettingsContent />}
    </DashboardLayout>
  );
}

function SettingsContent() {
  const [settings, setSettings] = React.useState<AppSetting[] | null>(null);
  const [secrets, setSecrets] = React.useState<AppSecretMeta[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    try {
      const [settingList, secretList] = await Promise.all([
        listAppSettings(),
        listAppSecrets()
      ]);
      setSettings(settingList);
      setSecrets(secretList);
      setError(null);
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof ApiError ? e.message : "Beim Laden der Einstellungen ist ein Fehler aufgetreten.");
    }
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const flashInfo = React.useCallback((msg: string) => {
    setInfo(msg);
    globalThis.setTimeout(() => setInfo(null), 4000);
  }, []);

  if (settings === null || secrets === null) {
    return <p className="text-sm text-slate-400">Lade…</p>;
  }

  return (
    <div className="space-y-10">
      {error && <p className="text-sm text-red-300">{error}</p>}
      {info && <p className="text-sm text-cyan-300">{info}</p>}

      <DigitalOceanSection
        settings={settings}
        secrets={secrets}
        onReload={reload}
        onError={setError}
        onInfo={flashInfo}
      />

      <AdvancedSection
        settings={settings}
        secrets={secrets}
        onReload={reload}
        onError={setError}
        onInfo={flashInfo}
      />
    </div>
  );
}

// ─── DigitalOcean curated block ─────────────────────────────────────────────

interface SectionProps {
  settings: AppSetting[];
  secrets: AppSecretMeta[];
  onReload: () => Promise<void>;
  onError: (msg: string | null) => void;
  onInfo: (msg: string) => void;
}

function DigitalOceanSection({ settings, secrets, onReload, onError, onInfo }: SectionProps) {
  const appsSetting = settings.find((s) => s.key === CURATED_DO_APPS_KEY) ?? null;
  const legacyAppId = settings.find((s) => s.key === LEGACY_APP_ID_KEY) ?? null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <header>
        <h2 className="text-lg font-semibold text-slate-50">DigitalOcean</h2>
        <p className="mt-1 text-xs text-slate-400">
          Zugangsdaten für App Platform und Managed-Postgres. Wird von der Metrics-Seite gelesen.
        </p>
      </header>

      <div className="mt-5 space-y-6">
        <DigitalOceanAppsEditor
          current={appsSetting}
          legacy={legacyAppId}
          onReload={onReload}
          onError={onError}
          onInfo={onInfo}
        />

        {CURATED_DO_SETTINGS.map((curated) => (
          <CuratedSettingRow
            key={curated.key}
            curated={curated}
            current={settings.find((s) => s.key === curated.key) ?? null}
            onReload={onReload}
            onError={onError}
            onInfo={onInfo}
          />
        ))}
      </div>

      <div className="mt-8 space-y-4 border-t border-white/10 pt-6">
        {CURATED_DO_SECRETS.map((curated) => (
          <CuratedSecretRow
            key={curated.key}
            curated={{ key: curated.key, label: curated.label, description: curated.description }}
            current={secrets.find((s) => s.key === curated.key) ?? null}
            onReload={onReload}
            onError={onError}
            onInfo={onInfo}
          />
        ))}
      </div>
    </section>
  );
}

// ─── Apps list editor (digitalocean.apps) ───────────────────────────────────

interface ConfiguredAppInput {
  id: string;
  label: string;
}

interface DigitalOceanAppsEditorProps {
  current: AppSetting | null;
  legacy: AppSetting | null;
  onReload: () => Promise<void>;
  onError: (msg: string | null) => void;
  onInfo: (msg: string) => void;
}

/**
 * Dynamic list editor for `digitalocean.apps`. The setting is a JSON array
 * of `{id, label}` rows — App Platform UUID + a short human label used in
 * the metrics dashboard. Rows can be added, removed, and reordered; an
 * empty list is persisted as `[]` (distinct from "unset" via Delete).
 *
 * Local edit buffer is kept in state so re-ordering doesn't trigger an
 * unsaved-save roundtrip per step. A single "Speichern" button commits the
 * whole array. If the legacy single-UUID key (`digitalocean.app_id`) is
 * still set, we surface a migration hint with a one-click "übernehmen"
 * that seeds the list from the old value.
 */
function DigitalOceanAppsEditor({
  current,
  legacy,
  onReload,
  onError,
  onInfo
}: DigitalOceanAppsEditorProps) {
  const stored = React.useMemo(() => parseAppsSetting(current?.value), [current?.value]);
  const [rows, setRows] = React.useState<ConfiguredAppInput[]>(stored);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  // Re-sync local buffer when a reload brings in a changed stored value.
  // Comparing against a serialised copy keeps the effect stable under React's
  // reference equality — the parsed array is recreated on every render.
  const storedKey = React.useMemo(() => JSON.stringify(stored), [stored]);
  React.useEffect(() => {
    setRows(JSON.parse(storedKey) as ConfiguredAppInput[]);
  }, [storedKey]);

  const dirty = JSON.stringify(rows) !== storedKey;

  function update(i: number, patch: Partial<ConfiguredAppInput>) {
    setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  function add() {
    setRows((prev) => [...prev, { id: "", label: "" }]);
  }

  function remove(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function move(i: number, dir: -1 | 1) {
    setRows((prev) => {
      const target = i + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = prev.slice();
      const tmp = next[i];
      next[i] = next[target];
      next[target] = tmp;
      return next;
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    onError(null);

    // Trim all inputs once, then validate. Empty rows (no UUID + no label)
    // are dropped silently so the user can use "Zeile hinzufügen" freely
    // without being forced to fill every slot before saving.
    const cleaned = rows
      .map((r) => ({ id: r.id.trim(), label: r.label.trim() }))
      .filter((r) => r.id !== "" || r.label !== "");

    for (const row of cleaned) {
      if (row.id === "") {
        onError("Jede App braucht eine UUID.");
        return;
      }
      if (row.label === "") {
        onError("Jede App braucht ein Label.");
        return;
      }
    }

    // Duplicate-id guard: server also rejects it, but catching it here gives
    // a nicer message than whatever the upstream validation returns.
    const seen = new Set<string>();
    for (const row of cleaned) {
      if (seen.has(row.id)) {
        onError(`Doppelte App-UUID: ${row.id}`);
        return;
      }
      seen.add(row.id);
    }

    setSaving(true);
    try {
      await upsertAppSetting(
        CURATED_DO_APPS_KEY,
        cleaned,
        "Liste der DigitalOcean App Platform Apps, von denen Metriken gelesen werden."
      );
      await onReload();
      onInfo(`Apps gespeichert (${cleaned.length}).`);
      setRows(cleaned);
    } catch (err: unknown) {
      console.error(err);
      onError(err instanceof ApiError ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const ok = globalThis.confirm("Apps-Liste wirklich komplett entfernen?");
    if (!ok) return;
    setDeleting(true);
    onError(null);
    try {
      await deleteAppSetting(CURATED_DO_APPS_KEY);
      await onReload();
      onInfo("Apps-Liste entfernt.");
    } catch (err: unknown) {
      console.error(err);
      onError(err instanceof ApiError ? err.message : "Löschen fehlgeschlagen.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleAdoptLegacy() {
    if (!legacy) return;
    const legacyId = typeof legacy.value === "string" ? legacy.value.trim() : "";
    if (legacyId === "") return;
    setRows((prev) => {
      if (prev.some((r) => r.id.trim() === legacyId)) return prev;
      return [...prev, { id: legacyId, label: "App" }];
    });
    onInfo("Alte App-ID übernommen. Jetzt Label setzen und speichern.");
  }

  async function handleClearLegacy() {
    if (!legacy) return;
    const ok = globalThis.confirm(`Legacy-Key "${LEGACY_APP_ID_KEY}" wirklich entfernen?`);
    if (!ok) return;
    onError(null);
    try {
      await deleteAppSetting(LEGACY_APP_ID_KEY);
      await onReload();
      onInfo("Legacy-Key entfernt.");
    } catch (err: unknown) {
      console.error(err);
      onError(err instanceof ApiError ? err.message : "Löschen fehlgeschlagen.");
    }
  }

  const hasStored = current !== null;
  const storedCount = stored.length;

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-slate-400">
          DigitalOcean Apps
        </label>
        <p className="mt-1 text-xs text-slate-500">
          Alle App-Platform-Apps, die im Metrics-Dashboard angezeigt werden sollen. Label ist nur
          zur Anzeige — die UUID findest du in der DO-Console unter „Apps → Settings → App
          Info".
        </p>
      </div>

      {legacy && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <p>
            Der alte Einzel-Key <code className="font-mono">{LEGACY_APP_ID_KEY}</code> ist noch
            gesetzt. Das Backend nutzt ihn als Fallback — besser in die Liste übernehmen und den
            Legacy-Key entfernen.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleAdoptLegacy}
              className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-100 transition hover:bg-amber-500/20"
            >
              In Liste übernehmen
            </button>
            <button
              type="button"
              onClick={handleClearLegacy}
              className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-[11px] font-semibold text-red-200 transition hover:bg-red-500/20"
            >
              Legacy-Key löschen
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {rows.length === 0 && (
          <p className="rounded-lg border border-dashed border-white/10 bg-slate-950/30 px-3 py-4 text-center text-xs text-slate-500">
            Keine Apps konfiguriert. Klick auf „Zeile hinzufügen", um eine App aufzunehmen.
          </p>
        )}
        {rows.map((row, idx) => (
          <div
            key={idx}
            className="flex flex-col gap-2 rounded-lg border border-white/10 bg-slate-950/40 p-3 sm:flex-row sm:items-start"
          >
            <div className="flex flex-1 flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={row.id}
                onChange={(e) => update(idx, { id: e.target.value })}
                placeholder="App-UUID (z. B. 8f5c1a4b-…)"
                className="flex-[2] rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 font-mono text-xs text-slate-100"
              />
              <input
                type="text"
                value={row.label}
                onChange={(e) => update(idx, { label: e.target.value })}
                placeholder="Label (z. B. API, Web)"
                className="flex-1 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-slate-100"
              />
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => move(idx, -1)}
                disabled={idx === 0}
                title="Nach oben"
                className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-300 transition hover:bg-white/10 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(idx, 1)}
                disabled={idx === rows.length - 1}
                title="Nach unten"
                className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-300 transition hover:bg-white/10 disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => remove(idx)}
                title="Zeile entfernen"
                className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-200 transition hover:bg-red-500/20"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={add}
          className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-4 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
        >
          Zeile hinzufügen
        </button>
        <button type="submit" className="btn btn-sm" disabled={saving || !dirty}>
          {saving ? "Speichere…" : "Speichern"}
        </button>
        {hasStored && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-full border border-red-500/40 bg-red-500/10 px-4 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
          >
            {deleting ? "…" : "Liste löschen"}
          </button>
        )}
      </div>

      {hasStored && current && (
        <p className="text-[11px] text-slate-500">
          <code className="font-mono text-slate-400">{CURATED_DO_APPS_KEY}</code> · {storedCount}{" "}
          {storedCount === 1 ? "Eintrag" : "Einträge"} · zuletzt aktualisiert{" "}
          {new Date(current.updatedAt).toLocaleString("de-DE")}
        </p>
      )}
    </form>
  );
}

/**
 * Coerce the stored setting value back into a list of `{id, label}` rows.
 * The API returns the raw JSON we wrote, but older writes or manual
 * edits via the Advanced block can leave any shape there — we accept
 * malformed entries and drop them rather than crashing the form.
 */
function parseAppsSetting(value: unknown): ConfiguredAppInput[] {
  if (!Array.isArray(value)) return [];
  const out: ConfiguredAppInput[] = [];
  for (const entry of value) {
    if (entry === null || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const id = typeof e.id === "string" ? e.id : "";
    const label = typeof e.label === "string" ? e.label : "";
    if (id === "" && label === "") continue;
    out.push({ id, label });
  }
  return out;
}

interface CuratedSettingRowProps {
  curated: CuratedSetting;
  current: AppSetting | null;
  onReload: () => Promise<void>;
  onError: (msg: string | null) => void;
  onInfo: (msg: string) => void;
}

function CuratedSettingRow({ curated, current, onReload, onError, onInfo }: CuratedSettingRowProps) {
  const currentValue = stringifyValueForInput(current?.value);
  const [value, setValue] = React.useState(currentValue);
  const [saving, setSaving] = React.useState(false);
  const [busyDelete, setBusyDelete] = React.useState(false);

  // Sync local edit buffer when the reload brings in a changed value.
  React.useEffect(() => {
    setValue(currentValue);
  }, [currentValue]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    onError(null);
    try {
      const coerced = curated.kind === "number" ? parseCoercedNumber(value) : value;
      await upsertAppSetting(curated.key, coerced, curated.description);
      await onReload();
      onInfo(`${curated.label} gespeichert.`);
    } catch (err: unknown) {
      console.error(err);
      onError(err instanceof ApiError ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const ok = globalThis.confirm(`Wert "${curated.label}" wirklich entfernen?`);
    if (!ok) return;
    setBusyDelete(true);
    onError(null);
    try {
      await deleteAppSetting(curated.key);
      await onReload();
      onInfo(`${curated.label} gelöscht.`);
    } catch (err: unknown) {
      console.error(err);
      onError(err instanceof ApiError ? err.message : "Löschen fehlgeschlagen.");
    } finally {
      setBusyDelete(false);
    }
  }

  const hasStored = current !== null;

  return (
    <form onSubmit={handleSave} className="space-y-2">
      <label htmlFor={`curated-${curated.key}`} className="block text-xs font-medium uppercase tracking-wider text-slate-400">
        {curated.label}
      </label>
      <p className="text-xs text-slate-500">{curated.description}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={`curated-${curated.key}`}
          type={curated.kind === "number" ? "number" : "text"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={curated.placeholder}
          className="flex-1 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
        />
        <div className="flex gap-2">
          <button type="submit" className="btn btn-sm" disabled={saving}>
            {saving ? "Speichere…" : "Speichern"}
          </button>
          {hasStored && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={busyDelete}
              className="rounded-full border border-red-500/40 bg-red-500/10 px-4 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
            >
              {busyDelete ? "…" : "Löschen"}
            </button>
          )}
        </div>
      </div>
      {current && (
        <p className="text-[11px] text-slate-500">
          <code className="font-mono text-slate-400">{curated.key}</code> · zuletzt aktualisiert{" "}
          {new Date(current.updatedAt).toLocaleString("de-DE")}
        </p>
      )}
    </form>
  );
}

interface CuratedSecretRowProps {
  curated: { key: string; label: string; description: string };
  current: AppSecretMeta | null;
  onReload: () => Promise<void>;
  onError: (msg: string | null) => void;
  onInfo: (msg: string) => void;
}

function CuratedSecretRow({ curated, current, onReload, onError, onInfo }: CuratedSecretRowProps) {
  const [plaintext, setPlaintext] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [busyDelete, setBusyDelete] = React.useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (plaintext.length === 0) return;
    setSaving(true);
    onError(null);
    try {
      await writeAppSecret(curated.key, plaintext, curated.description);
      await onReload();
      setPlaintext("");
      onInfo(`${curated.label} aktualisiert.`);
    } catch (err: unknown) {
      console.error(err);
      onError(err instanceof ApiError ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const ok = globalThis.confirm(`Secret "${curated.label}" wirklich entfernen?`);
    if (!ok) return;
    setBusyDelete(true);
    onError(null);
    try {
      await deleteAppSecret(curated.key);
      await onReload();
      onInfo(`${curated.label} gelöscht.`);
    } catch (err: unknown) {
      console.error(err);
      onError(err instanceof ApiError ? err.message : "Löschen fehlgeschlagen.");
    } finally {
      setBusyDelete(false);
    }
  }

  const hasStored = current !== null;

  return (
    <form onSubmit={handleSave} className="space-y-2">
      <label htmlFor={`secret-${curated.key}`} className="block text-xs font-medium uppercase tracking-wider text-slate-400">
        {curated.label}{" "}
        <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-200">
          verschlüsselt
        </span>
      </label>
      <p className="text-xs text-slate-500">{curated.description}</p>

      {hasStored && current && (
        <p className="rounded-lg border border-white/5 bg-slate-950/40 px-3 py-2 text-xs text-slate-400">
          Gespeichert: <code className="font-mono text-slate-200">{current.preview ?? "—"}</code> ·
          aktualisiert {new Date(current.updatedAt).toLocaleString("de-DE")}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={`secret-${curated.key}`}
          type="password"
          value={plaintext}
          onChange={(e) => setPlaintext(e.target.value)}
          placeholder={hasStored ? "Neuen Wert eingeben, um zu rotieren…" : "Wert eingeben…"}
          className="flex-1 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
          autoComplete="new-password"
        />
        <div className="flex gap-2">
          <button type="submit" className="btn btn-sm" disabled={saving || plaintext.length === 0}>
            {saving ? "Speichere…" : hasStored ? "Rotieren" : "Speichern"}
          </button>
          {hasStored && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={busyDelete}
              className="rounded-full border border-red-500/40 bg-red-500/10 px-4 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
            >
              {busyDelete ? "…" : "Löschen"}
            </button>
          )}
        </div>
      </div>
      <p className="text-[11px] text-slate-500">
        <code className="font-mono text-slate-400">{curated.key}</code>
      </p>
    </form>
  );
}

// ─── Advanced raw list block ────────────────────────────────────────────────

function AdvancedSection({ settings, secrets, onReload, onError, onInfo }: SectionProps) {
  const [showAll, setShowAll] = React.useState(false);
  const extraSettings = settings.filter((s) => !CURATED_SETTING_KEYS.has(s.key));
  const extraSecrets = secrets.filter((s) => !CURATED_SECRET_KEYS.has(s.key));

  // Always expose the "create new" form so new keys can be added without a
  // code change. The existing-row lists only appear when there actually
  // *are* additional rows — or when the user explicitly unfolds the block.
  const hasAdditional = extraSettings.length > 0 || extraSecrets.length > 0;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-50">Erweitert</h2>
          <p className="mt-1 text-xs text-slate-400">
            Beliebige Keys für künftige Features. Keys müssen dem Muster{" "}
            <code className="font-mono">kleinbuchstaben.mit.punkten</code> folgen.
          </p>
        </div>
        {!showAll && (
          <button type="button" className="btn-outline btn-sm" onClick={() => setShowAll(true)}>
            {hasAdditional ? "Anzeigen" : "Neu anlegen"}
          </button>
        )}
      </header>

      {showAll && (
        <div className="mt-6 space-y-8">
          <AdvancedSettingsList
            rows={extraSettings}
            onReload={onReload}
            onError={onError}
            onInfo={onInfo}
          />
          <AdvancedSecretsList
            rows={extraSecrets}
            onReload={onReload}
            onError={onError}
            onInfo={onInfo}
          />
        </div>
      )}
    </section>
  );
}

interface AdvancedSettingsListProps {
  rows: AppSetting[];
  onReload: () => Promise<void>;
  onError: (msg: string | null) => void;
  onInfo: (msg: string) => void;
}

function AdvancedSettingsList({ rows, onReload, onError, onInfo }: AdvancedSettingsListProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
        Weitere Einstellungen
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        JSON-Werte erlaubt (Arrays/Objekte werden automatisch als JSON interpretiert).
      </p>

      <div className="mt-4 space-y-3">
        {rows.length === 0 && (
          <p className="text-xs text-slate-500">Keine weiteren Einstellungen gesetzt.</p>
        )}
        {rows.map((row) => (
          <AdvancedSettingRow
            key={row.key}
            row={row}
            onReload={onReload}
            onError={onError}
            onInfo={onInfo}
          />
        ))}
      </div>

      <AdvancedSettingCreate
        onReload={onReload}
        onError={onError}
        onInfo={onInfo}
      />
    </div>
  );
}

interface AdvancedSettingRowProps {
  row: AppSetting;
  onReload: () => Promise<void>;
  onError: (msg: string | null) => void;
  onInfo: (msg: string) => void;
}

function AdvancedSettingRow({ row, onReload, onError, onInfo }: AdvancedSettingRowProps) {
  const [value, setValue] = React.useState(stringifyValueForInput(row.value));
  const [description, setDescription] = React.useState(row.description ?? "");
  const [saving, setSaving] = React.useState(false);
  const [busyDelete, setBusyDelete] = React.useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    onError(null);
    try {
      const parsed = parseSettingValue(value);
      await upsertAppSetting(row.key, parsed, description.trim() === "" ? null : description);
      await onReload();
      onInfo(`${row.key} gespeichert.`);
    } catch (err: unknown) {
      console.error(err);
      onError(err instanceof ApiError ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const ok = globalThis.confirm(`Einstellung "${row.key}" wirklich löschen?`);
    if (!ok) return;
    setBusyDelete(true);
    onError(null);
    try {
      await deleteAppSetting(row.key);
      await onReload();
      onInfo(`${row.key} gelöscht.`);
    } catch (err: unknown) {
      console.error(err);
      onError(err instanceof ApiError ? err.message : "Löschen fehlgeschlagen.");
    } finally {
      setBusyDelete(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="rounded-xl border border-white/5 bg-slate-950/40 p-4">
      <div className="flex items-start justify-between gap-4">
        <code className="text-xs font-mono text-cyan-300">{row.key}</code>
        <span className="text-[11px] text-slate-500">
          {new Date(row.updatedAt).toLocaleString("de-DE")}
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <label className="text-[11px] uppercase tracking-wider text-slate-500">Wert</label>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={2}
            className="mt-1 block w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 font-mono text-xs text-slate-100"
          />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider text-slate-500">Beschreibung</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1 block w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-slate-100"
          />
        </div>
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <button type="submit" className="btn btn-sm" disabled={saving}>
          {saving ? "Speichere…" : "Speichern"}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={busyDelete}
          className="rounded-full border border-red-500/40 bg-red-500/10 px-4 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
        >
          {busyDelete ? "Lösche…" : "Löschen"}
        </button>
      </div>
    </form>
  );
}

interface AdvancedCreateProps {
  onReload: () => Promise<void>;
  onError: (msg: string | null) => void;
  onInfo: (msg: string) => void;
}

function AdvancedSettingCreate({ onReload, onError, onInfo }: AdvancedCreateProps) {
  const [key, setKey] = React.useState("");
  const [value, setValue] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (key.trim() === "") return;
    setSaving(true);
    onError(null);
    try {
      const parsed = parseSettingValue(value);
      await upsertAppSetting(key.trim(), parsed, description.trim() === "" ? null : description);
      await onReload();
      onInfo(`${key.trim()} angelegt.`);
      setKey("");
      setValue("");
      setDescription("");
    } catch (err: unknown) {
      console.error(err);
      onError(err instanceof ApiError ? err.message : "Anlegen fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 rounded-xl border border-dashed border-white/10 bg-slate-950/30 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Neue Einstellung</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <input
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="beispiel.key"
          className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 font-mono text-xs text-slate-100"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder='Wert (String oder JSON, z.B. ["a","b"])'
          className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 font-mono text-xs text-slate-100"
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Beschreibung (optional)"
          className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-slate-100"
        />
      </div>
      <div className="mt-3 flex justify-end">
        <button type="submit" className="btn btn-sm" disabled={saving || key.trim() === ""}>
          {saving ? "Lege an…" : "Anlegen"}
        </button>
      </div>
    </form>
  );
}

interface AdvancedSecretsListProps {
  rows: AppSecretMeta[];
  onReload: () => Promise<void>;
  onError: (msg: string | null) => void;
  onInfo: (msg: string) => void;
}

function AdvancedSecretsList({ rows, onReload, onError, onInfo }: AdvancedSecretsListProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
        Weitere Secrets
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        Werden AES-256-GCM-verschlüsselt gespeichert. Klartext wird nie zurückgegeben.
      </p>

      <div className="mt-4 space-y-3">
        {rows.length === 0 && (
          <p className="text-xs text-slate-500">Keine weiteren Secrets gesetzt.</p>
        )}
        {rows.map((row) => (
          <AdvancedSecretRow
            key={row.key}
            row={row}
            onReload={onReload}
            onError={onError}
            onInfo={onInfo}
          />
        ))}
      </div>

      <AdvancedSecretCreate
        onReload={onReload}
        onError={onError}
        onInfo={onInfo}
      />
    </div>
  );
}

interface AdvancedSecretRowProps {
  row: AppSecretMeta;
  onReload: () => Promise<void>;
  onError: (msg: string | null) => void;
  onInfo: (msg: string) => void;
}

function AdvancedSecretRow({ row, onReload, onError, onInfo }: AdvancedSecretRowProps) {
  const [plaintext, setPlaintext] = React.useState("");
  const [description, setDescription] = React.useState(row.description ?? "");
  const [saving, setSaving] = React.useState(false);
  const [busyDelete, setBusyDelete] = React.useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (plaintext.length === 0) return;
    setSaving(true);
    onError(null);
    try {
      await writeAppSecret(row.key, plaintext, description.trim() === "" ? null : description);
      await onReload();
      setPlaintext("");
      onInfo(`${row.key} rotiert.`);
    } catch (err: unknown) {
      console.error(err);
      onError(err instanceof ApiError ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const ok = globalThis.confirm(`Secret "${row.key}" wirklich löschen?`);
    if (!ok) return;
    setBusyDelete(true);
    onError(null);
    try {
      await deleteAppSecret(row.key);
      await onReload();
      onInfo(`${row.key} gelöscht.`);
    } catch (err: unknown) {
      console.error(err);
      onError(err instanceof ApiError ? err.message : "Löschen fehlgeschlagen.");
    } finally {
      setBusyDelete(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="rounded-xl border border-white/5 bg-slate-950/40 p-4">
      <div className="flex items-start justify-between gap-4">
        <code className="text-xs font-mono text-amber-300">{row.key}</code>
        <span className="text-[11px] text-slate-500">
          {new Date(row.updatedAt).toLocaleString("de-DE")}
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Gespeichert: <code className="font-mono text-slate-200">{row.preview ?? "—"}</code>
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <label className="text-[11px] uppercase tracking-wider text-slate-500">Neuer Wert</label>
          <input
            type="password"
            value={plaintext}
            onChange={(e) => setPlaintext(e.target.value)}
            placeholder="Zum Rotieren neuen Wert eingeben…"
            className="mt-1 block w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-slate-100"
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider text-slate-500">Beschreibung</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-slate-100"
          />
        </div>
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <button type="submit" className="btn btn-sm" disabled={saving || plaintext.length === 0}>
          {saving ? "Speichere…" : "Rotieren"}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={busyDelete}
          className="rounded-full border border-red-500/40 bg-red-500/10 px-4 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
        >
          {busyDelete ? "Lösche…" : "Löschen"}
        </button>
      </div>
    </form>
  );
}

function AdvancedSecretCreate({ onReload, onError, onInfo }: AdvancedCreateProps) {
  const [key, setKey] = React.useState("");
  const [plaintext, setPlaintext] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (key.trim() === "" || plaintext.length === 0) return;
    setSaving(true);
    onError(null);
    try {
      await writeAppSecret(key.trim(), plaintext, description.trim() === "" ? null : description);
      await onReload();
      onInfo(`${key.trim()} angelegt.`);
      setKey("");
      setPlaintext("");
      setDescription("");
    } catch (err: unknown) {
      console.error(err);
      onError(err instanceof ApiError ? err.message : "Anlegen fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 rounded-xl border border-dashed border-white/10 bg-slate-950/30 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Neues Secret</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <input
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="beispiel.key"
          className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 font-mono text-xs text-slate-100"
        />
        <input
          type="password"
          value={plaintext}
          onChange={(e) => setPlaintext(e.target.value)}
          placeholder="Klartext-Wert"
          className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-slate-100"
          autoComplete="new-password"
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Beschreibung (optional)"
          className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-slate-100"
        />
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          className="btn btn-sm"
          disabled={saving || key.trim() === "" || plaintext.length === 0}
        >
          {saving ? "Lege an…" : "Anlegen"}
        </button>
      </div>
    </form>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Render a server-returned JSON value into the string form the raw textarea /
 * curated input expects. Strings stay as-is (no JSON quoting shown to the
 * user); everything else is pretty-printed JSON.
 */
function stringifyValueForInput(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Parse the textarea string back into a JSON-serialisable value for the API.
 * Empty input becomes `null`. Anything that parses as JSON is stored as JSON
 * (so the user can set arrays/objects); everything else is stored as a raw
 * string. This mirrors the stringify helper above.
 */
function parseSettingValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return raw;
  }
}

/**
 * Coerce the curated "number" input into an actual number before sending.
 * Empty / invalid input falls back to `null` so the server can store
 * "unset" instead of NaN.
 */
function parseCoercedNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}
