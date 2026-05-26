import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getAdminGroup,
  updateAdminGroup,
  deleteAdminGroup,
  addGroupMember,
  removeGroupMember,
  grantGroupPermission,
  revokeGroupPermission,
  searchUsers,
  listGrantablePermissions,
  ApiError,
  type AdminGroupDetail as AdminGroupDetailType,
  type UserSummary,
  type PermissionDefinition
} from "../services";
import { DashboardLayout } from "../components/DashboardLayout";
import { Routes } from "../config/routes";

const GROUP_KEY_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

/**
 * Detail page for a single group. Handles:
 *   - inline rename (key + displayName),
 *   - member list with add/remove,
 *   - permission chips with grant/revoke.
 *
 * We reload the full detail after each mutation instead of trying to patch
 * state locally — the derived counts (memberCount, inherited permissions)
 * would otherwise drift. One extra round-trip is cheap.
 */
export function AdminGroupDetailPage() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <DashboardLayout
        requiredPermission="dashboard.groups"
        kicker="Dashboard · Gruppen"
        title="Gruppe nicht gefunden"
      >
        {() => <p className="text-sm text-red-300">Keine Gruppen-ID angegeben.</p>}
      </DashboardLayout>
    );
  }

  return <LoadedGroupDetail id={id} />;
}

function LoadedGroupDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const [group, setGroup] = React.useState<AdminGroupDetailType | null | undefined>(undefined);
  const [permCatalog, setPermCatalog] = React.useState<PermissionDefinition[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    try {
      const [detail, perms] = await Promise.all([
        getAdminGroup(id),
        listGrantablePermissions()
      ]);
      setGroup(detail);
      setPermCatalog(perms);
      setError(null);
    } catch (e: unknown) {
      console.error(e);
      if (e instanceof ApiError && e.status === 404) {
        setGroup(null);
      } else {
        setError("Beim Laden der Gruppe ist ein Fehler aufgetreten.");
      }
    }
  }, [id]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <DashboardLayout
      requiredPermission="dashboard.groups"
      kicker="Dashboard · Gruppen"
      title={group?.displayName ?? "Gruppe"}
      description={
        <>
          <Link to={Routes.Dashboard.Groups} className="text-cyan-300 hover:text-cyan-200">
            ← Zurück zur Gruppenliste
          </Link>
        </>
      }
      actions={
        group ? (
          <button
            type="button"
            onClick={async () => {
              const ok = globalThis.confirm(
                `Gruppe "${group.displayName}" wirklich löschen?`
              );
              if (!ok) return;
              try {
                await deleteAdminGroup(group.id);
                navigate(Routes.Dashboard.Groups);
              } catch (e: unknown) {
                console.error(e);
                setError(e instanceof ApiError ? e.message : "Löschen fehlgeschlagen.");
              }
            }}
            className="rounded-full border border-red-500/40 bg-red-500/10 px-4 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-red-500/20"
          >
            Gruppe löschen
          </button>
        ) : undefined
      }
    >
      {() => {
        if (group === undefined) return <p className="text-sm text-slate-400">Lade…</p>;
        if (group === null) return <p className="text-sm text-red-300">Gruppe nicht gefunden.</p>;
        if (error) return <p className="text-sm text-red-300">{error}</p>;
        return (
          <GroupDetailBody
            group={group}
            permCatalog={permCatalog}
            onChanged={reload}
            setError={setError}
          />
        );
      }}
    </DashboardLayout>
  );
}

interface GroupDetailBodyProps {
  group: AdminGroupDetailType;
  permCatalog: PermissionDefinition[];
  onChanged: () => Promise<void>;
  setError: (msg: string | null) => void;
}

function GroupDetailBody({ group, permCatalog, onChanged, setError }: GroupDetailBodyProps) {
  const [key, setKey] = React.useState(group.key);
  const [displayName, setDisplayName] = React.useState(group.displayName);
  const [savingMeta, setSavingMeta] = React.useState(false);
  const [memberQuery, setMemberQuery] = React.useState("");
  const [memberResults, setMemberResults] = React.useState<UserSummary[]>([]);
  const [searchingMembers, setSearchingMembers] = React.useState(false);
  const [addingMember, setAddingMember] = React.useState(false);
  const [permPicker, setPermPicker] = React.useState("");
  const [busyPerm, setBusyPerm] = React.useState<string | null>(null);
  const [busyMember, setBusyMember] = React.useState<string | null>(null);

  React.useEffect(() => {
    setKey(group.key);
    setDisplayName(group.displayName);
  }, [group.id, group.key, group.displayName]);

  // Entprellte Mitgliedersuche über die API; aktuelle Mitglieder ausblenden.
  React.useEffect(() => {
    const q = memberQuery.trim();
    if (q.length < 2) {
      setMemberResults([]);
      setSearchingMembers(false);
      return;
    }
    setSearchingMembers(true);
    const t = setTimeout(() => {
      searchUsers(q)
        .then((rows) => setMemberResults(rows.filter((u) => !memberIds.has(u.id))))
        .catch(() => setMemberResults([]))
        .finally(() => setSearchingMembers(false));
    }, 300);
    return () => clearTimeout(t);
    // `memberIds` ist absichtlich nicht in den Deps — es wird unten aus
    // `group.members` abgeleitet, das schon in den Deps steht. Die
    // exhaustive-deps-Regel sieht das nicht.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberQuery, group.members]);

  const memberIds = new Set(group.members.map((m) => m.id));
  const grantable = permCatalog.filter((p) => !group.permissions.includes(p.key));

  const keyValid = GROUP_KEY_RE.test(key);
  const metaDirty = key !== group.key || displayName.trim() !== group.displayName;

  async function handleSaveMeta(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!keyValid) {
      setError("Der Key muss 3–40 Zeichen lang sein (a–z, 0–9, Bindestrich, nicht am Rand).");
      return;
    }
    if (displayName.trim().length === 0) {
      setError("Bitte einen Anzeigenamen angeben.");
      return;
    }
    setSavingMeta(true);
    setError(null);
    try {
      await updateAdminGroup(group.id, {
        key: key === group.key ? undefined : key,
        displayName: displayName.trim() === group.displayName ? undefined : displayName.trim()
      });
      await onChanged();
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof ApiError ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setSavingMeta(false);
    }
  }

  async function handleAddMember(userId: string) {
    setAddingMember(true);
    setError(null);
    try {
      await addGroupMember(group.id, userId);
      setMemberQuery("");
      setMemberResults([]);
      await onChanged();
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof ApiError ? e.message : "Hinzufügen fehlgeschlagen.");
    } finally {
      setAddingMember(false);
    }
  }

  async function handleRemoveMember(userId: string, label: string) {
    const ok = globalThis.confirm(`"${label}" aus der Gruppe entfernen?`);
    if (!ok) return;
    setBusyMember(userId);
    setError(null);
    try {
      await removeGroupMember(group.id, userId);
      await onChanged();
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof ApiError ? e.message : "Entfernen fehlgeschlagen.");
    } finally {
      setBusyMember(null);
    }
  }

  async function handleGrant() {
    if (!permPicker) return;
    setBusyPerm(`grant:${permPicker}`);
    setError(null);
    try {
      await grantGroupPermission(group.id, permPicker);
      setPermPicker("");
      await onChanged();
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof ApiError ? e.message : "Erteilen fehlgeschlagen.");
    } finally {
      setBusyPerm(null);
    }
  }

  async function handleRevoke(permission: string) {
    const ok = globalThis.confirm(`Berechtigung "${permission}" entziehen?`);
    if (!ok) return;
    setBusyPerm(`revoke:${permission}`);
    setError(null);
    try {
      await revokeGroupPermission(group.id, permission);
      await onChanged();
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof ApiError ? e.message : "Entziehen fehlgeschlagen.");
    } finally {
      setBusyPerm(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* Metadaten */}
      <form
        onSubmit={handleSaveMeta}
        className="rounded-2xl border border-white/10 bg-white/5 p-5"
      >
        <h3 className="text-sm font-semibold text-slate-100">Stammdaten</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="group-key" className="block text-xs font-medium uppercase tracking-wider text-slate-400">
              Key
            </label>
            <input
              id="group-key"
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value.toLowerCase())}
              className="mt-1 block w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 font-mono text-sm text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="group-display-name" className="block text-xs font-medium uppercase tracking-wider text-slate-400">
              Anzeigename
            </label>
            <input
              id="group-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            className="btn btn-sm disabled:opacity-40"
            disabled={!metaDirty || savingMeta}
          >
            {savingMeta ? "Speichere…" : "Speichern"}
          </button>
        </div>
      </form>

      {/* Berechtigungen */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h3 className="text-sm font-semibold text-slate-100">Berechtigungen</h3>
        <div className="mt-4 flex flex-wrap gap-2">
          {group.permissions.length === 0 && (
            <span className="text-xs text-slate-500">Keine Berechtigungen.</span>
          )}
          {group.permissions.map((perm) => {
            const busy = busyPerm === `revoke:${perm}`;
            return (
              <span
                key={perm}
                className="inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200"
              >
                <code className="font-mono">{perm}</code>
                <button
                  type="button"
                  onClick={() => handleRevoke(perm)}
                  disabled={busy}
                  className="text-cyan-200 transition hover:text-red-300 disabled:opacity-50"
                  aria-label={`Berechtigung ${perm} entziehen`}
                >
                  {busy ? "…" : "×"}
                </button>
              </span>
            );
          })}
        </div>

        {grantable.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <select
              value={permPicker}
              onChange={(e) => setPermPicker(e.target.value)}
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
              disabled={!permPicker || busyPerm === `grant:${permPicker}`}
              onClick={handleGrant}
              className="btn-outline btn-sm disabled:opacity-50"
            >
              {busyPerm === `grant:${permPicker}` ? "Erteile…" : "Erteilen"}
            </button>
          </div>
        )}
      </section>

      {/* Mitglieder */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-100">
            Mitglieder ({group.members.length})
          </h3>
        </div>

        {group.members.length === 0 ? (
          <p className="mt-4 text-xs text-slate-500">Noch keine Mitglieder.</p>
        ) : (
          <ul className="mt-4 divide-y divide-white/5">
            {group.members.map((m) => {
              const busy = busyMember === m.id;
              const label = m.displayName || m.name;
              return (
                <li key={m.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-slate-100">{label}</p>
                    <p className="truncate text-xs text-slate-500">
                      @{m.name}
                      {m.email ? ` · ${m.email}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(m.id, label)}
                    disabled={busy}
                    className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400 transition hover:border-red-500/40 hover:text-red-300 disabled:opacity-50"
                  >
                    {busy ? "…" : "Entfernen"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-4 space-y-2">
          <input
            type="search"
            value={memberQuery}
            onChange={(e) => setMemberQuery(e.target.value)}
            placeholder="Nutzer suchen, um sie hinzuzufügen…"
            aria-label="Nutzer suchen"
            className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500"
          />
          {searchingMembers && <p className="text-xs text-slate-500">Suche…</p>}
          {!searchingMembers && memberQuery.trim().length >= 2 && memberResults.length === 0 && (
            <p className="text-xs text-slate-500">Keine Treffer.</p>
          )}
          {memberResults.length > 0 && (
            <ul className="divide-y divide-white/5 rounded-lg border border-white/10">
              {memberResults.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-slate-100">{u.displayName || u.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      @{u.name}
                      {u.email ? ` · ${u.email}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddMember(u.id)}
                    disabled={addingMember}
                    className="btn-outline btn-sm disabled:opacity-50"
                  >
                    {addingMember ? "…" : "Hinzufügen"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
