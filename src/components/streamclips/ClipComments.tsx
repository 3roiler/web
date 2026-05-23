import * as React from "react";
import { Link } from "react-router-dom";
import { Routes } from "../../config/routes";
import {
  listClipComments,
  postClipComment,
  deleteClipComment,
  getMe,
  loginToTwitch,
  ApiError,
  type ClipComment,
  type User
} from "../../services";

interface ClipCommentsProps {
  clipId: string;
  /** Wird gerufen, wenn der User auf einen Timestamp klickt. Eltern-
   *  Element soll den Player auf diese Sekunde springen lassen. */
  onSeek: (seconds: number) => void;
}

function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.round(ms / 1000);
  if (sec < 60) return 'gerade eben';
  const min = Math.round(sec / 60);
  if (min < 60) return `vor ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} h`;
  const days = Math.round(h / 24);
  if (days < 30) return `vor ${days} Tag${days === 1 ? '' : 'en'}`;
  return new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Linkifies inline timestamps wie `2:34` oder `1:02:15` im Kommentar-Body.
 * Klick triggert `onSeek(seconds)`. Wir parsen mit einem konservativen
 * Regex — keine HTML-Injection-Vektoren, weil wir nur Plaintext-Fragmente
 * und Buttons rendern.
 */
function renderBodyWithTimestamps(body: string, onSeek: (s: number) => void): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    if (match.index > last) {
      parts.push(body.slice(last, match.index));
    }
    const a = Number(match[1]);
    const b = Number(match[2]);
    const c = match[3] === undefined ? null : Number(match[3]);
    // `1:02:15` → h:m:s. `2:34` → m:s. Wir behandeln >=60 in der mittleren
    // Position als ungültig (also als reinen Text durchreichen).
    let totalSeconds: number | null = null;
    if (c !== null) {
      if (b < 60 && c < 60) totalSeconds = a * 3600 + b * 60 + c;
    } else {
      if (b < 60) totalSeconds = a * 60 + b;
    }
    if (totalSeconds !== null) {
      const seconds = totalSeconds; // type-narrow für die closure unten
      parts.push(
        <button
          key={`ts-${match.index}`}
          type="button"
          onClick={() => onSeek(seconds)}
          className="font-mono text-cyan-300 transition hover:text-cyan-200"
        >
          {match[0]}
        </button>
      );
    } else {
      parts.push(match[0]);
    }
    last = match.index + match[0].length;
  }
  if (last < body.length) parts.push(body.slice(last));
  return parts;
}

/**
 * Liest den ersten `m:ss`/`h:mm:ss`-Match im Body und konvertiert ihn in
 * Sekunden. So bekommt der Kommentar einen strukturierten timestampSeconds-
 * Wert, auch ohne dedizierten Input — die Sprungmarke ganz oben in der
 * Liste kommt von hier.
 */
function extractFirstTimestamp(body: string): number | null {
  const re = /\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/;
  const m = re.exec(body);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  const c = m[3] === undefined ? null : Number(m[3]);
  if (c !== null) {
    if (b >= 60 || c >= 60) return null;
    return a * 3600 + b * 60 + c;
  }
  if (b >= 60) return null;
  return a * 60 + b;
}

export function ClipComments({ clipId, onSeek }: ClipCommentsProps) {
  const [comments, setComments] = React.useState<ClipComment[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [me, setMe] = React.useState<User | null>(null);
  const [body, setBody] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [postError, setPostError] = React.useState<string | null>(null);

  React.useEffect(() => {
    getMe().then(setMe).catch(() => setMe(null));
  }, []);

  const reload = React.useCallback(() => {
    listClipComments(clipId)
      .then(setComments)
      .catch((err: unknown) => {
        console.error(err);
        setError(err instanceof ApiError ? err.message : 'Kommentare konnten nicht geladen werden.');
      });
  }, [clipId]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setPostError(null);
    try {
      // Den ersten `m:ss`-Match im Text als strukturierten Timestamp
      // mitschicken. So bekommt der Kommentar eine sichtbare „@m:ss"-
      // Sprungmarke neben dem Autor — der UX-Anker, der den Unterschied
      // zwischen „Forum" und „Kommentare mit Timing" ausmacht.
      const ts = extractFirstTimestamp(trimmed);
      await postClipComment(clipId, trimmed, ts);
      setBody('');
      reload();
    } catch (err: unknown) {
      console.error(err);
      setPostError(err instanceof ApiError ? err.message : 'Kommentar konnte nicht gepostet werden.');
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(commentId: string) {
    try {
      await deleteClipComment(commentId);
      reload();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : 'Löschen fehlgeschlagen.');
    }
  }

  const isMod = Boolean(
    me?.permissions?.some((p) => p === 'clips.moderate' || p === 'admin.manage')
  );

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
          Kommentare
        </h2>
        <span className="text-xs text-slate-500">
          {comments?.length ?? 0} {(comments?.length ?? 0) === 1 ? 'Kommentar' : 'Kommentare'}
        </span>
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      {me ? (
        <form
          onSubmit={submit}
          className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4"
        >
          <label htmlFor="comment-body" className="sr-only">Kommentar</label>
          <textarea
            id="comment-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Was möchtest du dazu sagen? `1:23` im Text wird automatisch zum Sprung-Link."
            className="block w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-400/40 focus:outline-none"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Tipp: <code className="font-mono text-cyan-300">1:23</code> im Text wird automatisch
              zum Sprung-Link auf diese Stelle.
            </p>
            <button
              type="submit"
              disabled={submitting || body.trim().length === 0}
              className="btn-sm disabled:opacity-50"
            >
              {submitting ? 'Sende…' : 'Kommentieren'}
            </button>
          </div>
          {postError && <p className="text-xs text-red-300">{postError}</p>}
        </form>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
          <p className="text-sm text-slate-400">Anmelden, um zu kommentieren.</p>
          <button
            type="button"
            onClick={() => loginToTwitch()}
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-full bg-[#9146FF] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#772ce8]"
          >
            Mit Twitch anmelden
          </button>
        </div>
      )}

      {comments === null && !error && <p className="text-sm text-slate-400">Lade Kommentare…</p>}
      {comments !== null && comments.length === 0 && (
        <p className="text-sm text-slate-500">Noch keine Kommentare. Mach den Anfang.</p>
      )}

      <ul className="space-y-3">
        {comments?.map((c) => {
          const isAuthor = me?.id === c.userId;
          return (
            <li key={c.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3">
                {c.authorAvatarUrl ? (
                  <img
                    src={c.authorAvatarUrl}
                    alt=""
                    className="h-8 w-8 rounded-full border border-white/10 bg-slate-900 object-cover"
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-slate-900 text-xs text-slate-300">
                    {(c.authorDisplayName ?? c.authorName).slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <Link
                    to={Routes.Profile}
                    className="truncate text-sm font-semibold text-slate-100 hover:text-cyan-200"
                  >
                    {c.authorDisplayName ?? c.authorName}
                  </Link>
                  <p className="text-[0.7rem] text-slate-500">{formatRelative(c.createdAt)}</p>
                </div>
                {c.timestampSeconds !== null && (
                  <button
                    type="button"
                    onClick={() => onSeek(c.timestampSeconds ?? 0)}
                    className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[0.7rem] text-cyan-200 transition hover:bg-cyan-500/20"
                    aria-label={`Bei ${formatTimestamp(c.timestampSeconds)} ansehen`}
                  >
                    @ {formatTimestamp(c.timestampSeconds)}
                  </button>
                )}
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-200">
                {renderBodyWithTimestamps(c.body, onSeek)}
              </p>
              {(isAuthor || isMod) && (
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => onDelete(c.id)}
                    className="text-[0.7rem] text-slate-500 transition hover:text-red-300"
                  >
                    Löschen
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
