import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import MDEditor from "@uiw/react-md-editor";
import rehypeHighlight from "rehype-highlight";
import {
  createBlogPost,
  updateBlogPost,
  listBlogPosts,
  listAdminGroups,
  getMe,
  type AdminGroup,
  type BlogPost,
  type BlogPostInput,
  type BlogPostVisibility,
  type User
} from "../services";
import { Routes } from "../config/routes";
import "@uiw/react-md-editor/markdown-editor.css";
import "highlight.js/styles/github-dark.css";

interface FormState {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  publish: boolean;
  visibility: BlogPostVisibility;
  groupIds: string[];
}

const EMPTY: FormState = {
  slug: "",
  title: "",
  excerpt: "",
  content: "",
  publish: false,
  visibility: "public",
  groupIds: []
};

const VISIBILITY_OPTIONS: { value: BlogPostVisibility; label: string; description: string }[] = [
  {
    value: "public",
    label: "Öffentlich",
    description: "Jede/r kann den Beitrag lesen, auch ohne Login."
  },
  {
    value: "authenticated",
    label: "Angemeldet",
    description: "Nur eingeloggte Nutzer:innen sehen den Beitrag."
  },
  {
    value: "group",
    label: "Gruppe",
    description: "Nur Mitglieder der ausgewählten Gruppen sehen den Beitrag."
  }
];

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
  const [groups, setGroups] = React.useState<AdminGroup[] | null>(null);
  const [groupsError, setGroupsError] = React.useState<string | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [slugTouched, setSlugTouched] = React.useState(false);

  const isAuthor = Boolean(user?.permissions?.includes("blog.write"));
  const canListGroups = Boolean(
    user?.permissions?.includes("dashboard.groups") || user?.permissions?.includes("admin.manage")
  );

  React.useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  /**
   * Gruppenliste nur laden, wenn der Nutzer `dashboard.groups` hat —
   * sonst würde der Fetch 403en, ohne dass die UI sinnvoll damit umgehen
   * kann. Autoren ohne Gruppen-Einblick sehen statt Multi-Select einen
   * Hinweis, wenn sie auf `group` umstellen wollen.
   */
  React.useEffect(() => {
    if (!isAuthor || !canListGroups) return;
    listAdminGroups()
      .then(setGroups)
      .catch((e: unknown) => {
        console.error(e);
        setGroupsError("Gruppen konnten nicht geladen werden.");
      });
  }, [isAuthor, canListGroups]);

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
          publish: match.publishedAt !== null,
          visibility: match.visibility,
          groupIds: match.accessGroupIds ?? []
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

  function toggleGroup(groupId: string) {
    setForm((prev) => {
      const has = prev.groupIds.includes(groupId);
      return {
        ...prev,
        groupIds: has ? prev.groupIds.filter((g) => g !== groupId) : [...prev.groupIds, groupId]
      };
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);

    if (!form.title.trim() || !form.slug.trim() || !form.content.trim()) {
      setSaveError("Titel, Slug und Inhalt sind Pflichtfelder.");
      return;
    }

    if (form.visibility === "group" && form.groupIds.length === 0) {
      setSaveError("Wähle mindestens eine Gruppe, wenn die Sichtbarkeit auf „Gruppe“ steht.");
      return;
    }

    setSaving(true);
    try {
      const payload: BlogPostInput = {
        slug: form.slug.trim(),
        title: form.title.trim(),
        content: form.content,
        excerpt: form.excerpt.trim() ? form.excerpt.trim() : null,
        publish: form.publish,
        visibility: form.visibility,
        // Für public/authenticated ein leeres Array mitschicken, damit der
        // Server vorhandene Gruppen-Links beim Wechsel sauber abräumt.
        groupIds: form.visibility === "group" ? form.groupIds : []
      };

      if (isEdit && initial) {
        await updateBlogPost(initial.id, payload);
      } else {
        await createBlogPost(payload);
      }
      navigate(Routes.Dashboard.Blog);
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
        <div className="mx-auto max-w-4xl px-6 sm:px-10 lg:px-16 pt-16">
          <p className="text-sm text-red-300">{loadError}</p>
          <Link to={Routes.Dashboard.Blog} className="btn-outline mt-8 inline-block">
            Zurück
          </Link>
        </div>
      </main>
    );
  }

  if (isEdit && !initial) {
    return (
      <main className="min-h-screen bg-slate-950 py-24">
        <div className="mx-auto max-w-4xl px-6 sm:px-10 lg:px-16 pt-16 text-sm text-slate-400">
          Lade Beitrag…
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 py-24" id="top">
      <div className="mx-auto max-w-4xl px-6 sm:px-10 lg:px-16 pt-16">
        <Link to={Routes.Dashboard.Blog} className="text-xs text-slate-400 hover:text-cyan-300">
          ← Zur Beitragsübersicht
        </Link>

        <h1 className="mt-8 text-4xl font-semibold text-slate-50 sm:text-5xl">
          {isEdit ? "Beitrag bearbeiten" : "Neuer Beitrag"}
        </h1>

        <form onSubmit={onSubmit} className="mt-10 space-y-6">
          <div>
            <label
              htmlFor="title"
              className="block text-xs font-semibold uppercase tracking-widest text-slate-400"
            >
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
            <label
              htmlFor="slug"
              className="block text-xs font-semibold uppercase tracking-widest text-slate-400"
            >
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
            <p className="mt-1 text-xs text-slate-500">URL: /blog/{form.slug || "…"}</p>
          </div>

          <div>
            <label
              htmlFor="excerpt"
              className="block text-xs font-semibold uppercase tracking-widest text-slate-400"
            >
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

          <fieldset className="rounded-xl border border-white/10 bg-slate-900/40 p-5">
            <legend className="px-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
              Sichtbarkeit
            </legend>
            <div className="space-y-3">
              {VISIBILITY_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-start gap-3 text-sm text-slate-200"
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={opt.value}
                    checked={form.visibility === opt.value}
                    onChange={() => update("visibility", opt.value)}
                    className="mt-1 h-4 w-4 border-white/20 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                  />
                  <span>
                    <span className="font-medium text-slate-100">{opt.label}</span>
                    <span className="block text-xs text-slate-500">{opt.description}</span>
                  </span>
                </label>
              ))}
            </div>

            {form.visibility === "group" && (
              <div className="mt-5 border-t border-white/5 pt-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Gruppen
                </p>
                {!canListGroups ? (
                  <p className="mt-2 text-xs text-amber-200">
                    Du kannst keine Gruppen auswählen, weil dir <code>dashboard.groups</code> fehlt.
                    Ein Admin muss dir die Berechtigung geben oder die Gruppenwahl übernehmen.
                  </p>
                ) : groupsError ? (
                  <p className="mt-2 text-xs text-red-300">{groupsError}</p>
                ) : groups === null ? (
                  <p className="mt-2 text-xs text-slate-400">Lade Gruppen…</p>
                ) : groups.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-400">
                    Es gibt noch keine Gruppen.{" "}
                    <Link
                      to={Routes.Dashboard.Groups}
                      className="text-cyan-300 hover:text-cyan-200"
                    >
                      Jetzt anlegen →
                    </Link>
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {groups.map((g) => {
                      const checked = form.groupIds.includes(g.id);
                      return (
                        <button
                          type="button"
                          key={g.id}
                          onClick={() => toggleGroup(g.id)}
                          className={
                            checked
                              ? "inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-100"
                              : "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-white/30"
                          }
                          aria-pressed={checked}
                        >
                          <span
                            className={
                              checked
                                ? "inline-block h-2 w-2 rounded-full bg-cyan-300"
                                : "inline-block h-2 w-2 rounded-full bg-slate-600"
                            }
                          />
                          {g.displayName}
                          <span className="text-[10px] uppercase tracking-wider text-slate-500">
                            {g.memberCount}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {canListGroups && groups && form.groupIds.length === 0 && (
                  <p className="mt-3 text-xs text-amber-200">
                    Mindestens eine Gruppe wählen, sonst kann niemand den Beitrag sehen.
                  </p>
                )}
              </div>
            )}
          </fieldset>

          <div>
            <div className="block text-xs font-semibold uppercase tracking-widest text-slate-400">
              Inhalt (Markdown / GFM)
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Toolbar für Formatierung, Listen, Überschriften, Links, Bilder und Code-Blöcke.
              Live-Vorschau lässt sich rechts umschalten.
            </p>
            <div
              className="mt-2 overflow-hidden rounded-xl border border-white/10"
              data-color-mode="dark"
            >
              <MDEditor
                value={form.content}
                onChange={(value) => update("content", value ?? "")}
                height={560}
                preview="live"
                visibleDragbar={false}
                previewOptions={{
                  rehypePlugins: [[rehypeHighlight]]
                }}
              />
            </div>
          </div>

          <label className="flex items-center gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={form.publish}
              onChange={(e) => update("publish", e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
            />
            {isEdit && initial?.publishedAt ? "Veröffentlicht lassen" : "Jetzt veröffentlichen"}
          </label>

          {saveError && <p className="text-sm text-red-300">{saveError}</p>}

          <div className="flex items-center gap-3">
            <button type="submit" className="btn" disabled={saving}>
              {saving ? "Speichere…" : isEdit ? "Speichern" : "Erstellen"}
            </button>
            <Link to={Routes.Dashboard.Blog} className="btn-outline">
              Abbrechen
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
