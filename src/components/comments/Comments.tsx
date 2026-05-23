import * as React from "react";
import { Link } from "react-router-dom";
import { Routes } from "../../config/routes";
import {
  listClipComments,
  postClipComment,
  listBlogComments,
  postBlogComment,
  deleteClipComment,
  moderateDeleteComment,
  restoreComment,
  muteUserForComments,
  getMe,
  ApiError,
  type Comment,
  type User,
  type CommentTargetType
} from "../../services";

const ANONYMIZED_NAME_CHECK = "Gelöschter Nutzer";

export interface CommentsProps {
  targetType: CommentTargetType;
  /** Bei Clips die UUID, bei Blog-Posts der Slug — der Service-Wrapper
   *  kennt den richtigen Endpunkt. */
  targetKey: string;
  /** Optional: Callback wenn der User auf einen Timestamp klickt
   *  (nur für Clip-Targets relevant). */
  onSeek?: (seconds: number) => void;
}

/* ───── Utilities ──────────────────────────────────────────────────── */

function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
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

function renderBodyWithTimestamps(body: string, onSeek?: (s: number) => void): React.ReactNode[] {
  if (!onSeek) return [body];
  const parts: React.ReactNode[] = [];
  const re = /\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    if (match.index > last) parts.push(body.slice(last, match.index));
    const a = Number(match[1]);
    const b = Number(match[2]);
    const c = match[3] === undefined ? null : Number(match[3]);
    let totalSeconds: number | null = null;
    if (c !== null) {
      if (b < 60 && c < 60) totalSeconds = a * 3600 + b * 60 + c;
    } else if (b < 60) {
      totalSeconds = a * 60 + b;
    }
    if (totalSeconds !== null) {
      const seconds = totalSeconds;
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

/* ───── Tree-Building ──────────────────────────────────────────────── */

interface CommentNode {
  comment: Comment;
  replies: CommentNode[];
}

function buildTree(comments: Comment[]): CommentNode[] {
  const byId = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];
  // Erste Pass: alle Nodes anlegen
  for (const c of comments) {
    byId.set(c.id, { comment: c, replies: [] });
  }
  // Zweite Pass: Parent-Beziehungen verkabeln
  for (const c of comments) {
    const node = byId.get(c.id)!;
    if (c.parentCommentId && byId.has(c.parentCommentId)) {
      byId.get(c.parentCommentId)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/* ───── Hauptkomponente ────────────────────────────────────────────── */

export function Comments({ targetType, targetKey, onSeek }: CommentsProps) {
  const [comments, setComments] = React.useState<Comment[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [me, setMe] = React.useState<User | null>(null);
  const [body, setBody] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [postError, setPostError] = React.useState<string | null>(null);

  React.useEffect(() => {
    getMe().then(setMe).catch(() => setMe(null));
  }, []);

  const reload = React.useCallback(() => {
    const fetcher = targetType === 'clip' ? listClipComments : listBlogComments;
    fetcher(targetKey)
      .then(setComments)
      .catch((err: unknown) => {
        console.error(err);
        setError(err instanceof ApiError ? err.message : 'Kommentare konnten nicht geladen werden.');
      });
  }, [targetType, targetKey]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  async function submitTop(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setPostError(null);
    try {
      if (targetType === 'clip') {
        const ts = extractFirstTimestamp(trimmed);
        await postClipComment(targetKey, trimmed, ts, null);
      } else {
        await postBlogComment(targetKey, trimmed, null);
      }
      setBody('');
      reload();
    } catch (err: unknown) {
      console.error(err);
      setPostError(err instanceof ApiError ? err.message : 'Kommentar konnte nicht gepostet werden.');
    } finally {
      setSubmitting(false);
    }
  }

  const isMod = Boolean(
    me?.permissions?.some((p) => p === 'clips.moderate' || p === 'admin.manage')
  );

  const tree = React.useMemo(() => (comments ? buildTree(comments) : []), [comments]);
  const visibleCount = comments?.length ?? 0;

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
          Kommentare
        </h2>
        <span className="text-xs text-slate-500">
          {visibleCount} {visibleCount === 1 ? 'Kommentar' : 'Kommentare'}
        </span>
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      {me ? (
        <form
          onSubmit={submitTop}
          className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4"
        >
          <label htmlFor="comment-body" className="sr-only">Kommentar</label>
          <textarea
            id="comment-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder={
              targetType === 'clip'
                ? 'Was möchtest du dazu sagen? `1:23` im Text wird automatisch zum Sprung-Link.'
                : 'Was möchtest du dazu sagen?'
            }
            className="block w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-400/40 focus:outline-none"
          />
          <div className="flex justify-end">
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
        <p className="text-xs text-slate-500">Zum Kommentieren musst du angemeldet sein.</p>
      )}

      {comments === null && !error && <p className="text-sm text-slate-400">Lade Kommentare…</p>}
      {comments !== null && comments.length === 0 && (
        <p className="text-sm text-slate-500">Noch keine Kommentare. Mach den Anfang.</p>
      )}

      <ul className="space-y-3">
        {tree.map((node) => (
          <CommentItem
            key={node.comment.id}
            node={node}
            me={me}
            isMod={isMod}
            targetType={targetType}
            targetKey={targetKey}
            onSeek={onSeek}
            onChanged={reload}
            depth={0}
          />
        ))}
      </ul>
    </section>
  );
}

/* ───── Einzelner Kommentar (rekursiv) ─────────────────────────────── */

interface CommentItemProps {
  node: CommentNode;
  me: User | null;
  isMod: boolean;
  targetType: CommentTargetType;
  targetKey: string;
  onSeek?: (seconds: number) => void;
  onChanged: () => void;
  depth: number;
}

/**
 * Maximale visuelle Indent-Stufe. Backend erlaubt beliebige Threading-
 * Tiefe (Reddit-Style); die visuelle Treppe stoppt aber bei 5 — danach
 * wird flach weiterindentiert. Logisch bleibt der Baum komplett (jeder
 * Knoten weiß seinen `parentCommentId`), nur der `border-l`-Indent
 * wächst nicht weiter, damit Mobile-Viewports nicht hinten überlaufen.
 */
const MAX_VISUAL_INDENT_DEPTH = 5;

function CommentItem({ node, me, isMod, targetType, targetKey, onSeek, onChanged, depth }: CommentItemProps) {
  const { comment, replies } = node;
  const isAuthor = me?.id === comment.userId;
  const isModeratedDelete = comment.deletedAt !== null && comment.deletionReason !== null;
  const isSelfDelete = comment.deletedAt !== null && comment.deletionReason === null;
  const isDeletedAuthor =
    (comment.authorDeletedAt !== null && comment.authorDeletedAt !== undefined) ||
    (comment.authorDisplayName ?? comment.authorName) === ANONYMIZED_NAME_CHECK;

  const [replyOpen, setReplyOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const [modOpen, setModOpen] = React.useState(false);
  const [muteOpen, setMuteOpen] = React.useState(false);

  const displayName = isDeletedAuthor
    ? 'Gelöschter Nutzer'
    : (comment.authorDisplayName ?? comment.authorName);
  const avatarUrl = isDeletedAuthor ? null : comment.authorAvatarUrl;

  // Visuelles Indent nur bis MAX_VISUAL_INDENT_DEPTH. Darunter behält
  // jeder Reply die Border-Left-Linie, hat aber kein zusätzliches
  // Padding mehr.
  const indentClass = depth > 0 ? 'border-l-2 border-white/10 pl-4 sm:pl-6' : '';

  return (
    <li className={indentClass}>
      <div
        className={
          isModeratedDelete || isSelfDelete
            ? 'rounded-2xl border border-white/5 bg-white/[0.02] p-4 italic'
            : 'rounded-2xl border border-white/10 bg-white/5 p-4'
        }
      >
        <div className="flex items-center gap-3">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="h-8 w-8 rounded-full border border-white/10 bg-slate-900 object-cover"
            />
          ) : (
            <span
              className={
                isDeletedAuthor
                  ? 'flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-slate-900/60 text-xs text-slate-500'
                  : 'flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-slate-900 text-xs text-slate-300'
              }
            >
              {isDeletedAuthor ? '×' : displayName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className={
              isDeletedAuthor
                ? 'truncate text-sm font-semibold text-slate-500'
                : 'truncate text-sm font-semibold text-slate-100'
            }>
              {displayName}
            </p>
            <p className="text-[0.7rem] text-slate-500">{formatRelative(comment.createdAt)}</p>
          </div>
          {comment.timestampSeconds !== null && onSeek && !isModeratedDelete && !isSelfDelete && (
            <button
              type="button"
              onClick={() => onSeek(comment.timestampSeconds ?? 0)}
              className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[0.7rem] text-cyan-200 transition hover:bg-cyan-500/20"
            >
              @ {formatTimestamp(comment.timestampSeconds)}
            </button>
          )}
          {replies.length > 0 && (
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="text-[0.7rem] text-slate-500 transition hover:text-slate-300"
              aria-expanded={!collapsed}
            >
              {collapsed ? `▸ ${replies.length}` : `▾ ${replies.length}`}
            </button>
          )}
        </div>

        {isModeratedDelete ? (
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            <span className="font-semibold text-red-300">Gelöscht durch Moderator.</span>{' '}
            <span className="text-slate-500">Grund:</span>{' '}
            <span>{comment.deletionReason}</span>
          </p>
        ) : isSelfDelete ? (
          <p className="mt-3 text-sm text-slate-500">Kommentar vom Autor gelöscht.</p>
        ) : (
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-200">
            {renderBodyWithTimestamps(comment.body, onSeek)}
          </p>
        )}

        {/* Aktionen — Reply nur bei Top-Level (depth 0), eigenes Löschen,
            Mod-Actions. */}
        <div className="mt-2 flex flex-wrap items-center justify-end gap-3 text-[0.7rem]">
          {!isModeratedDelete && !isSelfDelete && me && (
            <button
              type="button"
              onClick={() => setReplyOpen((o) => !o)}
              className="text-slate-500 transition hover:text-cyan-300"
            >
              {replyOpen ? 'Abbrechen' : 'Antworten'}
            </button>
          )}
          {!isModeratedDelete && isAuthor && !isSelfDelete && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await deleteClipComment(comment.id);
                  onChanged();
                } catch (err) {
                  console.error(err);
                }
              }}
              className="text-slate-500 transition hover:text-red-300"
            >
              Löschen
            </button>
          )}
          {isMod && !isModeratedDelete && (
            <button
              type="button"
              onClick={() => setModOpen(true)}
              className="text-slate-500 transition hover:text-red-300"
            >
              Mod-Löschen
            </button>
          )}
          {isMod && isModeratedDelete && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await restoreComment(comment.id);
                  onChanged();
                } catch (err) {
                  console.error(err);
                }
              }}
              className="text-slate-500 transition hover:text-emerald-300"
            >
              Wiederherstellen
            </button>
          )}
          {isMod && !isDeletedAuthor && comment.userId !== me?.id && (
            <button
              type="button"
              onClick={() => setMuteOpen(true)}
              className="text-slate-500 transition hover:text-orange-300"
            >
              User muten
            </button>
          )}
        </div>

        {modOpen && (
          <ModerateDeleteForm
            commentId={comment.id}
            onClose={() => setModOpen(false)}
            onDone={() => { setModOpen(false); onChanged(); }}
          />
        )}

        {muteOpen && (
          <MuteUserForm
            userId={comment.userId}
            userName={displayName}
            onClose={() => setMuteOpen(false)}
          />
        )}

        {replyOpen && me && (
          <ReplyForm
            targetType={targetType}
            targetKey={targetKey}
            parentCommentId={comment.id}
            onCancel={() => setReplyOpen(false)}
            onPosted={() => { setReplyOpen(false); onChanged(); }}
          />
        )}
      </div>

      {/* Replies — bei collapsed ausgeblendet, sonst rekursiv. Tiefe
          wird beim Indent gecappt: nach MAX_VISUAL_INDENT_DEPTH bleibt
          die border-l-Linie, das Padding aber nicht. So kann der Baum
          beliebig tief gehen ohne dass die UI nach links/rechts läuft. */}
      {replies.length > 0 && !collapsed && (
        <ul className="mt-3 space-y-3">
          {replies.map((reply) => (
            <CommentItem
              key={reply.comment.id}
              node={reply}
              me={me}
              isMod={isMod}
              targetType={targetType}
              targetKey={targetKey}
              onSeek={onSeek}
              onChanged={onChanged}
              depth={Math.min(depth + 1, MAX_VISUAL_INDENT_DEPTH)}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/* ───── Reply-Form ─────────────────────────────────────────────────── */

function ReplyForm({
  targetType,
  targetKey,
  parentCommentId,
  onCancel,
  onPosted
}: {
  targetType: CommentTargetType;
  targetKey: string;
  parentCommentId: string;
  onCancel: () => void;
  onPosted: () => void;
}) {
  const [body, setBody] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setErr(null);
    try {
      if (targetType === 'clip') {
        const ts = extractFirstTimestamp(trimmed);
        await postClipComment(targetKey, trimmed, ts, parentCommentId);
      } else {
        await postBlogComment(targetKey, trimmed, parentCommentId);
      }
      setBody('');
      onPosted();
    } catch (e: unknown) {
      console.error(e);
      setErr(e instanceof ApiError ? e.message : 'Antwort fehlgeschlagen.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-2 rounded-xl border border-white/10 bg-slate-950/40 p-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        maxLength={2000}
        placeholder="Antwort schreiben…"
        className="block w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-400/40 focus:outline-none"
      />
      {err && <p className="text-xs text-red-300">{err}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="text-xs text-slate-400 hover:text-slate-200">
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={submitting || body.trim().length === 0}
          className="btn-sm disabled:opacity-50"
        >
          {submitting ? 'Sende…' : 'Antwort'}
        </button>
      </div>
    </form>
  );
}

/* ───── Moderator-Delete-Form ──────────────────────────────────────── */

function ModerateDeleteForm({
  commentId,
  onClose,
  onDone
}: {
  commentId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (reason.trim().length === 0) {
      setErr('Begründung erforderlich.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await moderateDeleteComment(commentId, reason.trim());
      onDone();
    } catch (e: unknown) {
      console.error(e);
      setErr(e instanceof ApiError ? e.message : 'Löschen fehlgeschlagen.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-2 rounded-xl border border-red-400/30 bg-red-500/5 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-red-300">
        Moderator-Löschung
      </p>
      <p className="text-[0.7rem] text-slate-400">
        Grund wird Lesern transparent angezeigt. Action ist nicht still.
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        maxLength={500}
        placeholder='z. B. „Off-Topic / Spam / Persönliche Angriffe“.'
        className="block w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500"
      />
      {err && <p className="text-xs text-red-300">{err}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="text-xs text-slate-400 hover:text-slate-200">
          Abbrechen
        </button>
        <button type="submit" disabled={busy} className="btn-sm bg-red-500/80 hover:bg-red-500">
          {busy ? 'Lösche…' : 'Löschen'}
        </button>
      </div>
    </form>
  );
}

/* ───── Mute-User-Form ─────────────────────────────────────────────── */

function MuteUserForm({
  userId,
  userName,
  onClose
}: {
  userId: string;
  userName: string;
  onClose: () => void;
}) {
  const [reason, setReason] = React.useState('');
  const [duration, setDuration] = React.useState<'1d' | '7d' | '30d' | 'forever'>('7d');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (reason.trim().length === 0) {
      setErr('Begründung erforderlich.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      let until: string | null = null;
      if (duration !== 'forever') {
        const days = duration === '1d' ? 1 : duration === '7d' ? 7 : 30;
        until = new Date(Date.now() + days * 86400_000).toISOString();
      }
      await muteUserForComments(userId, reason.trim(), until);
      setDone(true);
    } catch (e: unknown) {
      console.error(e);
      setErr(e instanceof ApiError ? e.message : 'Mute fehlgeschlagen.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-3 rounded-xl border border-orange-400/30 bg-orange-500/5 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-orange-300">
        {userName} muten
      </p>
      {done ? (
        <>
          <p className="text-xs text-emerald-300">Erledigt — User kann keine Kommentare mehr posten.</p>
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className="text-xs text-slate-400 hover:text-slate-200">
              Schließen
            </button>
          </div>
        </>
      ) : (
        <>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Begründung — wird bei jedem Kommentier-Versuch angezeigt."
            className="block w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500"
          />
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs text-slate-400">Dauer:</label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value as '1d' | '7d' | '30d' | 'forever')}
              className="rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1 text-xs text-slate-100"
            >
              <option value="1d">1 Tag</option>
              <option value="7d">7 Tage</option>
              <option value="30d">30 Tage</option>
              <option value="forever">Unbefristet</option>
            </select>
          </div>
          {err && <p className="text-xs text-red-300">{err}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="text-xs text-slate-400 hover:text-slate-200">
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={busy}
              className="btn-sm bg-orange-500/80 hover:bg-orange-500"
            >
              {busy ? 'Mute…' : 'User muten'}
            </button>
          </div>
        </>
      )}
    </form>
  );
}
