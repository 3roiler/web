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

# caddy:alpine runs as non-root by default and weighs in comparable to nginx,
# but with a ~10-line Caddyfile instead of a 50+ line nginx.conf.
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=static /static/ /srv/
EXPOSE 8080
