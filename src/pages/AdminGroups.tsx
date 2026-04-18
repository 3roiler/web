import * as React from "react";
import { Link } from "react-router-dom";
import {
  listAdminGroups,
  createAdminGroup,
  deleteAdminGroup,
  ApiError,
  type AdminGroup
} from "../services";
import { AdminLayout } from "../components/AdminLayout";
import { Routes } from "../config/routes";

/**
 * Group overview: list + "new group" form. The detail view (members +
 * permissions) lives on its own route so it can link-in/share URLs.
 *
 * Keys follow the server-side regex `^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$`
 * — we mirror it here for instant feedback, but the API re-validates.
 */
const GROUP_KEY_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

export function AdminGroupsPage() {
  return (
    <AdminLayout
      kicker="Admin · Gruppen"
      title="Gruppenverwaltung"
      description={
        <>
          Gruppen bündeln Berechtigungen und Mitglieder. Änderungen an Gruppen-Berechtigungen
          wirken sofort auf alle Mitglieder.
        </>
      }
    >
      {() => <GroupsContent />}
    </AdminLayout>
  );
}

function GroupsContent() {
  const [groups, setGroups] = React.useState<AdminGroup[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [showForm, setShowForm] = React.useState(false);

  const reload = React.useCallback(async () => {
    try {
      const list = await listAdminGroups();
      setGroups(list);
      setError(null);
    } catch (e: unknown) {
      console.error(e);
      setError("Beim Laden der Gruppen ist ein Fehler aufgetreten.");
    }
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  async function handleDelete(group: AdminGroup) {
    const ok = globalThis.confirm(
      `Gruppe "${group.displayName}" wirklich löschen? Alle Mitgliedschaften und Berechtigungen gehen verloren.`
    );
    if (!ok) return;
    setBusyId(group.id);
    try {
      await deleteAdminGroup(group.id);
      await reload();
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof ApiError ? e.message : "Löschen fehlgeschlagen.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? "Abbrechen" : "Neue Gruppe"}
        </button>
      </div>

      {showForm && (
        <CreateGroupForm
          onCreated={async () => {
            setShowForm(false);
            await reload();
          }}
        />
      )}

      {error && <p className="text-sm text-red-300">{error}</p>}
      {!error && groups === null && <p className="text-sm text-slate-400">Lade…</p>}
      {!error && groups !== null && groups.length === 0 && (
        <p className="text-sm text-slate-400">Noch keine Gruppen angelegt.</p>
      )}

      <div className="space-y-3">
        {groups?.map((g) => (
          <div key={g.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-slate-50">
                  {g.displayName}
                </h2>
                <p className="text-xs text-slate-500">
                  <code className="font-mono">{g.key}</code> · {g.memberCount} {g.memberCount === 1 ? "Mitglied" : "Mitglieder"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  to={Routes.AdminGroupDetail.replace(":id", g.id)}
                  className="btn-outline btn-sm"
                >
                  Details
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(g)}
                  disabled={busyId === g.id}
                  className="rounded-full border border-red-500/40 bg-red-500/10 px-4 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-40"
                >
                  {busyId === g.id ? "Lösche…" : "Löschen"}
                </button>
              </div>
            </div>

            {g.permissions.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {g.permissions.map((perm) => (
                  <span
                    key={perm}
                    className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/5 px-3 py-1 text-xs text-cyan-200"
                  >
                    <code className="font-mono">{perm}</code>
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface CreateGroupFormProps {
  onCreated: () => void | Promise<void>;
}

function CreateGroupForm({ onCreated }: CreateGroupFormProps) {
  const [key, setKey] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const keyLooksValid = GROUP_KEY_RE.test(key);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!keyLooksValid) {
      setError("Der Key muss 3–40 Zeichen lang sein (a–z, 0–9, Bindestrich, nicht am Rand).");
      return;
    }
    if (displayName.trim().length === 0) {
      setError("Bitte einen Anzeigenamen angeben.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createAdminGroup({ key: key.trim(), displayName: displayName.trim() });
      setKey("");
      setDisplayName("");
      await onCreated();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Anlegen fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-white/10 bg-white/5 p-5"
    >
      <h3 className="text-sm font-semibold text-slate-100">Neue Gruppe</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="new-group-key" className="block text-xs font-medium uppercase tracking-wider text-slate-400">
            Key (URL-sicher)
          </label>
          <input
            id="new-group-key"
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value.toLowerCase())}
            placeholder="z. B. editors"
            required
            className="mt-1 block w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 font-mono text-sm text-slate-100"
          />
        </div>
        <div>
          <label htmlFor="new-group-display-name" className="block text-xs font-medium uppercase tracking-wider text-slate-400">
            Anzeigename
          </label>
          <input
            id="new-group-display-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="z. B. Redaktion"
            required
            className="mt-1 block w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
          />
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      <div className="mt-4 flex justify-end">
        <button type="submit" className="btn btn-sm" disabled={saving}>
          {saving ? "Lege an…" : "Gruppe anlegen"}
        </button>
      </div>
    </form>
  );
}
