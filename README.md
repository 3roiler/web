# broiler.dev

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=3roiler_web&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=3roiler_web)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=3roiler_web&metric=bugs)](https://sonarcloud.io/summary/new_code?id=3roiler_web)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=3roiler_web&metric=code_smells)](https://sonarcloud.io/summary/new_code?id=3roiler_web)
[![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=3roiler_web&metric=duplicated_lines_density)](https://sonarcloud.io/summary/new_code?id=3roiler_web)
[![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=3roiler_web&metric=ncloc)](https://sonarcloud.io/summary/new_code?id=3roiler_web)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=3roiler_web&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=3roiler_web)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=3roiler_web&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=3roiler_web)
[![Technical Debt](https://sonarcloud.io/api/project_badges/measure?project=3roiler_web&metric=sqale_index)](https://sonarcloud.io/summary/new_code?id=3roiler_web)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=3roiler_web&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=3roiler_web)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=3roiler_web&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=3roiler_web)
[![DigitalOcean Referral Badge](https://web-platforms.sfo2.cdn.digitaloceanspaces.com/WWW/Badge%202.svg)](https://www.digitalocean.com/?refcode=203d563657de&utm_campaign=Referral_Invite&utm_medium=Referral_Program&utm_source=badge)

Frontend für [broiler.dev](https://broiler.dev/) — eine React-SPA mit Landingpage,
Blog, Streamclips-Voting, 3D-Drucker-Dashboard und Admin-Bereich. Wird statisch
gebaut und hinter einem Caddy-Server ausgeliefert; sämtliche dynamischen Daten
kommen aus der Schwester-API [3roiler/api](https://github.com/3roiler/api).

## Tech-Stack

- **React 19** + **TypeScript 6**, gebündelt mit **Vite 8**
- **Tailwind CSS v4** (via `@tailwindcss/vite`)
- **react-router-dom 7** für SPA-Routing, **axios** für API-Calls
- **three.js** für den STL-Viewer, **CodeMirror 6** für den G-code-Editor
- **@uiw/react-md-editor** + `react-markdown` / `rehype-highlight` / `remark-gfm` für den Blog
- Routenebene per `React.lazy` code-gesplittet — Initial-Bundle liegt bei ~70 kB gzip
  (siehe Kommentare in `src/main.tsx` und `vite.config.js`)

## Features

Was die Seite heute kann (gruppiert, nicht erschöpfend):

### Public

- **Landing-/Homepage** mit animiertem Partikel-Netzwerk hinter dem Hero
  (statischer Fallback bei `prefers-reduced-motion`)
- **Blog** mit Markdown-Rendering, GFM, Syntax-Highlighting und Kommentaren;
  RSS-Feed unter `/blog/rss.xml` (von der API geliefert)
- **Streamclips** mit Voting, Sterne-Rating, Awards, Leaderboard, Contributors-
  Seite, „Related"- und „Für-dich"-Karussells, Kommentaren und Clip-Detail
  ohne Login-Zwang
- **404** mit eigenem Partikel-Netzwerk und Konami-Easter-Egg
- **Statische Seiten**: Impressum, Datenschutz; statische HTML-Fallbacks
  (`alex.html`, `huh.html`, `sasu.html`) werden direkt aus dem Image serviert

### Kommentare & Moderation

- Threaded Replies mit beliebiger Tiefe, visueller Einzug bei 5 Ebenen gekappt
- Anonymisierung gelöschter Autoren (`authorDeletedAt`) statt Hard-Delete
- Mutes pro User; Mod-UI mit Warnhinweis, keine PII in Löschgründen abzulegen

### Dashboard (auth-gated)

- Vereinheitlichter `/dashboard`-Shell mit gruppierter Sidebar-Navigation und
  unabhängigem Scrolling ab `lg`-Breakpoint
- Paginierte Listen für Clips, Reports, Mutes, Awards, Clip-Kategorien
- **DigitalOcean-Metriken**-Seite mit Live-Charts (Multi-App-Support)
- **Site-Settings** inkl. verschlüsselter Secrets, Blog-Sichtbarkeit,
  Clip-Intake-Moderation und Für-dich-Tuning
- **Self-Service-Profil** mit Social-Links
- **Admin**: paginierte User-Liste, Gruppen-Management, Member-Suche,
  User-Edit/-Delete

### 3D-Drucker

- Drucker-Übersicht, Detail-Seiten, Jobs, Druckanfragen mit Approval-Flow
- Access-Management pro Drucker
- In-Browser **G-code-Editor** (CodeMirror, lazy-loaded)
- **STL-Viewer** auf Basis von three.js (lazy-loaded, ~150 kB gzip)

### SEO, Ads, Security

- Pro-Seite Meta-Tags, Open Graph, JSON-LD, `robots.txt`
- Dynamische `sitemap.xml` (Reverse-Proxy auf die API)
- Social-Crawler (Facebook, Discord, WhatsApp, Bsky, Mastodon, …) werden über
  einen User-Agent-Match in der Caddy-Config an den Open-Graph-Renderer der
  API umgeleitet — echte Nutzer kriegen die SPA
- **Google AdSense** mit **Consent Mode** v2, `ads.txt` im Image
- **X-CSRF-Token** wird bei mutierenden API-Requests mitgeschickt
- Caddy setzt **HSTS** (mit `preload`), **CSP**, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors 'none'` —
  siehe [`Caddyfile`](./Caddyfile)
- OAuth-Login via **GitHub** und **Twitch**

### CI

- `.github/workflows/docker-build.yaml`: Build & Push nach GHCR auf
  `main` und `staging`
- `.github/workflows/lighthouse.yaml`: Lighthouse-CI gegen den Production-Build
  mit Thresholds (Performance & A11y ≥ 0.9, SEO ≥ 0.95) auf jedem PR

## Quickstart

### Dev-Container (empfohlen)

`.devcontainer/devcontainer.json` definiert ein TypeScript-Node-22-Image; VS
Code mit der „Dev Containers"-Extension öffnet das Repo direkt darin, und der
`postStartCommand` ruft `npm install` auf. Danach:

```bash
npm run dev
```

Vite startet mit `--host`, das Dev-Server-Port (5173) ist also auch von außen
erreichbar — praktisch fürs Testen vom Handy im selben Netz.

### Lokal ohne Container

```bash
npm install
npm run dev
```

Voraussetzung: Node ≥ 22 (das Produktions-Image baut auf `node:26-alpine`).

## Scripts

| Script | Zweck |
| --- | --- |
| `npm run dev` | Vite Dev-Server (`--host`, HMR) |
| `npm run build` | Produktions-Build nach `dist/` |

Es gibt aktuell **keine** Test- oder Lint-Scripts in `package.json`. Statische
Analyse läuft über SonarCloud, Performance/A11y über Lighthouse-CI im
GitHub-Actions-Workflow.

## Build & Deploy

Multi-Stage-`Dockerfile`:

1. `node:26-alpine` baut den Vite-Output
2. `alpine:3` bündelt `dist/` + statische HTML-Fallbacks + `favicon.ico`
3. `caddy:2-alpine` serviert auf Port `8080` als non-root (`uid 10001`)

Image landet bei jedem Push auf `main`/`staging` in
`ghcr.io/3roiler/web`. TLS-Terminierung übernimmt der DigitalOcean-Load-
Balancer, deshalb läuft Caddy mit `auto_https off`.

## Verwandte Repos

- [3roiler/api](https://github.com/3roiler/api) — Node/Express-Backend,
  PostgreSQL, Redis; liefert Auth, Blog-Inhalte, Streamclips, Sitemap,
  OG-Renderer, RSS

## Project Links

- 🌐 [Project Website](https://broiler.dev/)
- 📊 [SonarCloud Project Overview](https://sonarcloud.io/project/overview?id=3roiler_web)
