import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  createBlogPost,
  updateBlogPost,
  listBlogPosts,
  getMe,
  type BlogPost,
  type BlogPostInput,
  type User
} from "../services";
import { Routes } from "../config/routes";

interface FormState {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  publish: boolean;
}

const EMPTY: FormState = {
  slug: "",
  title: "",
  excerpt: "",
  content: "",
  publish: false
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export function BlogEditPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const [user, setUser] = React.useState<User | null | undefined>(undefined);
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [initial, setInitial] = React.useState<BlogPost | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [slugTouched, setSlugTouched] = React.useState(false);

  const isAuthor = Boolean(user?.permissions?.includes("blog.write"));

  React.useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  React.useEffect(() => {
    if (!isEdit || !isAuthor || !id) return;
    listBlogPosts(true)
      .then((posts) => {
        const match = posts.find((p) => p.id === id);
        if (!match) {
          setLoadError("Beitrag nicht gefunden.");
          return;
        }
        setInitial(match);
        setForm({
          slug: match.slug,
          title: match.title,
          excerpt: match.excerpt ?? "",
          content: match.content,
          publish: match.publishedAt !== null
        });
        setSlugTouched(true);
      })
      .catch((e: unknown) => {
        console.error(e);
        setLoadError("Beitrag konnte nicht geladen werden.");
      });
  }, [id, isAuthor, isEdit]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onTitleChange(next: string) {
    update("title", next);
    if (!slugTouched) {
      setForm((prev) => ({ ...prev, title: next, slug: slugify(next) }));
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);

    if (!form.title.trim() || !form.slug.trim() || !form.content.trim()) {
      setSaveError("Titel, Slug und Inhalt sind Pflichtfelder.");
      return;
    }

    setSaving(true);
    try {
      const payload: BlogPostInput = {
        slug: form.slug.trim(),
        title: form.title.trim(),
        content: form.content,
        excerpt: form.excerpt.trim() ? form.excerpt.trim() : null,
        publish: form.publish
      };

      if (isEdit && initial) {
        await updateBlogPost(initial.id, payload);
      } else {
        await createBlogPost(payload);
      }
      navigate(Routes.BlogAdmin);
    } catch (e: unknown) {
      console.error(e);
      setSaveError("Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  if (user === undefined) {
    return (
      <main className="min-h-screen bg-slate-950 py-24">
        <div className="mx-auto max-w-3xl px-6 sm:px-10 lg:px-16 pt-16 text-sm text-slate-400">
          Lade…
        </div>
      </main>
    );
  }

  if (!isAuthor) {
    return (
      <main className="min-h-screen bg-slate-950 py-24">
        <div className="mx-auto max-w-3xl px-6 sm:px-10 lg:px-16 pt-16">
          <p className="text-sm text-red-300">
            Kein Zugriff. Dir fehlt die Berechtigung <code>blog.write</code>.
          </p>
          <Link to={Routes.Blog} className="btn-outline mt-8 inline-block">
            Zur Übersicht
          </Link>
        </div>
      </main>
    );
  }

  if (isEdit && loadError) {
    return (
      <main className="min-h-screen bg-slate-950 py-24">
        <div className="mx-auto max-w-3xl px-6 sm:px-10 lg:px-16 pt-16">
          <p className="text-sm text-red-300">{loadError}</p>
          <Link to={Routes.BlogAdmin} className="btn-outline mt-8 inline-block">
            Zurück
          </Link>
        </div>
      </main>
    );
  }

  if (isEdit && !initial) {
    return (
      <main className="min-h-screen bg-slate-950 py-24">
        <div className="mx-auto max-w-3xl px-6 sm:px-10 lg:px-16 pt-16 text-sm text-slate-400">
          Lade Beitrag…
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 py-24" id="top">
      <div className="mx-auto max-w-3xl px-6 sm:px-10 lg:px-16 pt-16">
        <Link to={Routes.BlogAdmin} className="text-xs text-slate-400 hover:text-cyan-300">
          ← Zur Admin-Übersicht
        </Link>

        <h1 className="mt-8 text-4xl font-semibold text-slate-50 sm:text-5xl">
          {isEdit ? "Beitrag bearbeiten" : "Neuer Beitrag"}
        </h1>

        <form onSubmit={onSubmit} className="mt-10 space-y-6">
          <div>
            <label htmlFor="title" className="block text-xs font-semibold uppercase tracking-widest text-slate-400">
              Titel
            </label>
            <input
              id="title"
              type="text"
              value={form.title}
              onChange={(e) => onTitleChange(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-slate-50 outline-none focus:border-cyan-400/60"
              required
            />
          </div>

          <div>
            <label htmlFor="slug" className="block text-xs font-semibold uppercase tracking-widest text-slate-400">
              Slug
            </label>
            <input
              id="slug"
              type="text"
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                update("slug", e.target.value);
              }}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 font-mono text-sm text-slate-50 outline-none focus:border-cyan-400/60"
              required
            />
            <p className="mt-1 text-xs text-slate-500">
              URL: /blog/{form.slug || "…"}
            </p>
          </div>

          <div>
            <label htmlFor="excerpt" className="block text-xs font-semibold uppercase tracking-widest text-slate-400">
              Teaser (optional)
            </label>
            <textarea
              id="excerpt"
              value={form.excerpt}
              onChange={(e) => update("excerpt", e.target.value)}
              rows={2}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-slate-50 outline-none focus:border-cyan-400/60"
            />
          </div>

          <div>
            <label htmlFor="content" className="block text-xs font-semibold uppercase tracking-widest text-slate-400">
              Inhalt (Markdown / GFM)
            </label>
            <textarea
              id="content"
              value={form.content}
              onChange={(e) => update("content", e.target.value)}
              rows={18}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 font-mono text-sm text-slate-50 outline-none focus:border-cyan-400/60"
              required
            />
          </div>

          <label className="flex items-center gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={form.publish}
              onChange={(e) => update("publish", e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
            />
            {isEdit && initial?.publishedAt
              ? "Veröffentlicht lassen"
              : "Jetzt veröffentlichen"}
          </label>

          {saveError && <p className="text-sm text-red-300">{saveError}</p>}

          <div className="flex items-center gap-3">
            <button type="submit" className="btn" disabled={saving}>
              {saving ? "Speichere…" : isEdit ? "Speichern" : "Erstellen"}
            </button>
            <Link to={Routes.BlogAdmin} className="btn-outline">
              Abbrechen
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
