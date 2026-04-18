FROM node:25-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json vite.config.js tailwind.config.js index.html style.css ./
COPY src ./src
RUN npm run build

# Bundle static HTML fallbacks (meme pages, 404, favicon) into a thin layer
# so the runtime image only copies from one known path.
FROM alpine:3 AS static
WORKDIR /static
COPY --from=builder /app/dist/ ./
COPY favicon.ico ./favicon.ico
COPY *.html ./

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
