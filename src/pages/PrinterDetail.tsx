import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DashboardLayout } from "../components/DashboardLayout";
import { Routes } from "../config/routes";
import {
  getPrinter,
  updatePrinter,
  deletePrinter,
  rotatePrinterToken,
  ApiError,
  type PrinterWithRole,
  type PrinterStatus
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
        <Link to={Routes.Dashboard.Printers} className="btn-outline">
          Zurück zur Liste
        </Link>
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
