# CLAUDE.md — `3roiler/web`

## Project

`broiler.dev` is Paul Wechselberger's personal site: portfolio + blog +
3D-print workflow tooling + "Streamclips Germany" (a community platform for
German Twitch clips). This repo is the **frontend only** — a React 19 +
TypeScript SPA built with Vite, served as static files by Caddy from a Docker
image. The backend lives in `3roiler/api` (Node/Express + Postgres + Redis)
at `api.broiler.dev`.

## Commands

| Task                | Command                  | Notes                                                          |
| ------------------- | ------------------------ | -------------------------------------------------------------- |
| Dev server          | `npm run dev`            | `vite --host`, default port 5173. Hot reload.                  |
| Production build    | `npm run build`          | Output to `dist/`. Vite rewrites `index.html` to hashed assets.|
| Docker image (prod) | `docker build -t web .`  | Multi-stage: node-builder → alpine static → `caddy:2-alpine`.  |
| Docker run          | `docker run -p 8080:8080 web` | Serves on `:8080` as UID `10001`.                         |
| Lighthouse CI       | `npx lhci autorun --config=lighthouserc.json` | Needs prior `npm run build`. Thresholds are `warn`, not gate.|

No lint, format, or test script is defined. Quality is enforced externally
via SonarCloud (project key `3roiler_web`) and the Lighthouse CI workflow on
PRs touching frontend files.

## Architecture

### Layout

```
src/
  main.tsx                 # BrowserRouter + all <Route> definitions; lazy-loads heavy pages
  config/api.ts            # API base-URL switching (Prod/Staging/Dev) + window.__api helper
  config/routes.ts         # Single source of truth for all paths (the Routes object)
  services/index.tsx       # ~2.3k LOC axios client — ALL backend calls live here
  lib/url.ts               # safeHttpUrl() — sanitizes backend strings used as href/src
  lib/asset-helpers.ts     # Shared formatters for size/date/duration in file lists
  components/              # Header, Footer, DashboardLayout, Seo, ParticleField, …
  components/comments/     # Shared threaded comments (used by both clips and blog)
  components/streamclips/  # Clip atoms (ClipEmbed, ClipCard, StarRating, …)
  pages/                   # One file per route; PascalCase ending in `Page` export
  pages/streamclips/       # The /streamclips/* public surface
```

`index.html` is the Vite source template (references `/src/main.tsx` directly);
the build rewrites it. `style.css` is the global Tailwind entry plus a small
hand-written component layer. Static fallback HTMLs (`alex.html`, `huh.html`,
`sasu.html`) and `favicon.ico`/`robots.txt`/`ads.txt` live at repo root and are
copied into `/srv/` by the Dockerfile.

### Routing

`react-router-dom` v7 with a single flat `<Routes>` block in `main.tsx`. All
paths come from `src/config/routes.ts` — never hard-code a path in JSX.
Heavy routes are `React.lazy`'d to keep the initial bundle ~70 kB gzip:
`BlogEdit`, `BlogPost`, `GcodeEditor`, `Stl`, `StlViewer` (highlight.js,
CodeMirror, and three.js respectively). The `chunkSizeWarningLimit` in
`vite.config.js` is raised to 1 MB for these chunks; a new always-loaded
page tripping the warning is a real regression.

Page categories:

- **Public**: `Home`, `Blog`, `BlogPost`, `Datenschutz`, `Impressum`, `NotFound`.
- **Streamclips public**: `/streamclips/*` — Landing, Vote, Submit, Leaderboard, Contributors, ClipDetail, Me.
- **Dashboard (auth + permission gated)**: every `/dashboard/*` route. Uses the
  shared `DashboardLayout` shell, which calls `getMe()`, gates on a
  `requiredPermission` string, and renders the sidebar (`NAV_GROUPS`).
- **OAuth callbacks**: `/callback/{github,twitch,error}`.

### API client

A single `axios` client in `src/services/index.tsx`. All requests use
`withCredentials: true` (session + CSRF cookies are cross-subdomain from
`api.broiler.dev` to `broiler.dev`). Errors are normalised through
`toApiError` → typed `ApiError(status, identifier, message)`.

- **Base URL** from `config/api.ts`. `DEV` → `http://localhost:3000/api` (the
  `/api` prefix is required — the local API mounts under `config.prefix`); else
  → `https://api.broiler.dev/prod`. Runtime override in the dev console:
  `window.__api.switch("Staging")`.
- **CSRF**: double-submit-cookie. Backend sets `XSRF-TOKEN`, the SPA reads the
  value via `GET /csrf` (cross-subdomain → cookie isn't JS-readable), caches
  it, and sends `X-CSRF-Token` on POST/PUT/PATCH/DELETE. A `403 CSRF_TOKEN`
  response triggers exactly one refetch + retry via interceptor.
- **OAuth**: state is server-issued. `GET /{github|twitch}/oauth-state` returns
  a token in the body and sets a short-lived HttpOnly cookie; the callback
  POSTs `{code, state}` and the backend validates body against cookie. The
  old client-side random `state` was replaced to fix login-CSRF (commit
  `1ee45f5`).

### Auth flow

`getMe()` is the single source of truth for "who am I + what can I do." The
session cookie is HttpOnly; **never** persist `User` (especially
`permissions[]`) into `localStorage`. UI permission checks are purely for UX —
the backend always re-checks. Common gates: `dashboard.view`, `admin.manage`
(umbrella), `dashboard.{blog,clips,users,groups,printers,settings,metrics}`,
`print.{request,moderate}`, `clips.moderate`.

### SEO + crawlers + OG renderer

Per-route metadata via the `<Seo>` component (React 19 hoists `<title>` /
`<meta>` / `<link>` into `<head>`). JSON-LD via `<JsonLd>`. For link
unfurling, the Caddyfile sniffs the User-Agent for known crawlers
(`facebookexternalhit`, `discordbot`, `whatsapp`, `mastodon`, …) on
`/streamclips/clip/*` and `/blog/*` and reverse-proxies them to
`api.broiler.dev/prod/og{path}` — the **OG renderer lives in the `api` repo**
and returns crawler-friendly HTML. Real users always hit the SPA.
`sitemap.xml` and `/blog/rss.xml` are also reverse-proxied to the API.

## Conventions

- **TypeScript**: `strict: true`, `noFallthroughCasesInSwitch: true`,
  `noUncheckedIndexedAccess: false`, `jsx: react-jsx`. No path aliases —
  relative imports only.
- **No barrel files** except `src/services/index.tsx`. Import pages/components
  by their explicit path.
- **Component pattern**: one PascalCase component per file; pages export
  `FooPage`; other components export a named function. Heavy local
  sub-components stay in the same file rather than being split prematurely.
- **Styling**: Tailwind **v4** via `@tailwindcss/vite` (NOT PostCSS).
  `style.css` does `@import "tailwindcss";`. `tailwind.config.js` still exists
  and sets `fontFamily.sans` (Space Grotesk) + `colors.brand` (cyan). The
  semantic classes (`.btn`, `.nav-link`, `.card`, `.panel`, `.section-panel`,
  `.blog-content`, `.menu-item`) are plain CSS, not `@apply` (works around the
  lint setup). Mobile-first; wider spacing kicks in at `min-width: 640px`.
- **Dark-only**: `color-scheme: dark`, body `#020617`. No light theme.
- **Language**: site is German; user-facing strings and DocBlock comments are
  German, identifiers and most code comments are English. Match what's around
  you.
- **Lazy-load anything heavy** (highlight.js, CodeMirror, three.js, the MD
  editor). A non-lazy `import` of `@uiw/react-md-editor` balloons the initial
  bundle and trips the chunk-size warning.

## Gotchas

- **`CLAUDE.md` is gitignored** (`.gitignore` line 11). This file lives on disk
  only; do not try to commit it.
- **Sanitize backend URL strings** before using them in `href`/`src`. Use
  `safeHttpUrl()` from `src/lib/url.ts` — the round-trip through `new URL()`
  is what marks the value as sanitized for CodeQL and rejects `javascript:`.
- **Comment anonymisation** is signalled by `comment.authorDeletedAt !== null`,
  NOT by the display name. The "Gelöschter Nutzer" name check is only a
  fallback for cache-mismatch cases (review #13, commit `aa8b98c`). Moderator
  deletion reasons are visible to users — warn mods not to paste PII
  (review #11).
- **Mutating requests need the CSRF interceptor.** Don't call `axios` outside
  `src/services/index.tsx` for writes; the request-config augmentation lives
  on the shared default instance.
- **Route ordering**: literal segments before `:param` segments
  (`/dashboard/gcode/new` before `/dashboard/gcode/:id/edit`). React-Router 7
  rank-orders, but keeping the obvious order avoids surprises.
- **Twitch embeds** must pass `parent=<current hostname>` — `ClipEmbed`
  derives this from `globalThis.location.hostname`, so it works on
  `broiler.dev` and `localhost`; a new embedding origin needs Twitch's
  allowlist updated.
- **AdSense + Consent Mode v2** boots in `index.html` with all consent
  defaults set to `denied` and `wait_for_update: 500`. The Google CMP runs
  the banner. The CSP in `Caddyfile` enumerates every external origin the
  page may reach (Google Fonts, AdSense, Tag Manager, Twitch clips) — adding
  a new third-party means editing the CSP, not just the code.
- **`/csrf`, `/sitemap.xml`, `/blog/rss.xml`, OG bot rewrites** are
  Caddy-handled; in `npm run dev` they don't exist locally. The SPA degrades
  gracefully (CSRF interceptor handles missing token; OG only matters to
  crawlers).
- **`prefers-reduced-motion`** is honoured in two places: `ParticleField`
  renders a static frame instead of animating, and `ViewTransitions` skips
  binding its click listener entirely. Don't add animations that ignore it.
- **Node versions drift**: devcontainer 22, Docker builder 26-alpine,
  Lighthouse CI 24. Only the Dockerfile version is shipped.
- **Mobile-first viewport**: header collapses below `md`; dashboard sidebar
  becomes a horizontal tab strip on mobile (group labels dropped). Test
  changes at ~360 px width.
