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

/**
 * Wörter pro Minute. 200 ist der Standardwert für deutsche Fachtexte —
 * 250 wäre für Plain-English-Romane realistisch, aber Backend-/Infra-
 * Texte mit Code-Blöcken brauchen erfahrungsgemäß länger. */
const WORDS_PER_MINUTE = 200;

function estimateReadingMinutes(markdown: string): number {
  if (!markdown) return 1;
  // Code-Blöcke zählen wir niedriger — sie sind dichter und werden
  // langsamer „gelesen" als Fließtext. Wir extrahieren Fenced-Code und
  // verdoppeln dessen Zeichenzahl effektiv (entspricht ~½ WPM dort).
  const codeBlocks = markdown.match(/```[\s\S]*?```/g) ?? [];
  const codeCharCount = codeBlocks.reduce((sum, b) => sum + b.length, 0);
  const proseChars = markdown.length - codeCharCount;
  const effectiveChars = proseChars + codeCharCount * 2;
  // Ein durchschnittliches Wort hat ~5 Zeichen + 1 Leerzeichen.
  const words = effectiveChars / 6;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/** Slugifiziert eine Heading-Caption auf URL-kompatibles `#ich-bin-eine-section`. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' })[c] ?? c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

/**
 * Scroll-getriebener Reading-Progress (0–1) basierend auf der gesamten
 * Seitenhöhe. Sehr leicht — ein passiver Scroll-Listener mit RAF-
 * Throttle, kein Observer.
 */
function useReadingProgress(): number {
  const [progress, setProgress] = React.useState(0);
  React.useEffect(() => {
    let raf = 0;
    const compute = () => {
      raf = 0;
      const docHeight =
        document.documentElement.scrollHeight - globalThis.innerHeight;
      setProgress(docHeight > 0 ? Math.min(1, Math.max(0, globalThis.scrollY / docHeight)) : 0);
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(compute);
    };
    compute();
    globalThis.addEventListener('scroll', onScroll, { passive: true });
    globalThis.addEventListener('resize', onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      globalThis.removeEventListener('scroll', onScroll);
      globalThis.removeEventListener('resize', onScroll);
    };
  }, []);
  return progress;
}

interface TocEntry {
  id: string;
  text: string;
  level: 2 | 3;
}

/**
 * Extrahiert `<h2>`/`<h3>`-Headings aus dem Markdown-Body und vergibt
 * stabile IDs, damit das TOC anker-springfähig ist. Headings sind aus
 * ReactMarkdown-Output, weil dort GFM-Tabellen/Footnotes etc. schon
 * korrekt expandiert sind — Regex am Markdown-Source würde z. B. ein
 * `# in einer Code-Zeile` fälschlich als Heading werten. */
function useTableOfContents(
  articleRef: React.RefObject<HTMLElement | null>,
  postContent: string | null
): TocEntry[] {
  const [toc, setToc] = React.useState<TocEntry[]>([]);
  React.useEffect(() => {
    if (!articleRef.current || !postContent) {
      setToc([]);
      return;
    }
    const headings = articleRef.current.querySelectorAll<HTMLHeadingElement>('h2, h3');
    const seen = new Map<string, number>();
    const entries: TocEntry[] = [];
    headings.forEach((h) => {
      const text = (h.textContent ?? '').trim();
      if (!text) return;
      let base = slugify(text) || 'section';
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      const id = count === 0 ? base : `${base}-${count + 1}`;
      h.id = id;
      // Scroll-Margin, damit `#anchor`-Sprünge nicht direkt unter dem
      // fixed Header landen — bleibt visuell freundlich.
      h.style.scrollMarginTop = '96px';
      entries.push({ id, text, level: h.tagName === 'H2' ? 2 : 3 });
    });
    setToc(entries);
  }, [postContent, articleRef]);
  return toc;
}

/**
 * Aktiv-Tracking für das TOC. Beim Scrollen wird die Heading-ID
 * markiert, deren Section gerade im oberen Viewport-Bereich liegt —
 * derselbe Trick wie beim Home-Header-Scroll-Spy.
 */
function useActiveHeading(toc: TocEntry[]): string | null {
  const [active, setActive] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (toc.length === 0) return;
    const TRIGGER_OFFSET = 140;
    let raf = 0;
    const pick = () => {
      raf = 0;
      let current: string | null = null;
      for (const entry of toc) {
        const el = document.getElementById(entry.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= TRIGGER_OFFSET) {
          current = entry.id;
        } else {
          break;
        }
      }
      setActive(current);
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(pick);
    };
    pick();
    globalThis.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      globalThis.removeEventListener('scroll', onScroll);
    };
  }, [toc]);
  return active;
}

/**
 * Wrapper für `<pre>`-Blöcke aus ReactMarkdown. Fügt einen kleinen
 * „Copy"-Button hinzu, der den enthaltenen `<code>`-Text in die
 * Zwischenablage schreibt. Nutzt navigator.clipboard mit graceful
 * Fallback (Button bleibt, Aktion no-op).
 */
function CodeBlock(props: React.HTMLAttributes<HTMLPreElement>) {
  const preRef = React.useRef<HTMLPreElement | null>(null);
  const [copied, setCopied] = React.useState(false);

  const onCopy = async () => {
    if (!preRef.current) return;
    const code = preRef.current.querySelector('code')?.innerText
      ?? preRef.current.innerText
      ?? '';
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      globalThis.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Älterer Browser ohne Clipboard-API oder verweigerte Permission —
      // wir machen UI-mäßig nichts (kein Toast), der Button-Text bleibt.
    }
  };

  return (
    <div className="group relative">
      <pre {...props} ref={preRef} />
      <button
        type="button"
        onClick={onCopy}
        aria-label="Code kopieren"
        className="absolute right-3 top-3 rounded-md border border-white/10 bg-slate-900/80 px-2 py-1 text-[0.65rem] font-medium uppercase tracking-wider text-slate-400 opacity-0 transition group-hover:opacity-100 hover:border-cyan-400/40 hover:text-cyan-300 focus-visible:opacity-100"
      >
        {copied ? 'Kopiert' : 'Copy'}
      </button>
    </div>
  );
}

export function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = React.useState<BlogPostModel | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [user, setUser] = React.useState<User | null>(null);
  const articleRef = React.useRef<HTMLElement | null>(null);

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

  const progress = useReadingProgress();
  const toc = useTableOfContents(articleRef, post?.content ?? null);
  const activeHeading = useActiveHeading(toc);
  const minutes = React.useMemo(
    () => (post ? estimateReadingMinutes(post.content) : 0),
    [post]
  );

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

      {/* Reading-Progress: dünner cyan-Strich am oberen Rand. z-[60] über
          den Header-Backdrop (z-50), damit er nicht verdeckt wird. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px] bg-transparent"
      >
        <div
          className="h-full bg-cyan-400 transition-[width] duration-150 ease-out"
          style={{ width: `${(progress * 100).toFixed(2)}%` }}
        />
      </div>

      <div className="mx-auto max-w-6xl px-6 sm:px-10 lg:px-16 pt-16">
        <Link to={Routes.Blog} className="text-xs text-slate-400 hover:text-cyan-300">← Zur Übersicht</Link>

        <div className={toc.length >= 3 ? 'mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_220px] lg:gap-12' : 'mt-8'}>
          <article ref={articleRef} className="lg:max-w-3xl">
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <time dateTime={post.publishedAt ?? post.createdAt}>{formatDate(post.publishedAt)}</time>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>{minutes} min Lesezeit</span>
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
                components={{ pre: CodeBlock }}
              >
                {post.content}
              </ReactMarkdown>
            </div>
          </article>

          {/* TOC: sticky Sidebar ab lg. Nur bei Posts mit ≥3 Headings,
              damit kurze Beiträge nicht künstlich aufgebläht wirken. */}
          {toc.length >= 3 && (
            <aside className="hidden lg:block">
              <nav
                aria-label="Inhaltsverzeichnis"
                className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-1 [scrollbar-width:thin]"
              >
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Inhalt
                </p>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {toc.map((entry) => {
                    const active = entry.id === activeHeading;
                    return (
                      <li key={entry.id} className={entry.level === 3 ? 'pl-3' : ''}>
                        <a
                          href={`#${entry.id}`}
                          className={
                            active
                              ? 'block border-l-2 border-cyan-400 pl-2 text-cyan-300'
                              : 'block border-l-2 border-transparent pl-2 text-slate-400 transition hover:border-white/20 hover:text-slate-200'
                          }
                        >
                          {entry.text}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </aside>
          )}
        </div>
      </div>
    </main>
  );
}
