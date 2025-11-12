# Multi-stage Dockerfile for React (CRA) app served by Nginx

# 1) Build stage
FROM node:18-alpine AS builder
WORKDIR /app

# Install deps only when needed
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN if [ -f package-lock.json ]; then \
      npm ci; \
    elif [ -f yarn.lock ]; then \
      yarn install --frozen-lockfile; \
    elif [ -f pnpm-lock.yaml ]; then \
      npm i -g pnpm && pnpm i --frozen-lockfile; \
    else \
      npm i; \
    fi

# Copy source
COPY . .

# Build static assets
RUN npm run build

# 2) Nginx stage
FROM nginx:alpine

# Copy built app
COPY --from=builder /app/build /usr/share/nginx/html

# Add our Nginx config (SPA fallback)
COPY ./nginx/default.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Healthcheck (optional)
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
