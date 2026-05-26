import * as React from "react";
import { formatBytes } from "../lib/asset-helpers";

export interface UploadCardProps {
  /** H3 in the card header. */
  title: string;
  /** Sub-headline below the title — explains what's accepted, formatting hints, etc. */
  hint: React.ReactNode;
  /** `accept` value passed to the underlying `<input type="file">`. */
  accept: string;
  /** Server-enforced size cap (used both for the prompt and the client-side reject). */
  maxBytes: number;
  /** Caller-provided upload handler. Returning a rejected promise surfaces the error
   *  via `errorMessage` to the parent — we don't render errors ourselves so the
   *  caller can place them wherever fits the page layout. */
  onUpload: (file: File) => Promise<void>;
  /** Caller-provided "size too large" / "empty file" pre-flight error setter. */
  onPreflightError?: (msg: string) => void;
}

/**
 * Single-file upload card used by both `Gcode.tsx` and `Stl.tsx`.
 *
 * Owns the file input, busy state, client-side size guard and reset on
 * success. Doesn't know what it's uploading — the parent passes the
 * `accept` filter and the actual upload-mutation, so this component
 * stays generic enough to drop into any future "asset library" page.
 */
export function UploadCard({
  title,
  hint,
  accept,
  maxBytes,
  onUpload,
  onPreflightError
}: UploadCardProps) {
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  async function handleFile(file: File) {
    if (file.size === 0) {
      onPreflightError?.("Datei ist leer.");
      return;
    }
    if (file.size > maxBytes) {
      onPreflightError?.(`Datei zu groß (${formatBytes(file.size)} > ${formatBytes(maxBytes)}).`);
      return;
    }
    setUploading(true);
    try {
      await onUpload(file);
      // Clear input so re-selecting the same filename re-fires onChange.
      if (inputRef.current) inputRef.current.value = "";
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
      <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
      <p className="mt-1 text-xs text-slate-500">
        Max. {formatBytes(maxBytes)}. {hint}
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
          className="block text-sm text-slate-300 file:mr-3 file:rounded-full file:border-0 file:bg-cyan-500/20 file:px-4 file:py-1.5 file:text-xs file:font-semibold file:text-cyan-200 hover:file:bg-cyan-500/30"
        />
        {uploading && <span className="text-xs text-cyan-300">Lade hoch…</span>}
      </div>
    </section>
  );
}
