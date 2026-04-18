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
    key: "digitalocean.app_id",
    label: "App-ID",
    description: "UUID der DigitalOcean App Platform App, von der Metriken gelesen werden.",
    kind: "text",
    placeholder: "z. B. 8f5c1a4b-…"
  },
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

const CURATED_DO_SECRETS: { key: string; label: string; description: string }[] = [
  {
    key: "digitalocean.token",
    label: "API-Token",
    description:
      "Persönlicher DigitalOcean API-Token mit Lese-Scope auf App Platform und Databases. Wird AES-256-GCM-verschlüsselt gespeichert."
  }
];

const CURATED_SETTING_KEYS = new Set(CURATED_DO_SETTINGS.map((s) => s.key));
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
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <header>
        <h2 className="text-lg font-semibold text-slate-50">DigitalOcean</h2>
        <p className="mt-1 text-xs text-slate-400">
          Zugangsdaten für App Platform und Managed-Postgres. Wird von der Metrics-Seite gelesen.
        </p>
      </header>

      <div className="mt-5 space-y-4">
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
