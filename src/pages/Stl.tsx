import * as React from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "../components/DashboardLayout";
import { Pagination } from "../components/Pagination";
import { UploadCard } from "../components/UploadCard";
import { Routes } from "../config/routes";
import { formatBytes, formatDate, readMaxBytes } from "../lib/asset-helpers";
import { listStlFiles, uploadStlFile, deleteStlFile, ApiError, type StlFile } from "../services";

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
          Lade Slicer-Eingabedateien hoch. STLs werden im Browser visualisiert (3D-Viewer); Slicing
          nach G-Code passiert vorerst lokal beim Spieler. Identische Dateien (gleicher SHA-256)
          werden dedupliziert.
        </>
      }
    >
      {() => <StlContent />}
    </DashboardLayout>
  );
}

const PAGE_SIZE = 20;

function StlContent() {
  const [files, setFiles] = React.useState<StlFile[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [offset, setOffset] = React.useState(0);
  const maxBytes = readMaxBytes("__stlMaxBytes");

  const reload = React.useCallback(() => {
    listStlFiles(PAGE_SIZE, offset)
      .then(setFiles)
      .catch((e: unknown) => {
        console.error(e);
        setError("STL-Liste konnte nicht geladen werden.");
      });
  }, [offset]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  async function handleUpload(file: File) {
    setError(null);
    try {
      await uploadStlFile(file);
      reload();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Upload fehlgeschlagen.");
    }
  }

  async function handleDelete(file: StlFile) {
    const ok = globalThis.confirm(`"${file.originalFilename}" wirklich löschen?`);
    if (!ok) return;
    setBusyId(file.id);
    try {
      await deleteStlFile(file.id);
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
        hint="Akzeptiert ASCII- und Binary-STLs (Header-Validierung serverseitig)."
        accept=".stl,model/stl,application/sla,application/octet-stream"
        maxBytes={maxBytes}
        onUpload={handleUpload}
        onPreflightError={setError}
      />

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
