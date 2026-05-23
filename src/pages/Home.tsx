import * as React from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Routes } from "../config/routes";
import { Seo, JsonLd, SITE_URL } from "../components/Seo";
import { ParticleField } from "../components/ParticleField";

/**
 * Hover-Tilt mit Maus-Verfolgung für Project-Cards. Berechnet aus der
 * Cursor-Position innerhalb der Karte zwei Drehwinkel und schreibt sie
 * via CSS-Custom-Properties — der eigentliche Transform sitzt im
 * ClassName, damit Tailwind-Hover-Effekte (translate, shadow) frei mit
 * dem 3D-Tilt komponieren können.
 *
 * Deaktiviert bei `prefers-reduced-motion` (kein 3D-Trick, nur Default-
 * Hover-Animation aus Tailwind) und bei `pointer: coarse` (Touch ohne
 * Hover-Phase — der Tilt würde nie greifen, der Listener nur Energie
 * kosten).
 */
function useTilt() {
  const ref = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!matchMedia('(pointer: fine)').matches) return;

    const onMove = (event: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      // Normalisiert auf -0.5 … +0.5 mit Mittelpunkt = 0
      const nx = (event.clientX - rect.left) / rect.width - 0.5;
      const ny = (event.clientY - rect.top) / rect.height - 0.5;
      // Max 6° in jeder Achse — darüber wird der Tilt unangenehm.
      el.style.setProperty('--tilt-x', `${(-ny * 6).toFixed(2)}deg`);
      el.style.setProperty('--tilt-y', `${(nx * 6).toFixed(2)}deg`);
    };

    const onLeave = () => {
      el.style.setProperty('--tilt-x', '0deg');
      el.style.setProperty('--tilt-y', '0deg');
    };

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return ref;
}

function handleContactSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const name = String(data.get('name') ?? '').trim();
  const email = String(data.get('email') ?? '').trim();
  const message = String(data.get('message') ?? '').trim();

  const subject = encodeURIComponent(`Anfrage über broiler.dev — ${name || 'Unbekannt'}`);
  const body = encodeURIComponent(
    `Name: ${name}\nE-Mail: ${email}\n\n${message}`
  );

  globalThis.location.href = `mailto:${Routes.External.WebmasterEmail}?subject=${subject}&body=${body}`;
}

/**
 * Homepage — public-facing profile.
 *
 * Section layout:
 *   #top       — Hero (positioning, stack pills, primary CTAs)
 *   #about     — Bio + fact column
 *   #skills    — Stack grouped into four category cards
 *   #projects  — Generic work description + two open-source project cards
 *   #contact   — Social channels + contact form
 *
 * Visual rhythm alternates between `bg-slate-950` and a slightly lifted
 * `bg-slate-900/40` to give readers a break between blocks without adding
 * new accent colors beyond the existing cyan.
 */
export function HomePage() {
  return (
    <>
      <Seo title="Paul Wechselberger — Platform & Backend Engineer" />
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Person",
            name: "Paul Wechselberger",
            alternateName: "3roiler",
            url: SITE_URL,
            jobTitle: "Platform & Backend Engineer",
            sameAs: [Routes.External.GithubProfile, Routes.External.LinkedIn, Routes.External.Mastodon]
          },
          { "@context": "https://schema.org", "@type": "WebSite", name: "broiler.dev", url: SITE_URL }
        ]}
      />
      {/* ─── Hero ───────────────────────────────────────────────────────── */}
      {/* `isolate` erzeugt einen neuen Stacking-Context, damit die Hero-
          internen `-z-*` Schichten (Partikel, Glow, Grid) garantiert
          INNERHALB des Hero bleiben und nicht hinter den Body-Hintergrund
          rutschen. Ohne das funktioniert der Trick zwar oft, ist aber
          browser-spezifisch fragil. */}
      <header id="top" className="relative isolate overflow-hidden bg-slate-950 pt-32 pb-24 sm:pt-40 sm:pb-32">
        {/* Knoten-Netz im Hintergrund. Liegt unter „Ambient glow" und Grid,
            damit der Glow sanft über die Partikel washt und die Linien nicht
            knochig wirken. */}
        <ParticleField className="pointer-events-none absolute inset-0 -z-20" />
        {/* Ambient glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-20 -z-10 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-cyan-500/15 blur-[120px] sm:h-[700px] sm:w-[700px]"
        />
        {/* Subtle grid — bewusst über dem Partikel-Layer, damit die Punkte
            sich in das vorhandene Raster einreihen und nicht „über" der
            Seite zu schweben scheinen. Geringere Opacity als zuvor (0.05
            statt 0.08), sonst konkurriert das Grid mit den Linien. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_1px_1px,rgba(148,163,184,0.05)_1px,transparent_0)] bg-[size:32px_32px]"
        />

        <div className="relative mx-auto max-w-6xl px-6 sm:px-10 lg:px-16">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400">
            Paul Wechselberger · Platform &amp; Backend Engineer
          </p>

          <h1 className="mt-8 max-w-3xl text-4xl font-semibold leading-[1.1] text-slate-50 sm:text-5xl lg:text-6xl">
            Infrastruktur und Software,
            <br />
            <span className="text-cyan-400">die im Betrieb hält.</span>
          </h1>

          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-slate-300">
            Ich baue und betreibe Plattformen auf Kubernetes, schreibe Backend-Services
            in .NET und TypeScript und kümmere mich um alles dazwischen — CI/CD,
            Observability, Secrets-Management und Deployments.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <a href="#projects" className="btn">Projekte ansehen</a>
            <Link to={Routes.Blog} className="btn-outline">Blog lesen</Link>
            <a href="#contact" className="btn-outline">Kontakt</a>
          </div>

          <ul className="mt-14 flex flex-wrap gap-2 text-xs text-slate-400">
            {['TypeScript', '.NET / C#', 'Kubernetes', 'PostgreSQL', 'Terraform', 'Prometheus'].map((tag) => (
              <li
                key={tag}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono tracking-tight"
              >
                {tag}
              </li>
            ))}
          </ul>
        </div>
      </header>

      <main>
        {/* ─── About ─────────────────────────────────────────────────────── */}
        <section
          id="about"
          className="border-t border-white/5 bg-slate-900/40 py-24"
        >
          <div className="mx-auto max-w-6xl px-6 sm:px-10 lg:px-16">
            <div className="grid gap-16 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400">
                  Über mich
                </p>
                <h2 className="mt-4 text-3xl font-semibold text-slate-50 sm:text-4xl">
                  Platform Engineering, End-to-End.
                </h2>

                <div className="mt-8 space-y-6 text-base leading-relaxed text-slate-300">
                  <p>
                    Mein Feld ist die Schnittstelle zwischen Infrastruktur und
                    Anwendungscode. Ich übernehme gerne das ganze Bild — vom Worker-Node
                    über Kubernetes-Manifest, CI/CD-Pipeline und Observability-Stack bis
                    zum API-Endpoint, den am Ende jemand konsumiert.
                  </p>
                  <p>
                    Ich arbeite dokumentations-getrieben und bevorzuge explizite,
                    zusammensetzbare Lösungen gegenüber magischen Frameworks.
                    Entscheidungen halte ich schriftlich fest — mit ADRs, README und
                    nachvollziehbaren Begründungen, sodass die nächste Person nach mir
                    lesen, verstehen und weiterführen kann.
                  </p>
                  <p>
                    Am stärksten bin ich da, wo heterogene Systeme zuverlässig
                    miteinander reden müssen: Legacy trifft Modern, On-Prem trifft Cloud,
                    proprietäres Format trifft sauberes REST.
                  </p>
                </div>
              </div>

              <aside className="space-y-4">
                <FactCard label="Rolle" value="Platform & Backend Engineer" />
                <FactCard label="Arbeitsweise" value="Dokumentations-getrieben, explizit, integrationsstark" />
                <FactCard label="Offen für" value="Projektanfragen, fachlichen Austausch, spannende Probleme" />
              </aside>
            </div>
          </div>
        </section>

        {/* ─── Stack ─────────────────────────────────────────────────────── */}
        <section
          id="skills"
          className="border-t border-white/5 bg-slate-950 py-24"
        >
          <div className="mx-auto max-w-6xl px-6 sm:px-10 lg:px-16">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400">
                Stack
              </p>
              <h2 className="mt-4 text-3xl font-semibold text-slate-50 sm:text-4xl">
                Womit ich arbeite.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-400">
                Ein Querschnitt dessen, was produktiv bei mir im Einsatz ist — sowohl in
                meinem Hauptberuf als auch in persönlichen Projekten.
              </p>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              <SkillCard
                glyph="{ }"
                title="Languages & Runtimes"
                items={['TypeScript · Node.js', 'C# · .NET 8+', 'Bash, YAML', 'PL/pgSQL']}
              />
              <SkillCard
                glyph="◇"
                title="Platform & Infra"
                items={['Kubernetes (on-prem)', 'Terraform · Kustomize', 'Docker (multi-stage)', 'Caddy · Traefik']}
              />
              <SkillCard
                glyph="≣"
                title="Data"
                items={['PostgreSQL · pgvector', 'Redis (Sentinel)', 'SQL Server · ODBC', 'Object Storage (S3/MinIO)']}
              />
              <SkillCard
                glyph="◉"
                title="Observability & DevEx"
                items={['Prometheus · Grafana · Loki', 'Jenkins · GitHub Actions', 'SOPS · age (Secrets)', 'SonarCloud · Semgrep']}
              />
            </div>
          </div>
        </section>

        {/* ─── Projects ──────────────────────────────────────────────────── */}
        <section
          id="projects"
          className="border-t border-white/5 bg-slate-900/40 py-24"
        >
          <div className="mx-auto max-w-6xl px-6 sm:px-10 lg:px-16">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400">
                  Arbeit
                </p>
                <h2 className="mt-4 text-3xl font-semibold text-slate-50 sm:text-4xl">
                  Was ich baue.
                </h2>
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-400">
                  Ein Überblick über das, was ich beruflich verantworte, und offene
                  Referenzen aus meinen persönlichen Projekten.
                </p>
              </div>
              <a
                href={Routes.External.GithubProfile}
                className="btn-outline self-start sm:self-end"
                target="_blank"
                rel="noopener"
              >
                Alles auf GitHub
              </a>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              <ProjectCard
                title="Platform Engineering"
                subtitle="Beruflich"
                description="Verantwortung für eine on-prem Kubernetes-Plattform inklusive CI/CD, Observability-Stack, Secrets-Flow und Storage — plus die darauf laufenden Backend-Services in .NET/C#, die heterogene Systeme zuverlässig miteinander verbinden."
                tags={['Kubernetes', 'Prometheus', 'Jenkins', '.NET', 'SOPS']}
              />
              <ProjectCard
                title="broiler.dev"
                subtitle="Open Source"
                description="Diese Seite. React 19 + Vite + Tailwind 4, deployed über GitHub Actions nach DigitalOcean, ausgeliefert von Caddy. Pragmatisch gehalten, aber ohne technische Abkürzungen."
                tags={['React', 'TypeScript', 'Vite', 'Caddy']}
                href={Routes.External.GithubRepositoryWeb}
              />
              <ProjectCard
                title="api.broiler.dev"
                subtitle="Open Source"
                description="Die REST-API hinter dieser Seite. Express 5 auf Node 24, Auth via GitHub-OAuth und JWT, persistiert auf PostgreSQL + Redis, Migrationen über node-pg-migrate, feingranulare Permissions."
                tags={['Node.js', 'Express', 'PostgreSQL', 'Redis', 'JWT']}
                href={Routes.External.GithubRepositoryApi}
              />
            </div>

            <div className="mt-12 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm leading-relaxed text-slate-400 sm:flex sm:items-center sm:justify-between sm:gap-6">
              <p>
                Notizen, Entscheidungen und technische Rückblicke schreibe ich im Blog auf.
              </p>
              <Link to={Routes.Blog} className="btn-outline mt-4 self-start sm:mt-0 sm:self-auto">
                Zum Blog
              </Link>
            </div>
          </div>
        </section>

        {/* ─── Contact ───────────────────────────────────────────────────── */}
        <section
          id="contact"
          className="border-t border-white/5 bg-slate-950 py-24"
        >
          <div className="mx-auto grid max-w-6xl gap-12 px-6 sm:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:px-16">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400">
                Kontakt
              </p>
              <h2 className="mt-4 text-3xl font-semibold text-slate-50 sm:text-4xl">
                Sprechen wir.
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-slate-400">
                Bei Projektanfragen, fachlichem Austausch oder einem Kaffee — ich melde
                mich zurück. Am schnellsten per E-Mail.
              </p>

              <ul className="mt-8 flex flex-wrap gap-3">
                <li>
                  <a href={`mailto:${Routes.External.WebmasterEmail}`} className="badge-link">
                    E-Mail
                  </a>
                </li>
                <li>
                  <a href={Routes.External.GithubProfile} className="badge-link" target="_blank" rel="noopener">
                    GitHub
                  </a>
                </li>
                <li>
                  <a href={Routes.External.LinkedIn} className="badge-link" target="_blank" rel="noopener">
                    LinkedIn
                  </a>
                </li>
                <li>
                  <a href={Routes.External.Mastodon} rel="me noopener" className="badge-link" target="_blank">
                    Mastodon
                  </a>
                </li>
              </ul>
            </div>

            <form
              onSubmit={handleContactSubmit}
              className="group relative flex flex-col gap-6 overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_20px_40px_-40px_rgba(15,194,207,0.6)] transition-all duration-300 hover:border-cyan-400/40 hover:shadow-[0_30px_90px_-45px_rgba(15,194,207,0.65)] sm:p-10"
            >
              <div>
                <label htmlFor="name" className="text-sm font-medium text-slate-200">Name</label>
                <input
                  id="name"
                  name="name"
                  placeholder="Max Mustermann"
                  required
                  autoComplete="name"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-slate-100 placeholder-slate-400 shadow-sm transition duration-200 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>

              <div>
                <label htmlFor="email" className="text-sm font-medium text-slate-200">E-Mail</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="max@example.com"
                  required
                  autoComplete="email"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-slate-100 placeholder-slate-400 shadow-sm transition duration-200 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>

              <div>
                <label htmlFor="message" className="text-sm font-medium text-slate-200">Nachricht</label>
                <textarea
                  id="message"
                  name="message"
                  placeholder="Worum geht es?"
                  required
                  className="mt-2 w-full min-h-[160px] rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-slate-100 placeholder-slate-400 shadow-sm transition duration-200 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>

              <div className="flex flex-col gap-3 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                <label className="inline-flex items-start gap-2 leading-snug">
                  <input type="checkbox" name="privacy" value="accepted" required className="mt-0.5 accent-cyan-500" />
                  <span>Ich stimme der Verarbeitung meiner Daten zum Zweck der Kontaktaufnahme zu.</span>
                </label>
                <Link to={Routes.Datenschutz} className="text-cyan-300 decoration-dotted hover:text-cyan-200">
                  Datenschutz einsehen
                </Link>
              </div>

              <button type="submit" className="btn w-full sm:w-auto sm:self-start">
                Nachricht senden
              </button>
            </form>
          </div>
        </section>
      </main>
    </>
  );
}

/* ───────── Helper components ─────────────────────────────────────────── */

interface FactCardProps {
  label: string;
  value: string;
}

function FactCard({ label, value }: FactCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-2 text-sm leading-relaxed text-slate-200">{value}</dd>
    </div>
  );
}

interface SkillCardProps {
  /** Kurzes Schriftzeichen-Symbol als „Icon" — bewusst Glyph statt SVG,
   *  damit der Stack ohne zusätzliche Asset-Dependencies auskommt. */
  glyph: string;
  title: string;
  items: string[];
}

function SkillCard({ glyph, title, items }: SkillCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:-translate-y-0.5 hover:border-cyan-400/40 hover:shadow-[0_24px_60px_-45px_rgba(15,194,207,0.45)]">
      {/* Dünner cyan-Top-Akzent, der bei Hover „eingeschaltet" wird —
          subtile Bestätigung dass die Karte interaktiv ist, ohne
          aggressive Farbflächen. */}
      <span
        aria-hidden="true"
        className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/0 to-transparent transition-all duration-500 group-hover:via-cyan-400/70"
      />
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-slate-950/60 font-mono text-base text-cyan-300 transition group-hover:border-cyan-400/40 group-hover:text-cyan-200"
        >
          {glyph}
        </span>
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
          {title}
        </h3>
      </div>
      <ul className="mt-5 space-y-2 text-sm text-slate-300">
        {items.map((item) => (
          <li key={item} className="font-mono text-[0.8rem] tracking-tight text-slate-300">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

interface ProjectCardProps {
  title: string;
  subtitle: string;
  description: string;
  tags: string[];
  href?: string;
}

function ProjectCard({ title, subtitle, description, tags, href }: ProjectCardProps) {
  const tiltRef = useTilt();
  const body = (
    <>
      {/*
        Sheen-Layer: ein sehr dünner Cyan-Gradient, der nur beim Hover
        aufblendet. Liegt unter dem Content und bekommt dieselbe
        rounded-2xl-Border-Radius wie der Container, damit er bei der
        Maus-Bewegung nicht „über die Ecke" tröpfelt.
      */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500/0 via-cyan-400/0 to-cyan-500/0 opacity-0 transition-opacity duration-300 group-hover:from-cyan-500/8 group-hover:via-cyan-400/4 group-hover:to-transparent group-hover:opacity-100"
      />
      <div className="relative flex h-full flex-col">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            {subtitle}
          </span>
          {href && (
            <span
              aria-hidden="true"
              className="text-xs text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-cyan-300"
            >
              ↗
            </span>
          )}
        </div>
        <h3 className="mt-3 text-lg font-semibold text-slate-50">{title}</h3>
        <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-300">{description}</p>
        <ul className="mt-5 flex flex-wrap gap-1.5 text-[0.7rem]">
          {tags.map((t) => (
            <li
              key={t}
              className="rounded-full border border-white/10 bg-slate-950/60 px-2 py-0.5 font-mono tracking-tight text-slate-400"
            >
              {t}
            </li>
          ))}
        </ul>
      </div>
    </>
  );

  // Inline-Styles kapseln den Tilt: die Custom-Properties werden vom
  // Hook gesetzt, die Berechnung läuft über `transform`. `perspective`
  // muss zwingend am gleichen Element wie `rotateX/Y` sitzen — wir
  // können den Effekt deshalb nicht in Tailwind-Klassen ausdrücken.
  const tiltStyle = {
    transform:
      'perspective(900px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))',
    transformStyle: 'preserve-3d' as const,
    transition: 'transform 150ms ease-out, border-color .2s, box-shadow .3s'
  };

  const baseClass =
    "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 hover:border-cyan-400/40 hover:shadow-[0_24px_60px_-45px_rgba(15,194,207,0.55)] will-change-transform";

  if (href) {
    return (
      <a
        ref={tiltRef as React.RefObject<HTMLAnchorElement>}
        href={href}
        target="_blank"
        rel="noopener"
        className={baseClass}
        style={tiltStyle}
      >
        {body}
      </a>
    );
  }
  return (
    <div
      ref={tiltRef as React.RefObject<HTMLDivElement>}
      className={baseClass}
      style={tiltStyle}
    >
      {body}
    </div>
  );
}
