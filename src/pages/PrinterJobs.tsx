import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { DashboardLayout } from "../components/DashboardLayout";
import { Routes } from "../config/routes";
import {
  getPrinter,
  listPrintJobs,
  getCurrentPrintJob,
  createPrintRequest,
  approvePrintJob,
  rejectPrintJob,
  startPrintJob,
  cancelPrintJob,
  updatePrintJobPriority,
  getPrintJob,
  listGcodeFiles,
  ApiError,
  type PrinterWithRole,
  type PrinterRole,
  type PrintJob,
  type PrintJobState,
  type PrintJobDetail,
  type GcodeFile,
  type User
} from "../services";

const STATE_META: Record<PrintJobState, { label: string; className: string }> = {
  requested: { label: "Angefragt", className: "bg-amber-500/20 text-amber-200" },
  queued: { label: "Queued", className: "bg-slate-500/20 text-slate-300" },
  transferring: { label: "Überträgt", className: "bg-amber-500/20 text-amber-200" },
  printing: { label: "Druckt", className: "bg-cyan-500/20 text-cyan-200" },
  paused: { label: "Pausiert", className: "bg-violet-500/20 text-violet-200" },
  completed: { label: "Fertig", className: "bg-emerald-500/20 text-emerald-200" },
  failed: { label: "Fehler", className: "bg-red-500/20 text-red-200" },
  cancelled: { label: "Abgebrochen", className: "bg-slate-600/20 text-slate-400" }
};

const NON_TERMINAL: PrintJobState[] = ['requested', 'queued', 'transferring', 'printing', 'paused'];
const HISTORY_LIMIT = 50;

function canModerate(role: PrinterRole): boolean {
  return role === 'owner' || role === 'operator';
}

function canSubmit(role: PrinterRole): boolean {
  return role !== 'viewer';
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

function formatProgress(progress: number | null): string {
  if (progress === null || progress === undefined) return "—";
  return `${Math.round(progress * 100)} %`;
}

function gcodeLabel(file: GcodeFile | undefined): string {
  if (!file) return "G-Code gelöscht?";
  const metaParts: string[] = [];
  if (file.metadata.estimatedSeconds) {
    const h = Math.floor(file.metadata.estimatedSeconds / 3600);
    const m = Math.floor((file.metadata.estimatedSeconds % 3600) / 60);
    metaParts.push(h > 0 ? `${h}h ${m}m` : `${m}m`);
  }
  if (file.metadata.filamentGrams) metaParts.push(`${file.metadata.filamentGrams.toFixed(0)}g`);
  return metaParts.length > 0 ? `${file.originalFilename} — ${metaParts.join(" · ")}` : file.originalFilename;
}

export function PrinterJobsPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <DashboardLayout
      requiredPermission="dashboard.printers"
      kicker="Dashboard · Druckqueue"
      title="Druck & Anfragen"
      description="Aktuell laufender Job, Anfragen zur Moderation, Warteschlange und Historie."
      actions={
        id ? (
          <Link to={Routes.Dashboard.PrinterDetail.replace(":id", id)} className="btn-outline">
            Zurück zum Drucker
          </Link>
        ) : null
      }
    >
      {({ me }) => (id ? <JobsContent printerId={id} me={me} /> : <p className="text-sm text-red-300">Keine Drucker-ID.</p>)}
    </DashboardLayout>
  );
}

function JobsContent({ printerId, me }: { printerId: string; me: User }) {
  const [printer, setPrinter] = React.useState<PrinterWithRole | null | undefined>(undefined);
  const [currentJob, setCurrentJob] = React.useState<PrintJob | null>(null);
  const [jobs, setJobs] = React.useState<PrintJob[] | null>(null);
  const [gcodes, setGcodes] = React.useState<GcodeFile[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busyJob, setBusyJob] = React.useState<string | null>(null);
  const [expandedJob, setExpandedJob] = React.useState<PrintJobDetail | null>(null);

  // Enqueue-form state
  const [pickFileId, setPickFileId] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const reload = React.useCallback(() => {
    Promise.all([
      getPrinter(printerId),
      listPrintJobs(printerId, { limit: HISTORY_LIMIT }),
      getCurrentPrintJob(printerId)
    ])
      .then(([p, js, cur]) => {
        setPrinter(p);
        setJobs(js);
        setCurrentJob(cur);
      })
      .catch((e: unknown) => {
        console.error(e);
        if (e instanceof ApiError && e.status === 404) setPrinter(null);
        else setError("Drucker oder Jobs konnten nicht geladen werden.");
      });
  }, [printerId]);

  React.useEffect(() => {
    reload();
    listGcodeFiles().then(setGcodes).catch((e: unknown) => console.error(e));
  }, [reload]);

  // Poll while anything is non-terminal. Idle tabs stop pinging.
  React.useEffect(() => {
    if (jobs === null) return;
    const anyActive = jobs.some((j) => NON_TERMINAL.includes(j.state)) || currentJob !== null;
    if (!anyActive) return;
    const handle = globalThis.setInterval(reload, 5000);
    return () => globalThis.clearInterval(handle);
  }, [jobs, currentJob, reload]);

  if (error && !printer) return <p className="text-sm text-red-300">{error}</p>;
  if (printer === undefined) return <p className="text-sm text-slate-400">Lade…</p>;
  if (printer === null) return <p className="text-sm text-slate-400">Drucker nicht gefunden.</p>;

  const isModerator = canModerate(printer.role);
  const canSubmitJob = canSubmit(printer.role);

  // Split the list by semantic buckets. `currentJob` is pulled in
  // separately (it always reflects the single in-flight one).
  const requested = (jobs ?? []).filter((j) => j.state === 'requested');
  const queued = (jobs ?? []).filter((j) => j.state === 'queued');
  const history = (jobs ?? []).filter((j) => !NON_TERMINAL.includes(j.state));
  const gcodeById = new Map((gcodes ?? []).map((f) => [f.id, f]));

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!pickFileId) {
      setError("Bitte G-Code auswählen.");
      return;
    }
    setCreating(true);
    try {
      await createPrintRequest(printerId, { gcodeFileId: pickFileId });
      setPickFileId("");
      reload();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Anfrage fehlgeschlagen.");
    } finally {
      setCreating(false);
    }
  }

  async function handleApprove(job: PrintJob) {
    setBusyJob(job.id);
    try {
      await approvePrintJob(printerId, job.id, 0);
      reload();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Genehmigen fehlgeschlagen.");
    } finally {
      setBusyJob(null);
    }
  }

  async function handleReject(job: PrintJob) {
    const reason = globalThis.prompt("Grund für die Ablehnung?");
    if (!reason || !reason.trim()) return;
    setBusyJob(job.id);
    try {
      await rejectPrintJob(printerId, job.id, reason.trim());
      reload();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Ablehnen fehlgeschlagen.");
    } finally {
      setBusyJob(null);
    }
  }

  async function handleStart(job: PrintJob) {
    const ok = globalThis.confirm(`Job "${gcodeById.get(job.gcodeFileId)?.originalFilename ?? job.id}" jetzt starten?`);
    if (!ok) return;
    setBusyJob(job.id);
    try {
      await startPrintJob(printerId, job.id);
      reload();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Start fehlgeschlagen.");
    } finally {
      setBusyJob(null);
    }
  }

  async function handleCancel(job: PrintJob) {
    const ok = globalThis.confirm(`Job abbrechen?`);
    if (!ok) return;
    setBusyJob(job.id);
    try {
      await cancelPrintJob(printerId, job.id);
      reload();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Abbrechen fehlgeschlagen.");
    } finally {
      setBusyJob(null);
    }
  }

  async function handlePriorityBump(job: PrintJob, delta: number) {
    setBusyJob(job.id);
    try {
      await updatePrintJobPriority(printerId, job.id, job.priority + delta);
      reload();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Priorität nicht änderbar.");
    } finally {
      setBusyJob(null);
    }
  }

  /**
   * Decides whether the viewer can edit a job's g-code. Mirrors the
   * backend rule in `controllers/print-job.ts#replaceGcode`:
   *   - owner / operator: any pending job (`requested` or `queued`)
   *   - submitter: only their own, only while still `requested`
   * Outside of those windows the editor button stays hidden so we don't
   * tease the user with a control that 403s.
   */
  function editUrlFor(job: PrintJob): string | null {
    if (job.state !== 'requested' && job.state !== 'queued') return null;
    const ok =
      isModerator || (job.state === 'requested' && job.userId === me.id);
    if (!ok) return null;
    return (
      Routes.Dashboard.GcodeEdit.replace(':id', job.gcodeFileId) +
      `?jobId=${encodeURIComponent(job.id)}&printerId=${encodeURIComponent(printerId)}`
    );
  }

  async function handleExpand(job: PrintJob) {
    if (expandedJob?.id === job.id) {
      setExpandedJob(null);
      return;
    }
    try {
      const detail = await getPrintJob(printerId, job.id);
      setExpandedJob(detail);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Details konnten nicht geladen werden.");
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <header className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-slate-100">{printer.name}</h3>
          <span className="text-xs text-slate-500">
            {printer.model} · Rolle: <span className="font-mono text-slate-300">{printer.role}</span>
          </span>
        </div>
      </header>

      {/* Current live job: most prominent block */}
      <section className="rounded-2xl border border-cyan-400/30 bg-cyan-500/5 p-5">
        <h3 className="text-sm font-semibold text-cyan-200">Aktuell</h3>
        {currentJob ? (
          <div className="mt-3">
            <JobCard
              job={currentJob}
              file={gcodeById.get(currentJob.gcodeFileId)}
              role={printer.role}
              busy={busyJob === currentJob.id}
              expanded={expandedJob?.id === currentJob.id ? expandedJob : null}
              editGcodeUrl={editUrlFor(currentJob)}
              onCancel={isModerator ? () => handleCancel(currentJob) : null}
              onPriorityBump={null}
              onApprove={null}
              onReject={null}
              onStart={null}
              onToggleExpand={() => handleExpand(currentJob)}
            />
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-400">Drucker ist im Moment nicht aktiv.</p>
        )}
      </section>

      {canSubmitJob && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
          <h3 className="text-sm font-semibold text-slate-100">
            {isModerator ? "Neuen Druck einreihen" : "Druckanfrage stellen"}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {isModerator
              ? "Als Owner/Operator landet dein Druck direkt zur Moderation — du kannst ihn selbst genehmigen."
              : "Deine Anfrage wartet auf Freigabe durch den Owner, bevor sie in die Queue kommt."}
          </p>
          <form onSubmit={handleCreate} className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400" htmlFor="job-gcode">
                G-Code
              </label>
              <select
                id="job-gcode"
                value={pickFileId}
                onChange={(e) => setPickFileId(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
              >
                <option value="">— wählen —</option>
                {(gcodes ?? []).map((g) => (
                  <option key={g.id} value={g.id}>
                    {gcodeLabel(g)}
                  </option>
                ))}
              </select>
              {gcodes?.length === 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  Noch keine G-Code-Dateien —{" "}
                  <Link to={Routes.Dashboard.Gcode} className="text-cyan-300 hover:underline">
                    hochladen
                  </Link>
                  .
                </p>
              )}
            </div>
            <button type="submit" className="btn-outline btn-sm" disabled={creating}>
              {creating ? "Sende…" : isModerator ? "Einreihen" : "Anfrage stellen"}
            </button>
          </form>
        </section>
      )}

      {error && <p className="text-sm text-red-300">{error}</p>}

      {/* Requests — only visible to moderators (they're the ones acting
          on them) plus to contributors if the flag is on; own submissions
          always show below the moderation block if they're pending. */}
      {isModerator && requested.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-100">
            Anfragen zur Moderation
            <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-200">
              {requested.length}
            </span>
          </h3>
          {requested.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              file={gcodeById.get(job.gcodeFileId)}
              role={printer.role}
              busy={busyJob === job.id}
              expanded={expandedJob?.id === job.id ? expandedJob : null}
              editGcodeUrl={editUrlFor(job)}
              onApprove={() => handleApprove(job)}
              onReject={() => handleReject(job)}
              onStart={null}
              onCancel={() => handleCancel(job)}
              onPriorityBump={null}
              onToggleExpand={() => handleExpand(job)}
            />
          ))}
        </section>
      )}

      {/* Contributors see their own pending requests here so they can
          track status / swap the g-code / cancel before approval. */}
      {!isModerator && requested.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-100">Meine Anfragen</h3>
          {requested.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              file={gcodeById.get(job.gcodeFileId)}
              role={printer.role}
              busy={busyJob === job.id}
              expanded={expandedJob?.id === job.id ? expandedJob : null}
              editGcodeUrl={editUrlFor(job)}
              onApprove={null}
              onReject={null}
              onStart={null}
              onCancel={() => handleCancel(job)}
              onPriorityBump={null}
              onToggleExpand={() => handleExpand(job)}
            />
          ))}
        </section>
      )}

      {queued.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-100">Queue</h3>
          <p className="text-xs text-slate-500">
            {isModerator
              ? 'Wähle explizit den nächsten Job mit "Starten".'
              : 'Dein approved Job wartet, bis der Owner ihn startet.'}
          </p>
          {queued.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              file={gcodeById.get(job.gcodeFileId)}
              role={printer.role}
              busy={busyJob === job.id}
              expanded={expandedJob?.id === job.id ? expandedJob : null}
              editGcodeUrl={editUrlFor(job)}
              onApprove={null}
              onReject={null}
              onStart={isModerator && currentJob === null ? () => handleStart(job) : null}
              onCancel={() => handleCancel(job)}
              onPriorityBump={isModerator ? (delta) => handlePriorityBump(job, delta) : null}
              onToggleExpand={() => handleExpand(job)}
            />
          ))}
        </section>
      )}

      {history.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-100">Historie</h3>
          {history.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              file={gcodeById.get(job.gcodeFileId)}
              role={printer.role}
              busy={false}
              expanded={expandedJob?.id === job.id ? expandedJob : null}
              editGcodeUrl={null}
              onApprove={null}
              onReject={null}
              onStart={null}
              onCancel={null}
              onPriorityBump={null}
              onToggleExpand={() => handleExpand(job)}
            />
          ))}
        </section>
      )}
    </div>
  );
}

interface JobCardProps {
  job: PrintJob;
  file: GcodeFile | undefined;
  role: PrinterRole;
  busy: boolean;
  expanded: PrintJobDetail | null;
  /** Set when the viewer is allowed to edit this job's g-code. */
  editGcodeUrl: string | null;
  onApprove: (() => void) | null;
  onReject: (() => void) | null;
  onStart: (() => void) | null;
  onCancel: (() => void) | null;
  onPriorityBump: ((delta: number) => void) | null;
  onToggleExpand: () => void;
}

function JobCard(props: JobCardProps) {
  const { job, file, busy, expanded, editGcodeUrl, onApprove, onReject, onStart, onCancel, onPriorityBump, onToggleExpand } = props;
  const meta = STATE_META[job.state];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded-full px-2 py-0.5 ${meta.className}`}>{meta.label}</span>
            {job.progress !== null && <span className="text-slate-400">{formatProgress(job.progress)}</span>}
            {job.state === 'queued' && <span className="text-slate-500">Priorität {job.priority}</span>}
          </div>
          <p className="mt-2 truncate text-sm font-semibold text-slate-50">
            {file ? file.originalFilename : <span className="text-slate-500 italic">G-Code gelöscht</span>}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Eingereiht {formatDate(job.queuedAt)}
            {job.startedAt && ` · Start ${formatDate(job.startedAt)}`}
            {job.finishedAt && ` · Ende ${formatDate(job.finishedAt)}`}
          </p>
          {job.progress !== null && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full bg-cyan-400 transition-all"
                style={{ width: `${Math.round(job.progress * 100)}%` }}
              />
            </div>
          )}
          {job.errorMessage && (
            <p className="mt-2 text-xs text-red-300">{job.errorMessage}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button type="button" onClick={onToggleExpand} className="btn-outline btn-sm">
            {expanded ? "Schließen" : "Events"}
          </button>
          {editGcodeUrl && (
            <Link
              to={editGcodeUrl}
              className="rounded-full border border-cyan-400/40 px-3 py-1 text-xs text-cyan-200 hover:bg-cyan-500/10"
            >
              G-Code
            </Link>
          )}
          {onApprove && (
            <button
              type="button"
              onClick={onApprove}
              disabled={busy}
              className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
            >
              Genehmigen
            </button>
          )}
          {onReject && (
            <button
              type="button"
              onClick={onReject}
              disabled={busy}
              className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs text-red-300 hover:bg-red-500/20 disabled:opacity-50"
            >
              Ablehnen
            </button>
          )}
          {onStart && (
            <button
              type="button"
              onClick={onStart}
              disabled={busy}
              className="rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-50"
            >
              Starten ▶
            </button>
          )}
          {onPriorityBump && (
            <>
              <button
                type="button"
                onClick={() => onPriorityBump(+1)}
                disabled={busy}
                className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/10 disabled:opacity-50"
                title="Priorität +1"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => onPriorityBump(-1)}
                disabled={busy}
                className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/10 disabled:opacity-50"
                title="Priorität −1"
              >
                ↓
              </button>
            </>
          )}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="rounded-full border border-red-500/40 px-3 py-1 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50"
            >
              Abbrechen
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Events</p>
          {expanded.events.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">Keine Events.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-xs text-slate-400">
              {expanded.events.map((ev) => (
                <li key={ev.id} className="flex gap-3">
                  <span className="w-32 shrink-0 text-slate-500">{formatDate(ev.ts)}</span>
                  <span className="w-28 shrink-0 font-mono text-cyan-300">{ev.eventType}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-slate-500">
                    {Object.keys(ev.payload).length > 0 ? JSON.stringify(ev.payload) : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
