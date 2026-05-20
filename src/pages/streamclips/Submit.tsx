import * as React from "react";
import { Link } from "react-router-dom";
import { Routes } from "../../config/routes";
import { StreamclipsNav } from "../../components/streamclips/StreamclipsNav";
import {
  getMe,
  submitClip,
  loginToTwitch,
  ApiError,
  type User
} from "../../services";

const TWITCH_BTN =
  "inline-flex items-center justify-center gap-2 rounded-full bg-[#9146FF] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#772ce8] disabled:opacity-50";

/**
 * Clip einreichen. Erfordert `clips.submit` (analog zur kuratierten
 * Druckanfrage) — Bewerten ist offen, Einreichen ist freigeschaltet.
 */
export function SubmitClipPage() {
  const [me, setMe] = React.useState<User | null | undefined>(undefined);

  React.useEffect(() => {
    getMe().then(setMe).catch(() => setMe(null));
  }, []);

  if (me === undefined) return <Shell><p className="text-sm text-slate-400">Lade…</p></Shell>;

  if (!me) {
    return (
      <Shell>
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <p className="text-sm text-slate-300">Melde dich mit Twitch an, um Clips einzureichen.</p>
          <button type="button" onClick={() => loginToTwitch()} className={TWITCH_BTN}>
            Mit Twitch anmelden
          </button>
        </div>
      </Shell>
    );
  }

  const allowed = me.permissions?.some(
    (p) => p === "clips.submit" || p === "clips.moderate" || p === "admin.manage"
  );

  if (!allowed) {
    return (
      <Shell>
        <p className="text-sm text-slate-400">
          Das Einreichen von Clips ist für freigeschaltete Nutzer reserviert. Bewerten kannst du{" "}
          <Link to={Routes.Streamclips.Vote} className="text-[#bf94ff] hover:underline">jederzeit</Link>.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <SubmitForm />
    </Shell>
  );
}

function SubmitForm() {
  const [url, setUrl] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (url.trim().length === 0) {
      setError("Bitte einen Twitch-Clip-Link einfügen.");
      return;
    }
    setBusy(true);
    try {
      const clip = await submitClip(url.trim());
      setSuccess(`„${clip.title}" eingereicht — wird nach Freigabe im Vote-Feed erscheinen.`);
      setUrl("");
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Einreichen fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
      <div>
        <label htmlFor="clip-url" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
          Twitch-Clip-Link
        </label>
        <input
          id="clip-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://clips.twitch.tv/… oder https://twitch.tv/kanal/clip/…"
          className="mt-1 block w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
        />
        <p className="mt-1 text-xs text-slate-500">
          Titel, Kategorie, Vorschaubild & Co. holen wir automatisch von Twitch.
        </p>
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}
      {success && <p className="text-sm text-emerald-300">{success}</p>}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className={TWITCH_BTN}>
          {busy ? "Reiche ein…" : "Clip einreichen"}
        </button>
        <Link to={Routes.Streamclips.Me} className="text-xs text-slate-400 hover:text-slate-200">
          Meine Clips →
        </Link>
      </div>
    </form>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-950 pt-20 pb-16 sm:pt-24" id="top">
      <div className="mx-auto max-w-2xl px-4 pt-6 sm:px-6 sm:pt-12 lg:pt-16">
        <header className="mb-6 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#bf94ff] sm:tracking-[0.3em]">
            Streamclips Germany 🇩🇪
          </p>
          <h1 className="text-2xl font-semibold text-slate-50 sm:text-3xl">Clip einreichen</h1>
        </header>
        <StreamclipsNav />
        {children}
      </div>
    </main>
  );
}
