
# Stage 1: Build the React application
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

ARG VITE_API_BASE_URL=http://localhost:5000/api
ARG VITE_SITE_URL=http://localhost:5173

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_SITE_URL=${VITE_SITE_URL}

COPY . .
RUN npm run build

# Stage 2: Serve production files with Nginx
FROM nginx:alpine

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/health || exit 1

