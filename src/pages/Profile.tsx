import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getMe,
  updateMe,
  loginToGithub,
  ApiError,
  type SocialLink,
  type SocialLinkInput,
  type User
} from "../services";
import { Routes } from "../config/routes";
import { safeHttpUrl } from "../lib/url";

/**
 * Self-service profile page for the logged-in user. Lets them edit
 * displayName + social links; the avatar is pulled from the OAuth provider
 * automatically on each login, so we only show it here (no upload).
 *
 * Login-name (`name`) and email remain admin-only for identity reasons —
 * changing either would invalidate OAuth linkage / ADMIN_EMAILS matching.
 */
const SOCIAL_LINKS_MAX = 12;
const LABEL_MAX = 60;

export function ProfilePage() {
  const navigate = useNavigate();
  const [me, setMe] = React.useState<User | null | undefined>(undefined);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    getMe()
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  if (me === undefined) {
    return (
      <main className="min-h-screen bg-slate-950 py-24">
        <div className="mx-auto max-w-3xl px-6 sm:px-10 lg:px-16 pt-16 text-sm text-slate-400">
          Lade…
        </div>
      </main>
    );
  }

  if (!me) {
    return (
      <main className="min-h-screen bg-slate-950 py-24">
        <div className="mx-auto max-w-3xl px-6 sm:px-10 lg:px-16 pt-16">
          <p className="text-sm text-slate-300">
            Du bist nicht angemeldet. Melde dich an, um dein Profil zu bearbeiten.
          </p>
          <div className="mt-6 flex gap-3">
            <button type="button" onClick={() => loginToGithub()} className="btn">
              Mit GitHub anmelden
            </button>
            <button type="button" onClick={() => navigate(Routes.Home)} className="btn-outline">
              Zur Startseite
            </button>
          </div>
        </div>
      </main>
    );
  }

  return <ProfileForm initial={me} error={error} setError={setError} />;
}

interface ProfileFormProps {
  initial: User;
  error: string | null;
  setError: (msg: string | null) => void;
}

function ProfileForm({ initial, error, setError }: ProfileFormProps) {
  const [displayName, setDisplayName] = React.useState(
    initial.displayName ?? initial.display_name ?? ""
  );
  const [avatarUrl, setAvatarUrl] = React.useState(initial.avatarUrl ?? "");
  const [links, setLinks] = React.useState<SocialLinkInput[]>(
    (initial.socialLinks ?? []).map((l: SocialLink) => ({ label: l.label, url: l.url }))
  );
  const [saving, setSaving] = React.useState(false);
  const [success, setSuccess] = React.useState(false);

  function updateLink(index: number, patch: Partial<SocialLinkInput>) {
    setLinks((prev) => prev.map((link, i) => (i === index ? { ...link, ...patch } : link)));
  }

  function addLink() {
    if (links.length >= SOCIAL_LINKS_MAX) return;
    setLinks((prev) => [...prev, { label: "", url: "" }]);
  }

  function removeLink(index: number) {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  }

  function moveLink(index: number, delta: -1 | 1) {
    setLinks((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Client-side URL check so the user gets immediate feedback; the API
    // re-validates anyway.
    for (const [i, link] of links.entries()) {
      if (!link.label.trim() || !link.url.trim()) {
        setError(`Social-Link #${i + 1}: Label und URL sind Pflicht.`);
        return;
      }
      try {
        const url = new URL(link.url);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          setError(`Social-Link #${i + 1}: URL muss mit http:// oder https:// beginnen.`);
          return;
        }
      } catch {
        setError(`Social-Link #${i + 1}: ungültige URL.`);
        return;
      }
    }

    setSaving(true);
    try {
      await updateMe({
        displayName: displayName.trim() === "" ? null : displayName.trim(),
        avatarUrl: avatarUrl.trim() === "" ? null : avatarUrl.trim(),
        socialLinks: links.map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
      });
      setSuccess(true);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 py-24" id="top">
      <div className="mx-auto max-w-3xl px-6 sm:px-10 lg:px-16 pt-16">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">Profil</p>
        <h1 className="mt-4 text-4xl font-semibold text-slate-50 sm:text-5xl">Dein Profil</h1>
        <p className="mt-3 max-w-xl text-sm text-slate-400">
          Anzeigename und Social-Links kannst du hier selbst ändern. Das Profilbild wird bei jedem
          Login von deinem OAuth-Provider (GitHub) übernommen — du kannst es aber manuell
          überschreiben.
        </p>

        <form onSubmit={handleSubmit} className="mt-10 space-y-8">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <AvatarPreview url={avatarUrl || null} name={initial.name} />
              <div className="flex-1 space-y-4">
                <div>
                  <label
                    htmlFor="display-name"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
                  >
                    Anzeigename
                  </label>
                  <input
                    id="display-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                    maxLength={100}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Login-Name: <code className="font-mono">@{initial.name}</code> (Admin-only)
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="avatar-url"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
                  >
                    Avatar-URL
                  </label>
                  <input
                    id="avatar-url"
                    type="url"
                    placeholder="leer → automatisch von GitHub"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Leer lassen, um das GitHub-Avatar zu nutzen. Bei jedem Login wird das
                    OAuth-Avatar nachgezogen, außer du hast hier eine eigene URL hinterlegt.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">Social-Links</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Max. {SOCIAL_LINKS_MAX} Einträge. Nur http(s).
                </p>
              </div>
              <button
                type="button"
                onClick={addLink}
                disabled={links.length >= SOCIAL_LINKS_MAX}
                className="btn-outline btn-sm disabled:opacity-40"
              >
                + Link
              </button>
            </div>

            {links.length === 0 && (
              <p className="mt-4 text-xs text-slate-500">
                Noch keine Links. Klick „+ Link", um einen hinzuzufügen.
              </p>
            )}

            <ul className="mt-4 space-y-3">
              {links.map((link, index) => (
                <li key={index} className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-center">
                    <input
                      type="text"
                      value={link.label}
                      onChange={(e) => updateLink(index, { label: e.target.value })}
                      placeholder="Label (z. B. GitHub)"
                      maxLength={LABEL_MAX}
                      className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                    />
                    <input
                      type="url"
                      value={link.url}
                      onChange={(e) => updateLink(index, { url: e.target.value })}
                      placeholder="https://…"
                      className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                    />
                    <div className="flex gap-1 justify-end">
                      <button
                        type="button"
                        onClick={() => moveLink(index, -1)}
                        disabled={index === 0}
                        className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-400 disabled:opacity-30"
                        aria-label="Nach oben"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveLink(index, 1)}
                        disabled={index === links.length - 1}
                        className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-400 disabled:opacity-30"
                        aria-label="Nach unten"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeLink(index)}
                        className="rounded-lg border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-200"
                        aria-label="Entfernen"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {error && <p className="text-sm text-red-300">{error}</p>}
          {success && <p className="text-sm text-cyan-300">Profil gespeichert.</p>}

          <div className="flex items-center gap-3">
            <button type="submit" className="btn" disabled={saving}>
              {saving ? "Speichere…" : "Speichern"}
            </button>
            <Link to={Routes.Home} className="btn-outline">
              Zurück
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}

interface AvatarPreviewProps {
  url: string | null;
  name: string;
}

function AvatarPreview({ url, name }: AvatarPreviewProps) {
  const [broken, setBroken] = React.useState(false);
  const initial = (name || "?").slice(0, 1).toUpperCase();
  const safeUrl = safeHttpUrl(url);

  if (!safeUrl || broken) {
    return (
      <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-slate-900 text-3xl font-semibold text-slate-300">
        {initial}
      </div>
    );
  }
  return (
    <img
      src={safeUrl}
      alt="Avatar"
      onError={() => setBroken(true)}
      className="h-24 w-24 flex-shrink-0 rounded-full border border-white/10 bg-slate-900 object-cover"
    />
  );
}
