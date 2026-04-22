import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { DashboardLayout } from "../components/DashboardLayout";
import { Routes } from "../config/routes";
import { createPrinter, ApiError, type PrinterWithRole } from "../services";

const NAME_MAX = 60;
const MODEL_MAX = 60;

export function PrinterNewPage() {
  return (
    <DashboardLayout
      requiredPermission="dashboard.printers"
      kicker="Dashboard · Drucker"
      title="Neuer Drucker"
      description={
        <>
          Registriere einen 3D-Drucker. Nach dem Anlegen wird der einmalige
          Agent-Token angezeigt — diesen musst du auf deinem Drucker-Host in
          der Agent-Config hinterlegen.
        </>
      }
    >
      {() => <PrinterNewForm />}
    </DashboardLayout>
  );
}

function PrinterNewForm() {
  const navigate = useNavigate();
  const [name, setName] = React.useState("");
  const [model, setModel] = React.useState("Anycubic Kobra 3 V2");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState<{ printer: PrinterWithRole; token: string } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim();
    const trimmedModel = model.trim();
    if (!trimmed) {
      setError("Name ist erforderlich.");
      return;
    }
    if (!trimmedModel) {
      setError("Modell ist erforderlich.");
      return;
    }

    setBusy(true);
    try {
      const result = await createPrinter({ name: trimmed, model: trimmedModel });
      setCreated({ printer: result.printer, token: result.agentToken });
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Drucker konnte nicht angelegt werden.");
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <TokenReveal
        token={created.token}
        onContinue={() =>
          navigate(Routes.Dashboard.PrinterDetail.replace(":id", created.printer.id))
        }
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
        <div>
          <label htmlFor="printer-name" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Name
          </label>
          <input
            id="printer-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={NAME_MAX}
            required
            placeholder="z. B. Keller-Drucker"
            className="mt-1 block w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
          />
        </div>
        <div>
          <label htmlFor="printer-model" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Modell
          </label>
          <input
            id="printer-model"
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            maxLength={MODEL_MAX}
            required
            className="mt-1 block w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
          />
          <p className="mt-1 text-xs text-slate-500">
            Freitext. Wird nur fürs Dashboard angezeigt.
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <div className="flex items-center gap-3">
        <button type="submit" className="btn" disabled={busy}>
          {busy ? "Lege an…" : "Drucker anlegen"}
        </button>
        <Link to={Routes.Dashboard.Printers} className="btn-outline">
          Abbrechen
        </Link>
      </div>
    </form>
  );
}

interface TokenRevealProps {
  token: string;
  onContinue: () => void;
}

function TokenReveal({ token, onContinue }: TokenRevealProps) {
  const [copied, setCopied] = React.useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      globalThis.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: user must select + copy manually.
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-6">
        <p className="text-sm font-semibold text-amber-200">
          Einmalig sichtbarer Agent-Token
        </p>
        <p className="mt-2 text-xs text-amber-100/80">
          Kopiere den Token jetzt und hinterlege ihn in der Agent-Config auf dem
          Drucker-Host. Nach dem Verlassen dieser Seite ist er nicht mehr
          abrufbar — du musst ihn ggf. rotieren und neu verteilen.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <code className="block break-all font-mono text-xs text-slate-200">{token}</code>
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={handleCopy} className="btn">
          {copied ? "Kopiert ✓" : "Token kopieren"}
        </button>
        <button type="button" onClick={onContinue} className="btn-outline">
          Weiter zum Drucker
        </button>
      </div>
    </div>
  );
}
