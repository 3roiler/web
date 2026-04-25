import * as React from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "../components/DashboardLayout";
import { Routes } from "../config/routes";
import {
  listStlFiles,
  uploadStlFile,
  deleteStlFile,
  ApiError,
  type StlFile
} from "../services";

/**
 * Mirrors `GCODE_MAX_BYTES` default on the server. STLs share the same
 * 50 MB cap until usage tells us otherwise.
 */
const DEFAULT_MAX_BYTES = 52428800;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function metadataPreview(file: StlFile): string {
  const parts: string[] = [];
  if (file.metadata.format) {
    parts.push(file.metadata.format === "binary" ? "Binär" : "ASCII");
  }
  if (file.metadata.triangleCount !== undefined) {
    parts.push(`${file.metadata.triangleCount.toLocaleString("de-DE")} Tris`);
  }
  return parts.join(" · ");
}

export function StlPage() {
  return (
    <DashboardLayout
      requiredPermission="dashboard.printers"
      kicker="Dashboard · STL"
      title="STL-Dateien"
      description={
        <>
          Lade Slicer-Eingabedateien hoch. STLs werden im Browser visualisiert
          (3D-Viewer); Slicing nach G-Code passiert vorerst lokal beim Spieler.
          Identische Dateien (gleicher SHA-256) werden dedupliziert.
        </>
      }
    >
      {() => <StlContent />}
    </DashboardLayout>
  );
}

function StlContent() {
  const [files, setFiles] = React.useState<StlFile[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const maxBytes = (globalThis as unknown as { __stlMaxBytes?: number }).__stlMaxBytes ?? DEFAULT_MAX_BYTES;

  const reload = React.useCallback(() => {
    listStlFiles()
      .then(setFiles)
      .catch((e: unknown) => {
        console.error(e);
        setError("STL-Liste konnte nicht geladen werden.");
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
      await uploadStlFile(file);
      reload();
      if (inputRef.current) inputRef.current.value = "";
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Upload fehlgeschlagen.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(file: StlFile) {
    const ok = globalThis.confirm(`"${file.originalFilename}" wirklich löschen?`);
    if (!ok) return;
    setBusyId(file.id);
    try {
      await deleteStlFile(file.id);
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
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <h3 className="text-sm font-semibold text-slate-100">Neue Datei hochladen</h3>
        <p className="mt-1 text-xs text-slate-500">
          Max. {formatBytes(maxBytes)}. Akzeptiert ASCII- und Binary-STLs (Header-Validierung serverseitig).
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            ref={inputRef}
            type="file"
            accept=".stl,model/stl,application/sla,application/octet-stream"
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
          <p className="text-sm text-slate-400">Noch keine STL-Dateien hochgeladen.</p>
        )}
        {files?.map((file) => {
          const meta = metadataPreview(file);
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
                  to={Routes.Dashboard.StlViewer.replace(":id", file.id)}
                  className="rounded-full border border-cyan-400/40 px-3 py-1 text-xs text-cyan-200 transition hover:bg-cyan-500/10"
                >
                  Ansehen
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
