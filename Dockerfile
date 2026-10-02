# syntax=docker/dockerfile:1.7
# One image, two entrypoints (web, worker) + a migrate target.
# Multi-arch: docker buildx build --platform linux/amd64,linux/arm64 .

ARG NODE_VERSION=22-bookworm-slim

FROM node:${NODE_VERSION} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm build && pnpm build:worker

# Runs `drizzle-kit migrate` (k8s init container / CI deploy step).
FROM deps AS migrate
COPY drizzle.config.ts ./
COPY db ./db
CMD ["pnpm", "exec", "drizzle-kit", "migrate"]

FROM node:${NODE_VERSION} AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
RUN groupadd --system --gid 1001 app && useradd --system --uid 1001 --gid app app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/dist ./dist
USER app
EXPOSE 3000
# web (default): node server.js · worker: node dist/worker.mjs · cron: node dist/scripts/maintenance.mjs
CMD ["node", "server.js"]
