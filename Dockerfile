# syntax=docker/dockerfile:1.7

# ----------------------------------------------------------------------------
# Shufazidian — Next.js 16 + better-sqlite3 on Fly.io
#
# Multi-stage build:
#   1. deps    — install node_modules (needs python/g++ to compile better-sqlite3)
#   2. builder — run `next build` to emit the .next/standalone bundle
#   3. runner  — minimal runtime image with the standalone server + native deps
#
# The SQLite database lives on a persistent volume mounted at /data. Set
# DATABASE_PATH=/data/shufazidian.db in fly.toml so the app writes there.
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
# Public folder (placeholder images + favicons).
COPY --from=builder --chown=nextjs:nodejs /app/public           ./public

# Drizzle migration files + the plain-JS migrator and entrypoint script.
# The migrator uses `better-sqlite3`, which the standalone bundle already
# contains thanks to outputFileTracingIncludes in next.config.ts.
COPY --from=builder --chown=nextjs:nodejs /app/drizzle          ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/scripts/fly-migrate.mjs ./scripts/fly-migrate.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/fly-start.sh    ./scripts/fly-start.sh
RUN chmod +x ./scripts/fly-start.sh

# Fly mounts its persistent volume here. Ensure it exists so lib/db/index.ts
# can mkdirSync into it on first boot.
RUN mkdir -p /data && chown nextjs:nodejs /data
VOLUME ["/data"]

USER nextjs

EXPOSE 3000

CMD ["./scripts/fly-start.sh"]
