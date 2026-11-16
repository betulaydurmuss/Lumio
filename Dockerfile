# syntax=docker/dockerfile:1

# ---- build: install, compile every workspace, drop dev dependencies ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY api/package.json api/
COPY worker/package.json worker/
COPY web/package.json web/
COPY api/prisma api/prisma
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# Migrations run from this stage, because the Prisma CLI is a dev dependency.
FROM build AS migrate
WORKDIR /app/api
CMD ["npx", "prisma", "migrate", "deploy"]

FROM build AS prod-deps
RUN npm prune --omit=dev --workspaces --include-workspace-root

# ---- api ----
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS api
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/package.json ./package.json
COPY --from=prod-deps /app/shared/package.json ./shared/package.json
COPY --from=prod-deps /app/shared/dist ./shared/dist
COPY --from=prod-deps /app/api/package.json ./api/package.json
COPY --from=prod-deps /app/api/dist ./api/dist
EXPOSE 4000
CMD ["api/dist/server.js"]

# ---- worker ----
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS worker
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/package.json ./package.json
COPY --from=prod-deps /app/shared/package.json ./shared/package.json
COPY --from=prod-deps /app/shared/dist ./shared/dist
COPY --from=prod-deps /app/worker/package.json ./worker/package.json
COPY --from=prod-deps /app/worker/dist ./worker/dist
CMD ["worker/dist/main.js"]

# ---- web: static files behind nginx, which also proxies /api ----
FROM nginxinc/nginx-unprivileged:1.31-alpine AS web
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 8080
