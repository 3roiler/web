import * as React from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "../components/DashboardLayout";
import { Routes } from "../config/routes";
import {
  listGcodeFiles,
  uploadGcodeFile,
  deleteGcodeFile,
  ApiError,
  type GcodeFile,
  type GcodeMetadata
} from "../services";

/**
 * Mirrors `GCODE_MAX_BYTES` default on the server. Used for client-side
 * pre-check so the user gets instant feedback instead of a 413.
 * Override via `window.__gcodeMaxBytes` if the server limit is bumped.
 */
const DEFAULT_MAX_BYTES = 52428800; // 50 MiB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number | undefined): string | null {
  if (seconds === undefined) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

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
          Lade fertig gesliceten G-Code hoch. Identische Dateien (gleicher
          SHA-256) werden dedupliziert — wer zuerst lädt, bekommt den
          Eintrag zugeschrieben.
        </>
      }
    >
      {() => <GcodeContent />}
    </DashboardLayout>
  );
}

function GcodeContent() {
  const [files, setFiles] = React.useState<GcodeFile[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const maxBytes = (globalThis as unknown as { __gcodeMaxBytes?: number }).__gcodeMaxBytes ?? DEFAULT_MAX_BYTES;

  const reload = React.useCallback(() => {
    listGcodeFiles()
      .then(setFiles)
      .catch((e: unknown) => {
        console.error(e);
        setError("G-Code-Liste konnte nicht geladen werden.");
      });
  }, []);

  React.useEffect(() => {
    reload();
  }, [reload]);

  async function handleUpload(file: File) {
    setError(null);
    if (file.size === 0) {
      setError("Datei ist leer.");
      return;
    }
    if (file.size > maxBytes) {
      setError(`Datei zu groß (${formatBytes(file.size)} > ${formatBytes(maxBytes)}).`);
      return;
    }

    setUploading(true);
    try {
      await uploadGcodeFile(file);
      reload();
      if (inputRef.current) inputRef.current.value = "";
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Upload fehlgeschlagen.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(file: GcodeFile) {
    const ok = globalThis.confirm(`"${file.originalFilename}" wirklich löschen?`);
    if (!ok) return;
    setBusyId(file.id);
    try {
      await deleteGcodeFile(file.id);
      setFiles((prev) => prev?.filter((f) => f.id !== file.id) ?? null);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Löschen fehlgeschlagen.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h3 className="text-sm font-semibold text-slate-100">Neue Datei hochladen</h3>
        <p className="mt-1 text-xs text-slate-500">
          Max. {formatBytes(maxBytes)}. Akzeptiert nur plausible G-Code-Dateien
          (enthält G/M-Kommandos in den ersten 1 KB).
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            ref={inputRef}
            type="file"
            accept=".gcode,.g,.gco,application/octet-stream"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
            }}
            className="block text-sm text-slate-300 file:mr-3 file:rounded-full file:border-0 file:bg-cyan-500/20 file:px-4 file:py-1.5 file:text-xs file:font-semibold file:text-cyan-200 hover:file:bg-cyan-500/30"
          />
          {uploading && <span className="text-xs text-cyan-300">Lade hoch…</span>}
        </div>
      </section>

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
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 sm:flex-row sm:items-center sm:justify-between"
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
      </section>
    </div>
  );
}
