import * as React from "react";
import { Link } from "react-router-dom";
import {
  listBlogPosts,
  deleteBlogPost,
  type BlogPost,
  type BlogPostVisibility
} from "../services";
import { DashboardLayout } from "../components/DashboardLayout";
import { Routes } from "../config/routes";

function formatDate(iso: string | null): string {
  if (!iso) return "Entwurf";
  return new Date(iso).toLocaleDateString("de-DE", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

const VISIBILITY_BADGE: Record<
  BlogPostVisibility,
  { label: string; className: string; title: string }
> = {
  public: {
    label: "Öffentlich",
    className: "bg-slate-500/20 text-slate-300",
    title: "Jede/r kann den Beitrag lesen."
  },
  authenticated: {
    label: "Angemeldet",
    className: "bg-sky-500/20 text-sky-200",
    title: "Nur eingeloggte Nutzer:innen sehen den Beitrag."
  },
  group: {
    label: "Gruppe",
    className: "bg-fuchsia-500/20 text-fuchsia-200",
    title: "Nur Mitglieder der ausgewählten Gruppen sehen den Beitrag."
  }
};

/**
 * Blog admin page under `/dashboard/blog`. The old `/blog/admin` route is
 * gone — there is no redirect, because the admin area is only used by Paul
 * and still in active development.
 */
export function BlogAdminPage() {
  return (
    <DashboardLayout
      requiredPermission="dashboard.blog"
      kicker="Dashboard · Blog"
      title="Beiträge verwalten"
      description={
        <>
          Beiträge schreiben, veröffentlichen oder auf eine bestimmte Sichtbarkeit einschränken.
          Entwürfe bleiben bis zur Veröffentlichung privat — sichtbar bist nur du.
        </>
      }
      actions={
        <Link to={Routes.Dashboard.BlogNew} className="btn">
          Neuer Beitrag
        </Link>
      }
    >
      {() => <BlogAdminContent />}
    </DashboardLayout>
  );
}

function BlogAdminContent() {
  const [posts, setPosts] = React.useState<BlogPost[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const reload = React.useCallback(() => {
    listBlogPosts(true)
      .then(setPosts)
      .catch((e: unknown) => {
        console.error(e);
        setError("Beim Laden der Posts ist ein Fehler aufgetreten.");
      });
  }, []);

  React.useEffect(() => {
    reload();
  }, [reload]);

  async function handleDelete(post: BlogPost) {
    const ok = globalThis.confirm(`"${post.title}" wirklich löschen?`);
    if (!ok) return;
    setBusyId(post.id);
    try {
      await deleteBlogPost(post.id);
      setPosts((prev) => prev?.filter((p) => p.id !== post.id) ?? null);
    } catch (e: unknown) {
      console.error(e);
      setError("Löschen fehlgeschlagen.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-300">{error}</p>}
      {!error && posts === null && <p className="text-sm text-slate-400">Lade…</p>}
      {!error && posts !== null && posts.length === 0 && (
        <p className="text-sm text-slate-400">Noch keine Beiträge.</p>
      )}
      {posts?.map((post) => {
        const badge = VISIBILITY_BADGE[post.visibility] ?? VISIBILITY_BADGE.public;
        const groupCount = post.accessGroupIds?.length ?? 0;
        return (
          <div
            key={post.id}
            className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <time dateTime={post.publishedAt ?? post.createdAt}>
                  {formatDate(post.publishedAt)}
                </time>
                {post.publishedAt === null ? (
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-300">
                    Draft
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-300">
                    Live
                  </span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 ${badge.className}`}
                  title={badge.title}
                >
                  {badge.label}
                  {post.visibility === "group" && groupCount > 0 && (
                    <> · {groupCount}</>
                  )}
                </span>
                <span className="truncate text-slate-500">/{post.slug}</span>
              </div>
              <h2 className="mt-1 truncate text-lg font-semibold text-slate-50">
                {post.title}
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                to={Routes.Blog + "/" + post.slug}
                className="text-xs text-slate-400 hover:text-cyan-300"
              >
                Ansehen
              </Link>
              <Link
                to={Routes.Dashboard.BlogEdit.replace(":id", post.id)}
                className="btn-outline btn-sm"
              >
                Bearbeiten
              </Link>
              <button
                type="button"
                onClick={() => handleDelete(post)}
                disabled={busyId === post.id}
                className="btn-sm rounded-full border border-red-500/40 px-3 py-1 text-xs text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
              >
                {busyId === post.id ? "Lösche…" : "Löschen"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
