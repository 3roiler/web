import * as React from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import CodeMirror from "@uiw/react-codemirror";
import type { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { StreamLanguage, type StreamParser } from "@codemirror/language";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

import { DashboardLayout } from "../components/DashboardLayout";
import { Routes } from "../config/routes";
import {
  getGcodeContent,
  uploadGcodeFile,
  replaceJobGcode,
  ApiError
} from "../services";
import type { GcodeFile } from "../services";

import { listGcodeFiles } from "../services";

/**
 * Quick-and-pragmatic G-code language for CodeMirror.
 *
 * G-code is a flat stream of tokens — there's no nested structure to
 * parse, so a Lezer grammar would be overkill. A `StreamParser` walks
 * the input one chunk at a time and tags each chunk; the highlight
 * style below maps those tags to colours.
 *
 * Tokens we recognise (in priority order, first match wins per stream
 * step):
 *   - line comments  : `;` to end of line  → `comment`
 *   - block comments : `( ... )`            → `comment`
 *   - G/M codes      : `G1`, `M104`, ...    → `keyword`
 *   - axis params    : `X100`, `Y-3.4`, etc → `variable` for the letter,
 *                                             `number` for the value
 *   - everything else falls through as `null`
 */
const gcodeParser: StreamParser<unknown> = {
  startState: () => ({}),
  token(stream) {
    if (stream.eatSpace()) return null;

    if (stream.match(/^;.*/)) return "comment";
    if (stream.match(/^\([^)]*\)/)) return "comment";

    if (stream.match(/^[GM]\d+(\.\d+)?/i)) return "keyword";
    if (stream.match(/^[TS]\d+/i)) return "keyword";

    // Axis / parameter letter followed by a number: tag the letter
    // separately (variable) so the value (number) shows in a different
    // hue. We consume the letter here and the next stream step picks up
    // the number.
    if (stream.match(/^[XYZEFIJKABCRPQDH]/i)) return "variableName";
    if (stream.match(/^-?\d+(\.\d+)?/)) return "number";

    // Catch-all so the stream keeps moving — never throw.
    stream.next();
    return null;
  }
};

const gcodeLanguage = StreamLanguage.define(gcodeParser);

/**
 * Dark-theme palette tuned to fit the rest of the dashboard:
 * - cyan-ish keyword for G/M codes (matches the broiler accent)
 * - amber for axis letters
 * - pale slate for numbers
 * - muted slate for comments
 */
const gcodeHighlight = HighlightStyle.define([
  { tag: t.comment, color: "#64748b", fontStyle: "italic" },
  { tag: t.keyword, color: "#22d3ee", fontWeight: "600" },
  { tag: t.variableName, color: "#fbbf24" },
  { tag: t.number, color: "#e2e8f0" }
]);

const editorTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "transparent",
      color: "#e2e8f0",
      fontSize: "13px"
    },
    ".cm-content": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", caretColor: "#22d3ee" },
    ".cm-cursor": { borderLeftColor: "#22d3ee" },
    ".cm-gutters": {
      backgroundColor: "rgba(15, 23, 42, 0.6)",
      color: "#475569",
      borderRight: "1px solid rgba(255,255,255,0.06)"
    },
    ".cm-activeLine": { backgroundColor: "rgba(34,211,238,0.04)" },
    ".cm-activeLineGutter": { backgroundColor: "rgba(34,211,238,0.08)", color: "#94a3b8" },
    ".cm-selectionBackground": { backgroundColor: "rgba(34,211,238,0.20) !important" },
    ".cm-scroller": { overflow: "auto" }
  },
  { dark: true }
);

const EXTENSIONS = [gcodeLanguage, syntaxHighlighting(gcodeHighlight), editorTheme];

/**
 * Renders the editor in one of two modes:
 *
 *   - **Existing file**: route is `/dashboard/gcode/:id/edit`. We fetch
 *     the file metadata + body and pre-fill the buffer.
 *   - **New / blank**: route is `/dashboard/gcode/new`. The buffer
 *     starts empty and the filename defaults to `untitled.gcode`. Save
 *     uploads it as a fresh `gcode_file` row and navigates to that
 *     file's editor URL.
 *
 * Both modes share the same component below so the editing UX, save
 * flow and beforeunload guard live in one place.
 */
export function GcodeEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get("jobId");
  const printerId = searchParams.get("printerId");

  // `useParams` returns undefined for the `/new` route — translate to
  // `null` so the contract for `EditorContent` is explicit.
  const fileId = id ?? null;
  const isNew = fileId === null;

  return (
    <DashboardLayout
      requiredPermission="dashboard.printers"
      kicker="Dashboard · G-Code Editor"
      title={isNew ? "Neuer Entwurf" : "G-Code bearbeiten"}
      description={
        isNew
          ? "Schreibe G-Code von Hand oder füge ihn ein. Beim Speichern landet er als neue Datei in deiner G-Code-Liste."
          : jobId
          ? "Änderungen werden als neue Version gespeichert und am verknüpften Druckjob hinterlegt."
          : "Änderungen werden als neue Version gespeichert. Der Original-G-Code bleibt unverändert."
      }
      actions={
        <Link to={Routes.Dashboard.Gcode} className="btn-outline btn-sm">
          Zurück zur Liste
        </Link>
      }
    >
      {() => <EditorContent fileId={fileId} jobId={jobId} printerId={printerId} />}
    </DashboardLayout>
  );
}

interface EditorContentProps {
  /** Null when the page was opened via `/dashboard/gcode/new`. */
  fileId: string | null;
  jobId: string | null;
  printerId: string | null;
}

function EditorContent({ fileId, jobId, printerId }: EditorContentProps) {
  const navigate = useNavigate();
  const editorRef = React.useRef<ReactCodeMirrorRef | null>(null);
  const isNew = fileId === null;

  // In "new" mode we skip the metadata fetch entirely; meta starts as
  // `null` to signal "no file behind this editor yet". In "existing"
  // mode it starts undefined so the loading guard kicks in below.
  const [meta, setMeta] = React.useState<GcodeFile | null | undefined>(
    isNew ? null : undefined
  );
  const [original, setOriginal] = React.useState<string>("");
  const [content, setContent] = React.useState<string>("");
  const [filename, setFilename] = React.useState<string>(isNew ? "untitled.gcode" : "");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (isNew) return; // no fetch — start blank
    let cancelled = false;
    Promise.all([listGcodeFiles(), getGcodeContent(fileId!)])
      .then(([files, body]) => {
        if (cancelled) return;
        const m = files.find((f) => f.id === fileId) ?? null;
        setMeta(m);
        setOriginal(body);
        setContent(body);
        if (m) setFilename(m.originalFilename);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setMeta(null);
        } else {
          setError("Datei konnte nicht geladen werden.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fileId, isNew]);

  // In "new" mode any non-empty buffer counts as dirty. In "existing"
  // mode dirty means "drifted from what the server gave us".
  const dirty = isNew ? content.length > 0 : content !== original;
  const lineCount = React.useMemo(() => (content.match(/\n/g)?.length ?? 0) + 1, [content]);
  const byteSize = React.useMemo(() => new Blob([content]).size, [content]);

  /**
   * Block accidental tab-away while there are unsaved changes. We use
   * the `beforeunload` event because it's the only one browsers still
   * honour for a custom warning dialog (since 2018 the message itself
   * is ignored, but the prompt still shows).
   *
   * MUST live above the early returns below — React requires hooks to
   * run in the same order on every render, and an early return before
   * a hook would skip it on the loading paths.
   */
  React.useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    globalThis.addEventListener("beforeunload", handler);
    return () => globalThis.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // Loading / not-found guards only apply in existing-file mode — in
  // "new" mode `meta` is intentionally `null` (= no file behind the
  // editor yet) and we want to render the blank canvas right away.
  if (!isNew) {
    if (error && meta === undefined) return <p className="text-sm text-red-300">{error}</p>;
    if (meta === undefined) return <p className="text-sm text-slate-400">Lade…</p>;
    if (meta === null) return <p className="text-sm text-slate-400">Datei nicht gefunden.</p>;
  }

  function handleReset() {
    if (!dirty) return;
    const ok = globalThis.confirm("Änderungen verwerfen?");
    if (!ok) return;
    setContent(original);
  }

  async function handleSave() {
    setError(null);
    const trimmedName = filename.trim() || (meta?.originalFilename ?? "edit.gcode");
    if (content.length === 0) {
      setError("Datei darf nicht leer sein.");
      return;
    }
    if (!dirty) {
      setError("Keine Änderungen zum Speichern.");
      return;
    }
    setSaving(true);
    try {
      // Build a File from the editor buffer and reuse the existing
      // upload endpoint — server-side dedup on SHA-256 means saving
      // the exact same content twice in a row is a no-op (returns the
      // same row).
      const blob = new Blob([content], { type: "application/octet-stream" });
      const fileObj = new File([blob], trimmedName, { type: "application/octet-stream" });
      const created = await uploadGcodeFile(fileObj);

      // If we came from a job context, swap that job's g-code pointer
      // to the new file and bounce back to the queue. Otherwise we
      // navigate to the new file's editor URL so the user sees the
      // saved version immediately (and so the URL is shareable).
      if (jobId && printerId) {
        await replaceJobGcode(printerId, jobId, created.id);
        navigate(Routes.Dashboard.PrinterJobs.replace(":id", printerId));
        return;
      }
      navigate(`/dashboard/gcode/${created.id}/edit`, { replace: true });
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header strip with filename + meta + save bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <label htmlFor="gcode-filename" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Dateiname
          </label>
          <input
            id="gcode-filename"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 font-mono text-sm text-slate-100"
            maxLength={120}
          />
          <p className="mt-1 text-xs text-slate-500">
            {lineCount.toLocaleString("de-DE")} Zeilen · {(byteSize / 1024).toFixed(1)} KB
            {dirty && <span className="ml-2 text-amber-300">● ungespeichert</span>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={!dirty || saving}
            className="btn-outline btn-sm"
          >
            Zurücksetzen
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            className="btn btn-sm"
          >
            {saving
              ? "Speichere…"
              : isNew
              ? "Anlegen"
              : jobId
              ? "Speichern + im Job ersetzen"
              : "Als neue Version speichern"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      {/* The editor itself. `min-h` keeps it usable on mobile; on
          desktop the `lg:h-[70vh]` lets it eat most of the viewport. */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60">
        <CodeMirror
          ref={editorRef}
          value={content}
          height="60vh"
          extensions={EXTENSIONS}
          onChange={(v) => setContent(v)}
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            highlightActiveLine: true,
            highlightActiveLineGutter: true,
            bracketMatching: false,
            autocompletion: false,
            indentOnInput: false
          }}
          theme="dark"
        />
      </div>

      {/* Tiny help footer — saves a confused user from hunting through
          docs to figure out why their G/M-codes are coloured. */}
      <p className="text-xs text-slate-500">
        Highlighting:{" "}
        <span className="font-mono text-cyan-300">G/M</span>-Befehle ·{" "}
        <span className="font-mono text-amber-300">X/Y/Z/E/F</span>-Achsen ·{" "}
        <span className="font-mono text-slate-500 italic">; Kommentare</span>
      </p>
    </div>
  );
}
