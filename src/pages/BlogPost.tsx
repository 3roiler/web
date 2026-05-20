import * as React from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { getBlogPost, getMe, type BlogPost as BlogPostModel, type User } from "../services";
import { Routes } from "../config/routes";
import { Seo, JsonLd, SITE_URL } from "../components/Seo";
import "highlight.js/styles/github-dark.css";

function formatDate(iso: string | null): string {
  if (!iso) return "Entwurf";
  return new Date(iso).toLocaleDateString("de-DE", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

export function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = React.useState<BlogPostModel | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [user, setUser] = React.useState<User | null>(null);

  const isAuthor = Boolean(user?.permissions?.includes("blog.write"));

  React.useEffect(() => {
    getMe().then(setUser).catch(() => setUser(null));
  }, []);

  React.useEffect(() => {
    if (!slug) return;
    getBlogPost(slug)
      .then(setPost)
      .catch((e: unknown) => {
        console.error(e);
        setError("Dieser Beitrag konnte nicht geladen werden.");
      });
  }, [slug]);

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 py-24">
        <div className="mx-auto max-w-3xl px-6 sm:px-10 lg:px-16 pt-16">
          <p className="text-sm text-red-300">{error}</p>
          <Link to={Routes.Blog} className="btn-outline mt-8 inline-block">Zur Übersicht</Link>
        </div>
      </main>
    );
  }

  if (!post) {
    return (
      <main className="min-h-screen bg-slate-950 py-24">
        <div className="mx-auto max-w-3xl px-6 sm:px-10 lg:px-16 pt-16 text-sm text-slate-400">
          Lade…
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 py-24" id="top">
      <Seo
        title={post.title}
        description={post.excerpt ?? `Blog-Beitrag von Paul Wechselberger: ${post.title}.`}
        type="article"
        noindex={post.publishedAt === null}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title,
          ...(post.excerpt ? { description: post.excerpt } : {}),
          ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
          ...((post.updatedAt ?? post.publishedAt)
            ? { dateModified: post.updatedAt ?? post.publishedAt }
            : {}),
          author: { "@type": "Person", name: "Paul Wechselberger", url: SITE_URL },
          url: `${SITE_URL}/blog/${post.slug}`,
          mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`
        }}
      />
      <div className="mx-auto max-w-3xl px-6 sm:px-10 lg:px-16 pt-16">
        <Link to={Routes.Blog} className="text-xs text-slate-400 hover:text-cyan-300">← Zur Übersicht</Link>

        <article className="mt-8">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <time dateTime={post.publishedAt ?? post.createdAt}>{formatDate(post.publishedAt)}</time>
            {post.publishedAt === null && (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-300">Draft</span>
            )}
            {isAuthor && (
              <Link
                to={Routes.Dashboard.BlogEdit.replace(":id", post.id)}
                className="text-cyan-300 hover:text-cyan-200"
              >
                Bearbeiten
              </Link>
            )}
          </div>

          <h1 className="mt-4 text-4xl font-semibold text-slate-50 sm:text-5xl">{post.title}</h1>
          {post.excerpt && <p className="mt-4 text-lg text-slate-300">{post.excerpt}</p>}

          <div className="blog-content mt-10">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
            >
              {post.content}
            </ReactMarkdown>
          </div>
        </article>
      </div>
    </main>
  );
}
