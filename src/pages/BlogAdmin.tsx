import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  listBlogPosts,
  deleteBlogPost,
  getMe,
  type BlogPost,
  type User
} from "../services";
import { Routes } from "../config/routes";

function formatDate(iso: string | null): string {
  if (!iso) return "Entwurf";
  return new Date(iso).toLocaleDateString("de-DE", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

export function BlogAdminPage() {
  const navigate = useNavigate();
  const [posts, setPosts] = React.useState<BlogPost[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [user, setUser] = React.useState<User | null | undefined>(undefined);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const isAuthor = Boolean(user?.permissions?.includes("blog.write"));

  React.useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  const reload = React.useCallback(() => {
    listBlogPosts(true)
      .then(setPosts)
      .catch((e: unknown) => {
        console.error(e);
        setError("Beim Laden der Posts ist ein Fehler aufgetreten.");
      });
  }, []);

  React.useEffect(() => {
    if (!isAuthor) return;
    reload();
  }, [isAuthor, reload]);

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

  if (user === undefined) {
    return (
      <main className="min-h-screen bg-slate-950 py-24">
        <div className="mx-auto max-w-4xl px-6 sm:px-10 lg:px-16 pt-16 text-sm text-slate-400">
          Lade…
        </div>
      </main>
    );
  }

  if (!isAuthor) {
    return (
      <main className="min-h-screen bg-slate-950 py-24">
        <div className="mx-auto max-w-4xl px-6 sm:px-10 lg:px-16 pt-16">
          <p className="text-sm text-red-300">
            Kein Zugriff. Dir fehlt die Berechtigung <code>blog.write</code>.
          </p>
          <button
            type="button"
            onClick={() => navigate(Routes.Blog)}
            className="btn-outline mt-8 inline-block"
          >
            Zur Übersicht
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 py-24" id="top">
      <div className="mx-auto max-w-4xl px-6 sm:px-10 lg:px-16 pt-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">
              Blog · Admin
            </p>
            <h1 className="mt-4 text-4xl font-semibold text-slate-50 sm:text-5xl">
              Beiträge verwalten
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link to={Routes.Blog} className="text-xs text-slate-400 hover:text-cyan-300">
              ← Öffentliche Übersicht
            </Link>
            <Link to={Routes.BlogNew} className="btn">
              Neuer Beitrag
            </Link>
          </div>
        </div>

        <div className="mt-12 space-y-3">
          {error && <p className="text-sm text-red-300">{error}</p>}
          {!error && posts === null && <p className="text-sm text-slate-400">Lade…</p>}
          {!error && posts !== null && posts.length === 0 && (
            <p className="text-sm text-slate-400">Noch keine Beiträge.</p>
          )}
          {posts?.map((post) => (
            <div
              key={post.id}
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-3 text-xs text-slate-400">
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
                  to={`/blog/admin/edit/${post.id}`}
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
          ))}
        </div>
      </div>
    </main>
  );
}
