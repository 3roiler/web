import * as React from "react";
import { DashboardLayout } from "../components/DashboardLayout";
import { safeHttpUrl } from "../lib/url";
import {
  listCommentMutes,
  unmuteUserForComments,
  ApiError,
  type CommentMute
} from "../services";

/**
 * Übersicht aller aktiven Comment-Mutes. Moderatoren können Einträge
 * mit einem Klick lösen (Unmute). Anonymisierte User werden in der
 * Liste mit „Gelöschter Nutzer" gerendert — beim Anonymisieren wird
 * der Mute-Eintrag eigentlich automatisch entfernt, das ist also nur
 * eine fail-safe Anzeige.
 */
export function DashboardMutesPage() {
  return (
    <DashboardLayout
      requiredPermission="clips.moderate"
      kicker="Dashboard · Streamclips"
      title="Kommentar-Mutes"
      description="Übersicht aller User, die aktuell vom Kommentieren ausgeschlossen sind."
    >
      {() => <MutesList />}
    </DashboardLayout>
  );
}

function formatRelativeOrAbsolute(iso: string | null): string {
  if (!iso) return 'unbefristet';
  const date = new Date(iso);
  return date.toLocaleString('de-DE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function MutesList() {
  const [mutes, setMutes] = React.useState<CommentMute[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const reload = React.useCallback(() => {
    listCommentMutes()
      .then(setMutes)
      .catch((err: unknown) => {
        console.error(err);
        setError(err instanceof ApiError ? err.message : 'Mutes konnten nicht geladen werden.');
      });
  }, []);

  React.useEffect(() => {
    reload();
  }, [reload]);

  async function unmute(userId: string) {
    setBusyId(userId);
    try {
      await unmuteUserForComments(userId);
      reload();
    } catch (err) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : 'Unmute fehlgeschlagen.');
    } finally {
      setBusyId(null);
    }
  }

  if (error && !mutes) return <p className="text-sm text-red-300">{error}</p>;
  if (!mutes) return <p className="text-sm text-slate-400">Lade…</p>;
  if (mutes.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Niemand ist aktuell vom Kommentieren ausgeschlossen.
      </p>
    );
  }

  return (
    <div className="max-w-3xl space-y-3">
      {error && <p className="text-sm text-red-300">{error}</p>}
      <ul className="space-y-3">
        {mutes.map((m) => {
          const isAnonymized = m.userDeletedAt !== null;
          const name = isAnonymized
            ? 'Gelöschter Nutzer'
            : (m.userDisplayName ?? m.userName);
          const avatar = isAnonymized ? undefined : safeHttpUrl(m.userAvatarUrl);
          return (
            <li key={m.userId} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3">
                {avatar ? (
                  <img
                    src={avatar}
                    alt=""
                    className="h-10 w-10 rounded-full border border-white/10 bg-slate-900 object-cover"
                  />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-slate-900 text-sm text-slate-300">
                    {isAnonymized ? '×' : name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-100">{name}</p>
                  <p className="text-[0.7rem] text-slate-500">
                    bis: {formatRelativeOrAbsolute(m.mutedUntil)} ·{' '}
                    seit: {formatRelativeOrAbsolute(m.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busyId === m.userId}
                  onClick={() => unmute(m.userId)}
                  className="btn-outline btn-sm disabled:opacity-50"
                >
                  {busyId === m.userId ? 'Unmute…' : 'Unmute'}
                </button>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                <span className="text-slate-500">Grund:</span> {m.reason}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
