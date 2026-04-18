import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  listAdminUsers,
  listGrantablePermissions,
  grantPermission,
  revokePermission,
  getMe,
  ApiError,
  type AdminUser,
  type PermissionDefinition,
  type User
} from "../services";
import { Routes } from "../config/routes";

/**
 * Admin UI for granting/revoking user permissions. Gated on `admin.manage`
 * — the gate also runs server-side (every /admin/* route requires it), but
 * hiding the page for unprivileged users is a nicer UX than a raw 403.
 */
export function AdminUsersPage() {
  const navigate = useNavigate();
  const [me, setMe] = React.useState<User | null | undefined>(undefined);
  const [users, setUsers] = React.useState<AdminUser[] | null>(null);
  const [permissions, setPermissions] = React.useState<PermissionDefinition[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);

  const isAdmin = Boolean(me?.permissions?.includes("admin.manage"));

  React.useEffect(() => {
    getMe()
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

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
    if (!isAdmin) return;
    void reload();
  }, [isAdmin, reload]);

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

  if (me === undefined) {
    return (
      <main className="min-h-screen bg-slate-950 py-24">
        <div className="mx-auto max-w-5xl px-6 sm:px-10 lg:px-16 pt-16 text-sm text-slate-400">
          Lade…
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-slate-950 py-24">
        <div className="mx-auto max-w-5xl px-6 sm:px-10 lg:px-16 pt-16">
          <p className="text-sm text-red-300">
            Kein Zugriff. Dir fehlt die Berechtigung <code>admin.manage</code>.
          </p>
          <button
            type="button"
            onClick={() => navigate(Routes.Home)}
            className="btn-outline mt-8 inline-block"
          >
            Zur Startseite
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 py-24" id="top">
      <div className="mx-auto max-w-5xl px-6 sm:px-10 lg:px-16 pt-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">
              Admin · Nutzer
            </p>
            <h1 className="mt-4 text-4xl font-semibold text-slate-50 sm:text-5xl">
              Berechtigungen verwalten
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-400">
              Direkt erteilte Berechtigungen kannst du entziehen. Gruppen-Berechtigungen
              sind grau und werden über die Gruppenzugehörigkeit verwaltet.
            </p>
          </div>
        </div>

        <div className="mt-12 space-y-4">
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
            />
          ))}
        </div>
      </div>
    </main>
  );
}

interface UserRowProps {
  user: AdminUser;
  me: User | null;
  permissions: PermissionDefinition[];
  busyKey: string | null;
  onGrant: (userId: string, permission: string) => Promise<void>;
  onRevoke: (userId: string, permission: string) => Promise<void>;
}

function UserRow({ user, me, permissions, busyKey, onGrant, onRevoke }: UserRowProps) {
  const [pickerValue, setPickerValue] = React.useState<string>("");
  const direct = new Set(user.directPermissions);
  const grantable = permissions.filter((p) => !user.permissions.includes(p.key));
  const isSelf = me?.id === user.id;

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
