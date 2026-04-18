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

# caddy:2-alpine's default user is root, so we create a non-privileged user
# and hand over ownership of the writable dirs Caddy touches at startup.
# Closes SonarCloud docker:S6471.
FROM caddy:2-alpine
RUN adduser -D -u 10001 -g caddyuser caddyuser \
    && mkdir -p /data/caddy /config/caddy \
    && chown -R 10001:10001 /data /config
COPY --chown=10001:10001 Caddyfile /etc/caddy/Caddyfile
COPY --from=static --chown=10001:10001 /static/ /srv/
USER 10001
EXPOSE 8080
