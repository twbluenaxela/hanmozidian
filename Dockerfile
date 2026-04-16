# syntax=docker/dockerfile:1.7

# ----------------------------------------------------------------------------
# Shufazidian — Next.js 16 + better-sqlite3 on Fly.io
# ----------------------------------------------------------------------------

ARG NODE_VERSION=22-bookworm-slim

# ---- 1. deps -----------------------------------------------------------------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

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

# Copy node_modules from deps
COPY --from=deps /app/node_modules ./node_modules
# Copy all project files
COPY . .

# FIX: Explicitly create the data directory and ensure WAL mode + Busy Timeout.
# This prevents 'SQLITE_BUSY' when Next.js parallel workers start.
RUN mkdir -p data && node -e "\
  const path = require('path'); \
  const dbPath = path.resolve(process.cwd(), 'data', 'shufazidian.db'); \
  try { \
    const db = require('better-sqlite3')(dbPath); \
    db.pragma('journal_mode = WAL'); \
    db.pragma('busy_timeout = 10000'); \
    db.close(); \
    console.log('✅ DB pre-warmed and WAL mode enabled at:', dbPath); \
  } catch(e) { \
    console.error('❌ DB pre-warm failed:', e.message); \
    process.exit(1); \
  }"

RUN npm run build

# ---- 3. runner ---------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
 && useradd  --system --uid 1001 --gid nodejs nextjs

# Copy standalone build and static assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public           ./public
COPY --from=builder --chown=nextjs:nodejs /app/drizzle          ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/scripts/fly-migrate.mjs ./scripts/fly-migrate.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/fly-start.sh    ./scripts/fly-start.sh
RUN chmod +x ./scripts/fly-start.sh

# Copy the database baked in the builder stage
RUN mkdir -p ./data && chown nextjs:nodejs ./data
COPY --from=builder --chown=nextjs:nodejs /app/data/ ./data/

USER nextjs

EXPOSE 8080

CMD ["./scripts/fly-start.sh"]