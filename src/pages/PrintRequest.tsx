import * as React from "react";
import { Link } from "react-router-dom";
import { Routes } from "../config/routes";
import { formatBytes, formatDate } from "../lib/asset-helpers";
import {
  getMe,
  uploadStlFile,
  createPrintRequest,
  listPrintRequests,
  ApiError,
  type User,
  type PrintRequestStatus,
  type PrintRequestSourceType,
  type PrintRequestWithContext
} from "../services";

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 4000;
const STL_MAX_BYTES = 52428800;

const STATUS_BADGE: Record<PrintRequestStatus, { label: string; className: string }> = {
  new: { label: "Neu", className: "bg-amber-500/20 text-amber-200" },
  accepted: { label: "Angenommen", className: "bg-cyan-500/20 text-cyan-200" },
  printing: { label: "Druckt", className: "bg-violet-500/20 text-violet-200" },
  done: { label: "Fertig", className: "bg-emerald-500/20 text-emerald-200" },
  rejected: { label: "Abgelehnt", className: "bg-red-500/20 text-red-200" },
  cancelled: { label: "Zurückgezogen", className: "bg-slate-500/20 text-slate-300" }
};

/**
 * Public-side print-request page. Reachable from the global header
 * for anyone with `print.request`. Two flows live here:
 *
 *   - **STL upload**: file is POSTed to /api/stl, the resulting
 *     stl_file_id is then attached to the new print_request.
 *   - **External link**: user pastes a Thingiverse / Printables URL.
 *
 * The page is a plain React route (no Dashboard chrome) so a friend
 * who only has `print.request` doesn't accidentally trip over the
 * `dashboard.view` gate. Status of own requests + a link into the
 * Dashboard list rounds it off.
 */
export function PrintRequestPage() {
  const [me, setMe] = React.useState<User | null | undefined>(undefined);

  React.useEffect(() => {
    getMe()
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  if (me === undefined) {
    return (
      <main className="min-h-screen bg-slate-950 pt-24 pb-12">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-16 pt-6 text-sm text-slate-400">
          Lade…
        </div>
      </main>
    );
  }

  if (!me) {
    return (
      <main className="min-h-screen bg-slate-950 pt-24 pb-12">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-16 pt-6 space-y-3">
          <p className="text-sm text-slate-400">
            Du musst angemeldet sein, um eine Druckanfrage zu stellen.
          </p>
          <Link to={Routes.Home} className="btn-outline btn-sm">
            Zur Startseite
          </Link>
        </div>
      </main>
    );
  }

  const allowed = me.permissions?.some(
    (p) => p === "print.request" || p === "print.moderate" || p === "admin.manage"
  );

  if (!allowed) {
    return (
      <main className="min-h-screen bg-slate-950 pt-24 pb-12">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-16 pt-6 space-y-3">
          <p className="text-sm text-slate-400">
            Druckanfragen sind nur für eingeladene Nutzer freigeschaltet. Frag den Betreiber, falls
            du Zugriff brauchst.
          </p>
          <Link to={Routes.Home} className="btn-outline btn-sm">
            Zur Startseite
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 pt-20 pb-16 sm:pt-24" id="top">
      <div className="mx-auto max-w-3xl px-4 pt-6 sm:px-6 sm:pt-12 lg:px-16 lg:pt-16 space-y-8">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400 sm:text-sm sm:tracking-[0.3em]">
            broiler.dev · 3D-Druck
          </p>
          <h1 className="text-2xl font-semibold text-slate-50 sm:text-4xl">Druckanfrage stellen</h1>
          <p className="max-w-xl text-xs text-slate-400 sm:text-sm">
            Lade ein STL hoch oder verlinke ein fertiges Modell (Thingiverse, Printables, …). Der
            Betreiber sieht deine Anfrage im Dashboard, weist ggf. einen Drucker zu und meldet sich
            bei dir per Kommentar.
          </p>
        </header>

        <RequestForm onCreated={() => undefined} />
        <MyRequestsBlock />
      </div>
    </main>
  );
}

interface RequestFormProps {
  onCreated: () => void;
}

function RequestForm({ onCreated }: RequestFormProps) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [sourceType, setSourceType] = React.useState<PrintRequestSourceType>("stl_upload");
  const [stlFile, setStlFile] = React.useState<File | null>(null);
  const [externalUrl, setExternalUrl] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  function reset() {
    setTitle("");
    setDescription("");
    setStlFile(null);
    setExternalUrl("");
    setSourceType("stl_upload");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (title.trim().length === 0 || title.length > TITLE_MAX) {
      setError(`Titel muss 1–${TITLE_MAX} Zeichen sein.`);
      return;
    }
    if (description.length > DESCRIPTION_MAX) {
      setError(`Beschreibung max. ${DESCRIPTION_MAX} Zeichen.`);
      return;
    }
    if (sourceType === "stl_upload" && !stlFile) {
      setError("Bitte STL-Datei wählen.");
      return;
    }
    if (sourceType === "external_link" && externalUrl.trim().length === 0) {
      setError("Bitte URL angeben.");
      return;
    }
    if (sourceType === "stl_upload" && stlFile && stlFile.size > STL_MAX_BYTES) {
      setError(`STL zu groß (${formatBytes(stlFile.size)} > ${formatBytes(STL_MAX_BYTES)}).`);
      return;
    }

    setBusy(true);
    try {
      let stlFileId: string | undefined;
      if (sourceType === "stl_upload" && stlFile) {
        const uploaded = await uploadStlFile(stlFile);
        stlFileId = uploaded.id;
      }
      await createPrintRequest({
        title: title.trim(),
        description: description.trim() || null,
        sourceType,
        stlFileId,
        externalUrl: sourceType === "external_link" ? externalUrl.trim() : undefined
      });
      setSuccess("Anfrage gesendet — du siehst sie unten in deiner Liste.");
      reset();
      onCreated();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Senden fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6"
    >
      <div>
        <label
          htmlFor="pr-title"
          className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
        >
          Titel
        </label>
        <input
          id="pr-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={TITLE_MAX}
          required
          placeholder="Z.B. „Halterung für Mikrofon"
          className="mt-1 block w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
        />
      </div>

      <div>
        <label
          htmlFor="pr-description"
          className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
        >
          Beschreibung (optional)
        </label>
        <textarea
          id="pr-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={DESCRIPTION_MAX}
          rows={4}
          placeholder="Material-Wunsch, Farbe, Druck-Anforderungen, Dringlichkeit, …"
          className="mt-1 block w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
        />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Quelle</p>
        <div className="mt-2 inline-flex rounded-full border border-white/10 bg-slate-950/60 p-1 text-xs">
          <button
            type="button"
            onClick={() => setSourceType("stl_upload")}
            className={`rounded-full px-3 py-1 ${
              sourceType === "stl_upload" ? "bg-cyan-500/20 text-cyan-200" : "text-slate-400"
            }`}
          >
            STL hochladen
          </button>
          <button
            type="button"
            onClick={() => setSourceType("external_link")}
            className={`rounded-full px-3 py-1 ${
              sourceType === "external_link" ? "bg-cyan-500/20 text-cyan-200" : "text-slate-400"
            }`}
          >
            Externer Link
          </button>
        </div>

        {sourceType === "stl_upload" ? (
          <div className="mt-3 space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".stl,model/stl,application/sla,application/octet-stream"
              onChange={(e) => setStlFile(e.target.files?.[0] ?? null)}
              className="block text-sm text-slate-300 file:mr-3 file:rounded-full file:border-0 file:bg-cyan-500/20 file:px-4 file:py-1.5 file:text-xs file:font-semibold file:text-cyan-200 hover:file:bg-cyan-500/30"
            />
            <p className="text-xs text-slate-500">
              Max. {formatBytes(STL_MAX_BYTES)}. ASCII oder Binary STL.
              {stlFile && (
                <>
                  {" "}
                  · Ausgewählt:{" "}
                  <span className="text-slate-300">
                    {stlFile.name} ({formatBytes(stlFile.size)})
                  </span>
                </>
              )}
            </p>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <input
              type="url"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="https://www.printables.com/model/…"
              className="block w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
            />
            <p className="text-xs text-slate-500">
              Thingiverse, Printables, GitHub, dein Cloud-Drive — Hauptsache http(s).
            </p>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}
      {success && <p className="text-sm text-emerald-300">{success}</p>}

      <button type="submit" className="btn btn-sm" disabled={busy}>
        {busy ? "Sende…" : "Anfrage senden"}
      </button>
    </form>
  );
}

function MyRequestsBlock() {
  const [rows, setRows] = React.useState<PrintRequestWithContext[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(() => {
    listPrintRequests({ mine: true })
      .then(setRows)
      .catch((e: unknown) => {
        console.error(e);
        setError("Liste konnte nicht geladen werden.");
      });
  }, []);

  React.useEffect(() => {
    reload();
    // Re-fetch on focus so a freshly-submitted request appears when
    // the user comes back to the tab.
    const onFocus = () => reload();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reload]);

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-slate-100">Meine Anfragen</h2>
        <Link to={Routes.Dashboard.PrintRequests} className="text-xs text-cyan-300 hover:underline">
          Im Dashboard öffnen →
        </Link>
      </div>
      {error && <p className="text-sm text-red-300">{error}</p>}
      {rows === null && <p className="text-sm text-slate-400">Lade…</p>}
      {rows !== null && rows.length === 0 && (
        <p className="text-sm text-slate-500">Noch keine Anfragen gestellt.</p>
      )}
      {rows?.map((r) => {
        const meta = STATUS_BADGE[r.status];
        return (
          <Link
            key={r.id}
            to={Routes.Dashboard.PrintRequestDetail.replace(":id", r.id)}
            className="block rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-cyan-400/40 hover:bg-cyan-500/5"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded-full px-2 py-0.5 ${meta.className}`}>{meta.label}</span>
              <span className="text-slate-500">{formatDate(r.createdAt)}</span>
            </div>
            <p className="mt-2 truncate text-sm font-semibold text-slate-50">{r.title}</p>
            <p className="mt-1 truncate text-xs text-slate-500">
              {r.sourceType === "stl_upload"
                ? `STL: ${r.stlFilename ?? "Datei gelöscht"}`
                : `Link: ${r.externalUrl}`}
            </p>
          </Link>
        );
      })}
    </section>
  );
}
