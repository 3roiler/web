import * as React from "react";
import {
  listAdminUsers,
  listGrantablePermissions,
  grantPermission,
  revokePermission,
  updateAdminUser,
  deleteAdminUser,
  ApiError,
  type AdminUser,
  type PermissionDefinition,
  type User
} from "../services";
import { AdminLayout } from "../components/AdminLayout";

/**
 * Admin UI for managing users: editing display name/email, revoking directly
 * granted permissions, and deleting accounts. `admin.manage` is enforced both
 * client-side (via AdminLayout) and server-side (on every /admin/* route).
 */
export function AdminUsersPage() {
  return (
    <AdminLayout
      kicker="Admin · Nutzer"
      title="Benutzerverwaltung"
      description={
        <>
          Direkt erteilte Berechtigungen kannst du entziehen. Gruppen-Berechtigungen
          sind grau und werden über die Gruppenzugehörigkeit verwaltet.
        </>
      }
    >
      {({ me }) => <UsersContent me={me} />}
    </AdminLayout>
  );
}

function UsersContent({ me }: { me: User }) {
  const [users, setUsers] = React.useState<AdminUser[] | null>(null);
  const [permissions, setPermissions] = React.useState<PermissionDefinition[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<AdminUser | null>(null);

  const reload = React.useCallback(async () => {
    try {
      const [userList, permList] = await Promise.all([
        listAdminUsers(),
        listGrantablePermissions()
      ]);
      setUsers(userList);
      setPermissions(permList);
      setError(null);
    } catch (e: unknown) {
      console.error(e);
      setError("Beim Laden der Daten ist ein Fehler aufgetreten.");
    }
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  async function handleGrant(userId: string, permission: string) {
    const key = `grant:${userId}:${permission}`;
    setBusyKey(key);
    try {
      await grantPermission(userId, permission);
      await reload();
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof ApiError ? e.message : "Erteilen fehlgeschlagen.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRevoke(userId: string, permission: string) {
    const ok = globalThis.confirm(`Berechtigung "${permission}" wirklich entziehen?`);
    if (!ok) return;
    const key = `revoke:${userId}:${permission}`;
    setBusyKey(key);
    try {
      await revokePermission(userId, permission);
      await reload();
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof ApiError ? e.message : "Entziehen fehlgeschlagen.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDelete(user: AdminUser) {
    const label = user.displayName || user.name;
    const ok = globalThis.confirm(
      `Nutzer "${label}" wirklich löschen? Diese Aktion lässt sich nicht rückgängig machen.`
    );
    if (!ok) return;
    const key = `delete:${user.id}`;
    setBusyKey(key);
    try {
      await deleteAdminUser(user.id);
      await reload();
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof ApiError ? e.message : "Löschen fehlgeschlagen.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-300">{error}</p>}
      {!error && users === null && <p className="text-sm text-slate-400">Lade…</p>}
      {!error && users !== null && users.length === 0 && (
        <p className="text-sm text-slate-400">Noch keine Nutzer.</p>
      )}
      {users?.map((u) => (
        <UserRow
          key={u.id}
          user={u}
          me={me}
          permissions={permissions ?? []}
          busyKey={busyKey}
          onGrant={handleGrant}
          onRevoke={handleRevoke}
          onEdit={setEditing}
          onDelete={handleDelete}
        />
      ))}

      {editing && (
        <EditUserDialog
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await reload();
          }}
        />
      )}
    </div>
  );
}

interface UserRowProps {
  user: AdminUser;
  me: User;
  permissions: PermissionDefinition[];
  busyKey: string | null;
  onGrant: (userId: string, permission: string) => Promise<void>;
  onRevoke: (userId: string, permission: string) => Promise<void>;
  onEdit: (user: AdminUser) => void;
  onDelete: (user: AdminUser) => Promise<void>;
}

function UserRow({ user, me, permissions, busyKey, onGrant, onRevoke, onEdit, onDelete }: UserRowProps) {
  const [pickerValue, setPickerValue] = React.useState<string>("");
  const direct = new Set(user.directPermissions);
  const grantable = permissions.filter((p) => !user.permissions.includes(p.key));
  const isSelf = me.id === user.id;
  const busyDelete = busyKey === `delete:${user.id}`;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="truncate">{user.email ?? "— keine Email —"}</span>
            {isSelf && (
              <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-cyan-300">
                Du
              </span>
            )}
          </div>
          <h2 className="mt-1 truncate text-lg font-semibold text-slate-50">
            {user.displayName || user.name}
          </h2>
          <p className="text-xs text-slate-500">@{user.name}</p>
        </div>
        <div className="flex flex-shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onEdit(user)}
            className="btn-outline btn-sm"
          >
            Bearbeiten
          </button>
          <button
            type="button"
            onClick={() => onDelete(user)}
            disabled={isSelf || busyDelete}
            className="rounded-full border border-red-500/40 bg-red-500/10 px-4 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            title={isSelf ? "Du kannst dich hier nicht selbst löschen." : undefined}
          >
            {busyDelete ? "Lösche…" : "Löschen"}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {user.permissions.length === 0 && (
          <span className="text-xs text-slate-500">Keine Berechtigungen.</span>
        )}
        {user.permissions.map((perm) => {
          const isDirect = direct.has(perm);
          const isSelfAdminGuard = isSelf && perm === "admin.manage";
          const busy = busyKey === `revoke:${user.id}:${perm}`;
          return (
            <span
              key={perm}
              className={
                isDirect
                  ? "inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200"
                  : "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400"
              }
              title={isDirect ? "Direkt erteilt" : "Über Gruppe erteilt"}
            >
              <code className="font-mono">{perm}</code>
              {isDirect && !isSelfAdminGuard && (
                <button
                  type="button"
                  onClick={() => onRevoke(user.id, perm)}
                  disabled={busy}
                  className="text-cyan-200 transition hover:text-red-300 disabled:opacity-50"
                  aria-label={`Berechtigung ${perm} entziehen`}
                >
                  {busy ? "…" : "×"}
                </button>
              )}
              {isSelfAdminGuard && (
                <span className="text-[10px] text-slate-500" title="Du kannst dir admin.manage nicht selbst entziehen.">
                  🔒
                </span>
              )}
            </span>
          );
        })}
      </div>

      {grantable.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select
            value={pickerValue}
            onChange={(e) => setPickerValue(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-200"
            aria-label="Berechtigung auswählen"
          >
            <option value="">Berechtigung wählen…</option>
            {grantable.map((p) => (
              <option key={p.key} value={p.key}>
                {p.key} — {p.description}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!pickerValue || busyKey === `grant:${user.id}:${pickerValue}`}
            onClick={async () => {
              await onGrant(user.id, pickerValue);
              setPickerValue("");
            }}
            className="btn-outline btn-sm disabled:opacity-50"
          >
            {busyKey === `grant:${user.id}:${pickerValue}` ? "Erteile…" : "Erteilen"}
          </button>
        </div>
      )}
    </div>
  );
}

interface EditUserDialogProps {
  user: AdminUser;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

function EditUserDialog({ user, onClose, onSaved }: EditUserDialogProps) {
  const [displayName, setDisplayName] = React.useState(user.displayName ?? "");
  const [email, setEmail] = React.useState(user.email ?? "");
  const [name, setName] = React.useState(user.name);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateAdminUser(user.id, {
        name: name.trim(),
        displayName: displayName.trim() === "" ? null : displayName.trim(),
        email: email.trim() === "" ? null : email.trim()
      });
      await onSaved();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-xl"
      >
        <h3 className="text-lg font-semibold text-slate-50">Nutzer bearbeiten</h3>
        <p className="mt-1 text-xs text-slate-500">ID: {user.id}</p>

        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="edit-name" className="block text-xs font-medium uppercase tracking-wider text-slate-400">
              Login-Name
            </label>
            <input
              id="edit-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="edit-display-name" className="block text-xs font-medium uppercase tracking-wider text-slate-400">
              Anzeigename
            </label>
            <input
              id="edit-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="edit-email" className="block text-xs font-medium uppercase tracking-wider text-slate-400">
              E-Mail
            </label>
            <input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
            />
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-300">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-outline btn-sm" disabled={saving}>
            Abbrechen
          </button>
          <button type="submit" className="btn btn-sm" disabled={saving}>
            {saving ? "Speichere…" : "Speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}
