FROM node:25-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY src ./src
COPY index.html style.css vite.config.js tailwind.config.js ./
RUN npm ci --ignore-scripts
RUN npm run build

FROM nginx:alpine
WORKDIR /usr/share/nginx/html
COPY --from=builder /app/dist/ ./
COPY 404.html ./404.html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]