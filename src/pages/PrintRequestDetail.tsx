import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DashboardLayout } from "../components/DashboardLayout";
import { Routes } from "../config/routes";
import { formatDate } from "../lib/asset-helpers";
import { safeHttpUrl } from "../lib/url";
import {
  getPrintRequest,
  updatePrintRequest,
  cancelPrintRequest,
  addPrintRequestComment,
  listPrinters,
  ApiError,
  type User,
  type PrintRequestDetail,
  type PrintRequestStatus,
  type PrinterWithRole
} from "../services";

const STATUS_META: Record<PrintRequestStatus, { label: string; className: string }> = {
  new: { label: "Neu", className: "bg-amber-500/20 text-amber-200" },
  accepted: { label: "Angenommen", className: "bg-cyan-500/20 text-cyan-200" },
  printing: { label: "Druckt", className: "bg-violet-500/20 text-violet-200" },
  done: { label: "Fertig", className: "bg-emerald-500/20 text-emerald-200" },
  rejected: { label: "Abgelehnt", className: "bg-red-500/20 text-red-200" },
  cancelled: { label: "Zurückgezogen", className: "bg-slate-500/20 text-slate-300" }
};

const ALL_STATUSES: PrintRequestStatus[] = [
  "new", "accepted", "printing", "done", "rejected", "cancelled"
];

function isModerator(me: User): boolean {
  return Boolean(
    me.permissions?.some((p) => p === "print.moderate" || p === "admin.manage")
  );
}

export function PrintRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <DashboardLayout
      requiredPermission="print.request"
      kicker="Dashboard · Druckanfrage"
      title="Anfrage-Detail"
      description="Status, Drucker-Zuweisung und Kommentar-Thread."
      actions={
        <Link to={Routes.Dashboard.PrintRequests} className="btn-outline btn-sm">
          Zurück zur Liste
        </Link>
      }
    >
      {({ me }) =>
        id ? <DetailContent id={id} me={me} /> : <p className="text-sm text-red-300">Keine Anfrage-ID.</p>
      }
    </DashboardLayout>
  );
}

function DetailContent({ id, me }: { id: string; me: User }) {
  const navigate = useNavigate();
  const moderator = isModerator(me);
  const [data, setData] = React.useState<PrintRequestDetail | null | undefined>(undefined);
  const [printers, setPrinters] = React.useState<PrinterWithRole[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const reload = React.useCallback(() => {
    getPrintRequest(id)
      .then(setData)
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) {
          setData(null);
        } else {
          console.error(err);
          setError(err instanceof ApiError ? err.message : "Anfrage konnte nicht geladen werden.");
        }
      });
  }, [id]);

  React.useEffect(() => {
    reload();
    if (moderator) {
      listPrinters().then(setPrinters).catch((e: unknown) => console.error(e));
    }
  }, [reload, moderator]);

  if (data === undefined) return <p className="text-sm text-slate-400">Lade…</p>;
  if (data === null) return <p className="text-sm text-slate-400">Anfrage nicht gefunden.</p>;

  const isOwnRequest = data.requesterUserId === me.id;
  const isTerminal = data.status === "done" || data.status === "rejected" || data.status === "cancelled";

  async function handleStatus(newStatus: PrintRequestStatus) {
    setBusy(true);
    setError(null);
    try {
      await updatePrintRequest(id, { status: newStatus });
      reload();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Status konnte nicht geändert werden.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePrinter(printerId: string | null) {
    setBusy(true);
    setError(null);
    try {
      await updatePrintRequest(id, { assignedPrinterId: printerId });
      reload();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Drucker konnte nicht zugewiesen werden.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    const ok = globalThis.confirm("Anfrage wirklich zurückziehen?");
    if (!ok) return;
    setBusy(true);
    try {
      await cancelPrintRequest(id);
      reload();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Zurückziehen fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  const statusMeta = STATUS_META[data.status];
  const requesterLabel = data.requesterDisplayName || data.requesterName;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header card */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full px-2 py-0.5 ${statusMeta.className}`}>{statusMeta.label}</span>
          <span className="text-slate-500">Eingereicht {formatDate(data.createdAt)}</span>
          {data.updatedAt && data.updatedAt !== data.createdAt && (
            <span className="text-slate-500">· geändert {formatDate(data.updatedAt)}</span>
          )}
        </div>
        <h2 className="text-xl font-semibold text-slate-50">{data.title}</h2>
        {data.description && (
          <p className="whitespace-pre-wrap text-sm text-slate-300">{data.description}</p>
        )}

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-slate-500">Anfrager</dt>
          <dd className="text-slate-200">
            {requesterLabel} <span className="text-slate-500">(@{data.requesterName})</span>
          </dd>

          <dt className="text-slate-500">Quelle</dt>
          <dd className="break-all text-slate-200">
            {data.sourceType === "stl_upload" ? (
              data.stlFileId ? (
                <Link
                  to={Routes.Dashboard.StlViewer.replace(":id", data.stlFileId)}
                  className="text-cyan-300 hover:underline"
                >
                  STL: {data.stlFilename ?? "Datei gelöscht"}
                </Link>
              ) : (
                <span className="text-slate-500 italic">STL gelöscht</span>
              )
            ) : (() => {
              // `externalUrl` ist Backend-stammend und User-Controlled —
              // `javascript:`-Schemata würden den XSS-Hotspot triggern,
              // sobald jemand draufklickt. Vor dem Render durch
              // `safeHttpUrl()` rauschen lassen.
              const safeExternal = safeHttpUrl(data.externalUrl);
              return safeExternal ? (
                <a
                  href={safeExternal}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-300 hover:underline"
                >
                  {safeExternal}
                </a>
              ) : (
                <span className="text-slate-500 italic">Ungültiger Link</span>
              );
            })()}
          </dd>

          {data.printerName && (
            <>
              <dt className="text-slate-500">Drucker</dt>
              <dd className="text-slate-200">{data.printerName}</dd>
            </>
          )}
        </dl>
      </section>

      {error && <p className="text-sm text-red-300">{error}</p>}

      {/* Moderator actions */}
      {moderator && !isTerminal && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3 sm:p-6">
          <h3 className="text-sm font-semibold text-slate-100">Moderation</h3>

          <div>
            <label
              htmlFor="pr-printer"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
            >
              Drucker zuweisen
            </label>
            <select
              id="pr-printer"
              value={data.assignedPrinterId ?? ""}
              onChange={(e) => handlePrinter(e.target.value || null)}
              disabled={busy}
              className="mt-1 block w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 sm:w-72"
            >
              <option value="">— kein Drucker —</option>
              {printers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.model})
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Status</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ALL_STATUSES.filter((s) => s !== data.status).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleStatus(s)}
                  disabled={busy}
                  className={`rounded-full border px-3 py-1 text-xs ${STATUS_META[s].className} hover:brightness-110 disabled:opacity-50`}
                >
                  → {STATUS_META[s].label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Übergänge sind serverseitig validiert: ungültige Sprünge werden mit 409 abgelehnt.
            </p>
          </div>
        </section>
      )}

      {/* Requester action */}
      {isOwnRequest && !isTerminal && !moderator && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2 sm:p-6">
          <p className="text-xs text-slate-400">
            Solange die Anfrage noch nicht erledigt ist, kannst du sie zurückziehen.
          </p>
          <button
            type="button"
            onClick={handleCancel}
            disabled={busy}
            className="rounded-full border border-red-500/40 px-3 py-1 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50"
          >
            Anfrage zurückziehen
          </button>
        </section>
      )}

      {/* Comment thread */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-100">Kommentare</h3>
        <CommentThread requestId={id} comments={data.comments} onPosted={reload} />
      </section>

      {/* Cleanup nav for cancelled-by-other moderation */}
      {moderator && data.status === "done" && (
        <button
          type="button"
          onClick={() => navigate(Routes.Dashboard.PrintRequests)}
          className="btn-outline btn-sm"
        >
          Zurück zur Liste
        </button>
      )}
    </div>
  );
}

interface CommentThreadProps {
  requestId: string;
  comments: PrintRequestDetail["comments"];
  onPosted: () => void;
}

function CommentThread({ requestId, comments, onPosted }: CommentThreadProps) {
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (body.trim().length === 0) return;
    setBusy(true);
    try {
      await addPrintRequestComment(requestId, body.trim());
      setBody("");
      onPosted();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Kommentar konnte nicht gesendet werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {comments.length === 0 && <p className="text-xs text-slate-500">Noch keine Kommentare.</p>}
      <ul className="space-y-2">
        {comments.map((c) => {
          const author = c.authorDisplayName || c.authorName;
          const avatar = safeHttpUrl(c.authorAvatarUrl);
          return (
            <li key={c.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center gap-3">
                {avatar ? (
                  <img src={avatar} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-[10px] font-semibold text-slate-300">
                    {author.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1 text-xs text-slate-400">
                  <span className="text-slate-200">{author}</span>{" "}
                  <span className="text-slate-500">· {formatDate(c.createdAt)}</span>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{c.body}</p>
            </li>
          );
        })}
      </ul>

      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={4000}
          placeholder="Kommentar schreiben…"
          className="block w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
        />
        {error && <p className="text-xs text-red-300">{error}</p>}
        <button type="submit" className="btn btn-sm" disabled={busy || body.trim().length === 0}>
          {busy ? "Sende…" : "Senden"}
        </button>
      </form>
    </div>
  );
}
