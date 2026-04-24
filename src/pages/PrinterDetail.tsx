import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DashboardLayout } from "../components/DashboardLayout";
import { Routes } from "../config/routes";
import {
  getPrinter,
  updatePrinter,
  deletePrinter,
  rotatePrinterToken,
  listPrinterAccess,
  grantPrinterAccess,
  revokePrinterAccess,
  searchUsers,
  ApiError,
  type PrinterWithRole,
  type PrinterStatus,
  type PrinterRole,
  type PrinterAccessWithUser,
  type UserSummary
} from "../services";

const STATUS_BADGE: Record<PrinterStatus, { label: string; className: string }> = {
  offline: { label: "Offline", className: "bg-slate-500/20 text-slate-300" },
  online: { label: "Online", className: "bg-emerald-500/20 text-emerald-200" },
  error: { label: "Fehler", className: "bg-red-500/20 text-red-200" }
};

function formatLastSeen(iso: string | null): string {
  if (!iso) return "Noch nie verbunden";
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

export function PrinterDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <DashboardLayout
      requiredPermission="dashboard.printers"
      kicker="Dashboard · Drucker"
      title="Drucker-Details"
      description="Status, Agent-Token-Rotation und Löschen."
      actions={
        <>
          {id && (
            <Link
              to={Routes.Dashboard.PrinterJobs.replace(":id", id)}
              className="btn-outline"
            >
              Druckqueue
            </Link>
          )}
          <Link to={Routes.Dashboard.Printers} className="btn-outline">
            Zurück zur Liste
          </Link>
        </>
      }
    >
      {() => (id ? <PrinterDetailContent id={id} /> : <p className="text-sm text-red-300">Keine Drucker-ID.</p>)}
    </DashboardLayout>
  );
}

function PrinterDetailContent({ id }: { id: string }) {
  const navigate = useNavigate();
  const [printer, setPrinter] = React.useState<PrinterWithRole | null | undefined>(undefined);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [name, setName] = React.useState("");
  const [rotated, setRotated] = React.useState<string | null>(null);

  const reload = React.useCallback(() => {
    getPrinter(id)
      .then((p) => {
        setPrinter(p);
        setName(p.name);
      })
      .catch((e: unknown) => {
        console.error(e);
        if (e instanceof ApiError && e.status === 404) {
          setPrinter(null);
        } else {
          setError("Drucker konnte nicht geladen werden.");
        }
      });
  }, [id]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  if (error) {
    return <p className="text-sm text-red-300">{error}</p>;
  }
  if (printer === undefined) {
    return <p className="text-sm text-slate-400">Lade…</p>;
  }
  if (printer === null) {
    return <p className="text-sm text-slate-400">Drucker nicht gefunden.</p>;
  }

  const isOwner = printer.role === "owner";
  const status = STATUS_BADGE[printer.status];

  async function handleRename(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name darf nicht leer sein.");
      return;
    }
    setBusy(true);
    try {
      await updatePrinter(id, { name: trimmed });
      reload();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRotate() {
    const ok = globalThis.confirm(
      "Agent-Token rotieren? Der alte Token wird sofort ungültig; der Agent muss sich mit dem neuen Token reconnecten."
    );
    if (!ok) return;
    setBusy(true);
    try {
      const token = await rotatePrinterToken(id);
      setRotated(token);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Token-Rotation fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    const ok = globalThis.confirm(
      `"${printer?.name}" wirklich löschen? Alle Zugriffe und Jobs werden gelöscht.`
    );
    if (!ok) return;
    setBusy(true);
    try {
      await deletePrinter(id);
      navigate(Routes.Dashboard.Printers);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Löschen fehlgeschlagen.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full px-2 py-0.5 ${status.className}`}>
            {status.label}
          </span>
          <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-cyan-200">
            {printer.role}
          </span>
          {printer.canViewCamera && (
            <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-violet-200">
              Kamera
            </span>
          )}
        </div>
        <h2 className="text-xl font-semibold text-slate-50">{printer.name}</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm text-slate-400">
          <dt className="text-slate-500">Modell</dt>
          <dd>{printer.model}</dd>
          <dt className="text-slate-500">Agent</dt>
          <dd>{printer.agentVersion ?? "unbekannt"}</dd>
          <dt className="text-slate-500">Zuletzt</dt>
          <dd>{formatLastSeen(printer.lastSeenAt)}</dd>
          <dt className="text-slate-500">ID</dt>
          <dd className="font-mono text-xs">{printer.id}</dd>
        </dl>
      </section>

      {isOwner && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-100">Einstellungen</h3>
          <form onSubmit={handleRename} className="space-y-3">
            <label htmlFor="printer-detail-name" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Name
            </label>
            <input
              id="printer-detail-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              className="block w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
            />
            <button type="submit" className="btn-outline btn-sm" disabled={busy}>
              {busy ? "Speichere…" : "Speichern"}
            </button>
          </form>
        </section>
      )}

      {isOwner && <PrinterAccessSection printerId={id} />}

      {isOwner && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-100">Agent-Token</h3>
          <p className="text-xs text-slate-400">
            Rotiere den Token, wenn er kompromittiert sein könnte oder der
            Drucker-Host wechselt. Der alte Token wird sofort ungültig.
          </p>
          {rotated ? (
            <div className="space-y-2">
              <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-xs text-amber-200">
                Neuer Token — jetzt kopieren, wird nicht wieder angezeigt.
              </div>
              <code className="block break-all rounded-xl border border-white/10 bg-slate-950/60 p-3 font-mono text-xs text-slate-200">
                {rotated}
              </code>
              <button
                type="button"
                onClick={async () => {
                  try { await navigator.clipboard.writeText(rotated); } catch { /* noop */ }
                }}
                className="btn-outline btn-sm"
              >
                In Zwischenablage kopieren
              </button>
            </div>
          ) : (
            <button type="button" onClick={handleRotate} className="btn-outline btn-sm" disabled={busy}>
              Token rotieren
            </button>
          )}
        </section>
      )}

      {isOwner && (
        <section className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 space-y-3">
          <h3 className="text-sm font-semibold text-red-200">Gefahrenzone</h3>
          <p className="text-xs text-red-200/80">
            Löscht den Drucker, alle Zugriffs-Einträge und gekoppelten Jobs.
          </p>
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="rounded-full border border-red-500/40 bg-red-500/10 px-4 py-1.5 text-xs text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
          >
            {busy ? "Lösche…" : "Drucker löschen"}
          </button>
        </section>
      )}

      {error && <p className="text-sm text-red-300">{error}</p>}
    </div>
  );
}

// ─── Access Management ──────────────────────────────────────────────────────

const ROLE_LABELS: Record<PrinterRole, string> = {
  owner: "Owner",
  operator: "Operator",
  contributor: "Contributor",
  viewer: "Viewer"
};

const ROLE_HINTS: Record<Exclude<PrinterRole, 'owner'>, string> = {
  operator: "Kann genehmigen, starten, Queue verwalten.",
  contributor: "Kann eigene Druckanfragen stellen und editieren.",
  viewer: "Sieht nur den aktuell laufenden Job."
};

const SEARCH_DEBOUNCE_MS = 250;

interface AccessSectionProps {
  printerId: string;
}

/**
 * Owner-only block for granting/revoking access and toggling the
 * per-user flags (can_view_queue, can_view_camera). Uses the
 * search endpoint to invite users by handle rather than forcing
 * the owner to paste a UUID.
 */
function PrinterAccessSection({ printerId }: AccessSectionProps) {
  const [rows, setRows] = React.useState<PrinterAccessWithUser[] | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(() => {
    listPrinterAccess(printerId)
      .then(setRows)
      .catch((err: unknown) => {
        console.error(err);
        setError(err instanceof ApiError ? err.message : "Zugriffsliste konnte nicht geladen werden.");
      });
  }, [printerId]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  async function handleRoleChange(row: PrinterAccessWithUser, newRole: Exclude<PrinterRole, 'owner'>) {
    setBusy(row.id);
    setError(null);
    try {
      await grantPrinterAccess(printerId, {
        userId: row.userId,
        role: newRole,
        canViewCamera: row.canViewCamera,
        canViewQueue: row.canViewQueue
      });
      reload();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Rolle konnte nicht geändert werden.");
    } finally {
      setBusy(null);
    }
  }

  async function handleFlagToggle(row: PrinterAccessWithUser, flag: 'canViewCamera' | 'canViewQueue', value: boolean) {
    if (row.role === 'owner') return; // never touch owner row
    setBusy(row.id);
    setError(null);
    try {
      await grantPrinterAccess(printerId, {
        userId: row.userId,
        role: row.role as Exclude<PrinterRole, 'owner'>,
        canViewCamera: flag === 'canViewCamera' ? value : row.canViewCamera,
        canViewQueue: flag === 'canViewQueue' ? value : row.canViewQueue
      });
      reload();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Flag konnte nicht gesetzt werden.");
    } finally {
      setBusy(null);
    }
  }

  async function handleRevoke(row: PrinterAccessWithUser) {
    const label = row.userDisplayName || row.userName;
    const ok = globalThis.confirm(`Zugriff für "${label}" entziehen?`);
    if (!ok) return;
    setBusy(row.id);
    try {
      await revokePrinterAccess(printerId, row.userId);
      reload();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Zugriff konnte nicht entzogen werden.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4 max-w-3xl">
      <div>
        <h3 className="text-sm font-semibold text-slate-100">Zugriff</h3>
        <p className="mt-1 text-xs text-slate-500">
          Lade Freunde ein. Contributor dürfen Anfragen stellen, Operator genehmigen und starten.
          Die „Queue"-Sicht und der Kamerazugriff sind pro User schaltbar.
        </p>
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      {rows === null ? (
        <p className="text-sm text-slate-400">Lade…</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <AccessRow
              key={row.id}
              row={row}
              busy={busy === row.id}
              onRoleChange={(newRole) => handleRoleChange(row, newRole)}
              onFlagToggle={(flag, val) => handleFlagToggle(row, flag, val)}
              onRevoke={() => handleRevoke(row)}
            />
          ))}
        </div>
      )}

      <AccessInvite
        printerId={printerId}
        existingUserIds={new Set((rows ?? []).map((r) => r.userId))}
        onGranted={reload}
        onError={setError}
      />
    </section>
  );
}

interface AccessRowProps {
  row: PrinterAccessWithUser;
  busy: boolean;
  onRoleChange: (role: Exclude<PrinterRole, 'owner'>) => void;
  onFlagToggle: (flag: 'canViewCamera' | 'canViewQueue', value: boolean) => void;
  onRevoke: () => void;
}

function AccessRow({ row, busy, onRoleChange, onFlagToggle, onRevoke }: AccessRowProps) {
  const isOwner = row.role === 'owner';
  const label = row.userDisplayName || row.userName;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/5 bg-slate-950/40 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 min-w-0">
        {row.userAvatarUrl ? (
          <img
            src={row.userAvatarUrl}
            alt=""
            className="h-8 w-8 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-slate-300">
            {label.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-100">{label}</p>
          <p className="truncate text-xs text-slate-500">@{row.userName}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isOwner ? (
          <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-semibold text-cyan-200">
            Owner
          </span>
        ) : (
          <>
            <select
              value={row.role}
              onChange={(e) => onRoleChange(e.target.value as Exclude<PrinterRole, 'owner'>)}
              disabled={busy}
              className="rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1 text-xs text-slate-100"
              title={ROLE_HINTS[row.role as Exclude<PrinterRole, 'owner'>]}
            >
              <option value="operator">Operator</option>
              <option value="contributor">Contributor</option>
              <option value="viewer">Viewer</option>
            </select>
            <label className="flex items-center gap-1 text-xs text-slate-400" title="Queue + Anfragen sichtbar">
              <input
                type="checkbox"
                checked={row.canViewQueue}
                onChange={(e) => onFlagToggle('canViewQueue', e.target.checked)}
                disabled={busy}
              />
              Queue
            </label>
            <label className="flex items-center gap-1 text-xs text-slate-400" title="Kamera-Stream sichtbar">
              <input
                type="checkbox"
                checked={row.canViewCamera}
                onChange={(e) => onFlagToggle('canViewCamera', e.target.checked)}
                disabled={busy}
              />
              Kamera
            </label>
            <button
              type="button"
              onClick={onRevoke}
              disabled={busy}
              className="rounded-full border border-red-500/40 px-3 py-1 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50"
            >
              Entziehen
            </button>
          </>
        )}
      </div>
    </div>
  );
}

interface AccessInviteProps {
  printerId: string;
  existingUserIds: Set<string>;
  onGranted: () => void;
  onError: (msg: string) => void;
}

function AccessInvite({ printerId, existingUserIds, onGranted, onError }: AccessInviteProps) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<UserSummary[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [selected, setSelected] = React.useState<UserSummary | null>(null);
  const [role, setRole] = React.useState<Exclude<PrinterRole, 'owner'>>("contributor");
  const [canViewQueue, setCanViewQueue] = React.useState(false);
  const [canViewCamera, setCanViewCamera] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  /**
   * Debounced live search. We don't want to fire a request on every
   * keystroke, but also want the list to feel responsive — 250ms feels
   * natural when typing a handle.
   */
  React.useEffect(() => {
    if (selected) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const handle = globalThis.setTimeout(() => {
      setSearching(true);
      searchUsers(q, 8)
        .then((r) => {
          if (cancelled) return;
          // Filter anyone who already has access so the owner doesn't
          // invite the same person twice through this dialog.
          setResults(r.filter((u) => !existingUserIds.has(u.id)));
        })
        .catch((err: unknown) => {
          console.error(err);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      globalThis.clearTimeout(handle);
    };
  }, [query, selected, existingUserIds]);

  // When the role changes, flip `canViewQueue` to a sensible default:
  // operators usually want it on, contributors/viewers usually off.
  // The owner can still override manually.
  React.useEffect(() => {
    setCanViewQueue(role === 'operator');
  }, [role]);

  function clearSelection() {
    setSelected(null);
    setQuery("");
    setResults([]);
  }

  async function handleGrant() {
    if (!selected) return;
    setBusy(true);
    try {
      await grantPrinterAccess(printerId, {
        userId: selected.id,
        role,
        canViewCamera,
        canViewQueue
      });
      clearSelection();
      setRole("contributor");
      setCanViewCamera(false);
      setCanViewQueue(false);
      onGranted();
    } catch (err: unknown) {
      console.error(err);
      onError(err instanceof ApiError ? err.message : "Einladung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-white/10 pt-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Einladen</p>

      {selected ? (
        <div className="flex items-center gap-3 rounded-xl border border-cyan-400/30 bg-cyan-500/5 p-3">
          {selected.avatarUrl ? (
            <img src={selected.avatarUrl} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-slate-300">
              {(selected.displayName || selected.name).slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-50">
              {selected.displayName || selected.name}
            </p>
            <p className="truncate text-xs text-slate-500">@{selected.name}</p>
          </div>
          <button type="button" onClick={clearSelection} className="text-xs text-slate-400 hover:text-slate-200">
            ändern
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, Handle oder E-Mail"
            className="block w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
            autoComplete="off"
          />
          {query.trim().length >= 2 && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-lg border border-white/10 bg-slate-900 shadow-lg">
              {searching && <p className="px-3 py-2 text-xs text-slate-400">Suche…</p>}
              {!searching && results.length === 0 && (
                <p className="px-3 py-2 text-xs text-slate-400">Keine Treffer.</p>
              )}
              {results.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    setSelected(u);
                    setQuery("");
                    setResults([]);
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white/5"
                >
                  {u.avatarUrl ? (
                    <img src={u.avatarUrl} alt="" className="h-6 w-6 rounded-full" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-[10px] font-semibold text-slate-300">
                      {(u.displayName || u.name).slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-100">{u.displayName || u.name}</p>
                    <p className="truncate text-xs text-slate-500">@{u.name}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selected && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400" htmlFor="invite-role">
              Rolle
            </label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as Exclude<PrinterRole, 'owner'>)}
              className="mt-1 block rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1 text-sm text-slate-100"
            >
              <option value="operator">{ROLE_LABELS.operator}</option>
              <option value="contributor">{ROLE_LABELS.contributor}</option>
              <option value="viewer">{ROLE_LABELS.viewer}</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">{ROLE_HINTS[role]}</p>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={canViewQueue}
                onChange={(e) => setCanViewQueue(e.target.checked)}
              />
              Queue & Anfragen sichtbar
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={canViewCamera}
                onChange={(e) => setCanViewCamera(e.target.checked)}
              />
              Kamera sichtbar
            </label>
          </div>

          <button
            type="button"
            onClick={handleGrant}
            disabled={busy}
            className="btn-outline btn-sm"
          >
            {busy ? "Lade ein…" : "Zugriff erteilen"}
          </button>
        </div>
      )}
    </div>
  );
}
