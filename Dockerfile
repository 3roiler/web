FROM node:26-alpine AS builder
WORKDIR /app

# Build-Zeit-Env-Vars für Vite. Vite ersetzt `import.meta.env.VITE_*`
# beim `npm run build` durch String-Literale — Runtime-Env-Vars im
# Caddy-Image sind zu spät. ARG + ENV macht die Variablen im Builder-
# Stage sichtbar, ohne sie ins Runtime-Image durchzureichen (kein
# `ARG` in der finalen Caddy-Stage = Sentry-DSN landet nur im
# gebauten JS-Bundle, nicht in der Container-Umgebung).
#
# DigitalOcean App Platform: in den Component-Settings → Environment
# Variables → `VITE_SENTRY_DSN` mit Scope "Build Time" setzen. DO
# reicht Build-Time-Vars automatisch als `--build-arg` an `docker
# build` durch, sobald sie hier mit `ARG` deklariert sind.
ARG VITE_SENTRY_DSN=""
ARG VITE_SENTRY_TRACES_SAMPLE_RATE="0"
ARG VITE_RELEASE="dev"
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN \
    VITE_SENTRY_TRACES_SAMPLE_RATE=$VITE_SENTRY_TRACES_SAMPLE_RATE \
    VITE_RELEASE=$VITE_RELEASE

COPY package*.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json vite.config.js tailwind.config.js index.html style.css ./
COPY src ./src
RUN npm run build

# Bundle static HTML fallbacks (meme pages, 404, favicon) into a thin layer
# so the runtime image only copies from one known path.
#
# IMPORTANT: do NOT COPY index.html from the repo root — that file is the
# Vite source template and references /src/main.tsx directly. Vite rewrites
# it during `npm run build` to reference the hashed bundle under /assets/.
# The standalone HTML pages are enumerated explicitly to avoid a glob
# (`COPY *.html ./`) clobbering the built index.html.
FROM alpine:3 AS static
WORKDIR /static
COPY --from=builder /app/dist/ ./
COPY favicon.ico ./favicon.ico
COPY alex.html huh.html sasu.html ./
COPY robots.txt ads.txt ./

# caddy:2-alpine defaults to root; we create a dedicated user and fix
# ownership/permissions after the COPYs to avoid SonarCloud docker:S6504
# (which flags every COPY --chown/--chmod as a manual-review hotspot).
FROM caddy:2-alpine
RUN adduser -D -u 10001 -g caddyuser caddyuser \
    && mkdir -p /data/caddy /config/caddy \
    && chown -R 10001:10001 /data /config
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=static /static/ /srv/
RUN chown -R 10001:10001 /etc/caddy /srv \
    && chmod -R u=rX,g=,o= /etc/caddy /srv
USER 10001
EXPOSE 8080
