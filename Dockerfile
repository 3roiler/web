FROM node:25-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY src ./src
COPY index.html style.css vite.config.js tailwind.config.js ./
RUN npm ci --ignore-scripts
RUN npm run build

# nginxinc/nginx-unprivileged runs as the non-root "nginx" user (UID 101)
# out of the box and listens on 8080 — closes SonarCloud docker:S6471.
FROM nginxinc/nginx-unprivileged:alpine
WORKDIR /usr/share/nginx/html
COPY --from=builder /app/dist/ ./
COPY huh.html ./huh.html
COPY alex.html ./alex.html
COPY sasu.html ./sasu.html
COPY favicon.ico ./favicon.ico
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]