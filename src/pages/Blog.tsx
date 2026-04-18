import * as React from "react";
import { Link } from "react-router-dom";
import { listBlogPosts, getMe, type BlogPost, type User } from "../services";
import { Routes } from "../config/routes";

function formatDate(iso: string | null): string {
  if (!iso) return "Entwurf";
  return new Date(iso).toLocaleDateString("de-DE", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

export function BlogPage() {
  const [posts, setPosts] = React.useState<BlogPost[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [user, setUser] = React.useState<User | null>(null);

  const isAuthor = Boolean(user?.permissions?.includes("blog.write"));

  React.useEffect(() => {
    getMe().then(setUser).catch(() => setUser(null));
  }, []);

  React.useEffect(() => {
    listBlogPosts(isAuthor)
      .then(setPosts)
      .catch((e: unknown) => {
        console.error(e);
        setError("Beim Laden der Blog-Posts ist ein Fehler aufgetreten.");
      });
  }, [isAuthor]);

  return (
    <main className="min-h-screen bg-slate-950 py-24" id="top">
      <div className="mx-auto max-w-4xl px-6 sm:px-10 lg:px-16 pt-16">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">Blog</p>
            <h1 className="mt-4 text-4xl font-semibold text-slate-50 sm:text-5xl">Gedanken &amp; Notizen</h1>
          </div>
          {isAuthor && (
            <Link to={Routes.Dashboard.Blog} className="btn-outline self-start sm:self-auto">Admin</Link>
          )}
        </div>

        <div className="mt-16 space-y-8">
          {error && <p className="text-sm text-red-300">{error}</p>}
          {!error && posts === null && <p className="text-sm text-slate-400">Lade…</p>}
          {!error && posts !== null && posts.length === 0 && (
            <p className="text-sm text-slate-400">Noch keine Posts. Bald mehr.</p>
          )}
          {posts?.map((post) => (
            <article key={post.id} className="group rounded-3xl border border-white/10 bg-white/5 p-8 transition hover:-translate-y-0.5 hover:border-cyan-400/40">
              <Link to={Routes.Blog + "/" + post.slug} className="block">
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <time dateTime={post.publishedAt ?? post.createdAt}>
                    {formatDate(post.publishedAt)}
                  </time>
                  {post.publishedAt === null && (
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-300">Draft</span>
                  )}
                </div>
                <h2 className="mt-3 text-2xl font-semibold text-slate-50 group-hover:text-cyan-200">
                  {post.title}
                </h2>
                {post.excerpt && (
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">{post.excerpt}</p>
                )}
              </Link>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
