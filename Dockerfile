# syntax=docker/dockerfile:1.7

# ----------------------------------------------------------------------------
# Shufazidian — Next.js 16 + better-sqlite3 on Fly.io
#
# Multi-stage build:
#   1. deps    — install node_modules (needs python/g++ to compile better-sqlite3)
#   2. builder — run `next build` to emit the .next/standalone bundle
#   3. runner  — minimal runtime image with the standalone server + native deps
#
# The populated SQLite metadata DB is baked into the image at
# /app/data/shufazidian.db. It's read-mostly at runtime (the app only
# reads; writes only happen locally via the ingest scripts), and fresh
# data ships with each `fly deploy`. Image binaries live on R2.
# ----------------------------------------------------------------------------

ARG NODE_VERSION=22-bookworm-slim

# ---- 1. deps -----------------------------------------------------------------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# better-sqlite3 requires Python + a C++ toolchain to build its native addon.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 \
      make \
      g++ \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --include=dev

# ---- 2. builder --------------------------------------------------------------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ---- 3. runner ---------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user.
RUN groupadd --system --gid 1001 nodejs \
 && useradd  --system --uid 1001 --gid nodejs nextjs

# Next.js standalone server (includes NFT-traced node_modules).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Static assets — Next doesn't copy these into standalone automatically.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static
# Public folder (favicons + SVG icons; calligraphy images live on R2).
COPY --from=builder --chown=nextjs:nodejs /app/public           ./public

# Drizzle migration files + the plain-JS migrator and entrypoint script.
COPY --from=builder --chown=nextjs:nodejs /app/drizzle          ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/scripts/fly-migrate.mjs ./scripts/fly-migrate.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/fly-start.sh    ./scripts/fly-start.sh
RUN chmod +x ./scripts/fly-start.sh

# Bake the populated metadata DB into the image. This COPY fails loudly
# at build time if the local DB hasn't been ingested yet — which is the
# desired behavior: a `fly deploy` from an unseeded machine should not
# silently ship a schema-only DB.
RUN mkdir -p ./data && chown nextjs:nodejs ./data
COPY --from=builder --chown=nextjs:nodejs /app/data/shufazidian.db ./data/shufazidian.db

USER nextjs

EXPOSE 3000

CMD ["./scripts/fly-start.sh"]