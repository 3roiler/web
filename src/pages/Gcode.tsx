import * as React from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "../components/DashboardLayout";
import { Pagination } from "../components/Pagination";
import { UploadCard } from "../components/UploadCard";
import { Routes } from "../config/routes";
import { formatBytes, formatDate, formatDuration, readMaxBytes } from "../lib/asset-helpers";
import {
  listGcodeFiles,
  uploadGcodeFile,
  deleteGcodeFile,
  ApiError,
  type GcodeFile,
  type GcodeMetadata
} from "../services";

function metadataPreview(md: GcodeMetadata): string {
  const parts: string[] = [];
  const duration = formatDuration(md.estimatedSeconds);
  if (duration) parts.push(duration);
  if (md.filamentMeters !== undefined) parts.push(`${md.filamentMeters.toFixed(1)}m`);
  if (md.filamentGrams !== undefined) parts.push(`${md.filamentGrams.toFixed(0)}g`);
  if (md.layerCount !== undefined) parts.push(`${md.layerCount} Layer`);
  if (md.slicer) parts.push(md.slicer);
  return parts.join(" · ");
}

export function GcodePage() {
  return (
    <DashboardLayout
      requiredPermission="dashboard.printers"
      kicker="Dashboard · G-Code"
      title="G-Code-Dateien"
      description={
        <>
          Lade fertig gesliceten G-Code hoch. Identische Dateien (gleicher SHA-256) werden
          dedupliziert — wer zuerst lädt, bekommt den Eintrag zugeschrieben.
        </>
      }
      actions={
        <Link to={Routes.Dashboard.GcodeNew} className="btn btn-sm">
          Neuer Entwurf
        </Link>
      }
    >
      {() => <GcodeContent />}
    </DashboardLayout>
  );
}

const PAGE_SIZE = 20;

function GcodeContent() {
  const [files, setFiles] = React.useState<GcodeFile[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [offset, setOffset] = React.useState(0);
  const maxBytes = readMaxBytes("__gcodeMaxBytes");

  const reload = React.useCallback(() => {
    listGcodeFiles(PAGE_SIZE, offset)
      .then(setFiles)
      .catch((e: unknown) => {
        console.error(e);
        setError("G-Code-Liste konnte nicht geladen werden.");
      });
  }, [offset]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  async function handleUpload(file: File) {
    setError(null);
    try {
      await uploadGcodeFile(file);
      reload();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Upload fehlgeschlagen.");
    }
  }

  async function handleDelete(file: GcodeFile) {
    const ok = globalThis.confirm(`"${file.originalFilename}" wirklich löschen?`);
    if (!ok) return;
    setBusyId(file.id);
    try {
      await deleteGcodeFile(file.id);
      reload();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Löschen fehlgeschlagen.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <UploadCard
        title="Neue Datei hochladen"
        hint="Akzeptiert nur plausible G-Code-Dateien (enthält G/M-Kommandos in den ersten 1 KB)."
        accept=".gcode,.g,.gco,application/octet-stream"
        maxBytes={maxBytes}
        onUpload={handleUpload}
        onPreflightError={setError}
      />

      {error && <p className="text-sm text-red-300">{error}</p>}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-100">Meine Dateien</h3>
        {files === null && <p className="text-sm text-slate-400">Lade…</p>}
        {files !== null && files.length === 0 && (
          <p className="text-sm text-slate-400">Noch keine G-Code-Dateien hochgeladen.</p>
        )}
        {files?.map((file) => {
          const meta = metadataPreview(file.metadata);
          return (
            <div
              key={file.id}
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-50">
                  {file.originalFilename}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatBytes(file.sizeBytes)} · {formatDate(file.createdAt)}
                  {meta && <> · {meta}</>}
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-slate-600">
                  sha256: {file.sha256.slice(0, 16)}…
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Link
                  to={Routes.Dashboard.GcodeEdit.replace(":id", file.id)}
                  className="rounded-full border border-cyan-400/40 px-3 py-1 text-xs text-cyan-200 transition hover:bg-cyan-500/10"
                >
                  Bearbeiten
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(file)}
                  disabled={busyId === file.id}
                  className="rounded-full border border-red-500/40 px-3 py-1 text-xs text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                >
                  {busyId === file.id ? "Lösche…" : "Löschen"}
                </button>
              </div>
            </div>
          );
        })}

        {files !== null && (
          <Pagination
            offset={offset}
            pageSize={PAGE_SIZE}
            count={files.length}
            onChange={setOffset}
          />
        )}
      </section>
    </div>
  );
}
