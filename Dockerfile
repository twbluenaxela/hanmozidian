# syntax=docker/dockerfile:1.7

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

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Ensure the data directory exists so SQLite doesn't crash during 'next build'
RUN mkdir -p data

RUN npm run build

# ---- 3. runner ---------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
 && useradd  --system --uid 1001 --gid nodejs nextjs

# Copy standalone build
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public           ./public

# Copy scripts and database metadata
COPY --from=builder --chown=nextjs:nodejs /app/drizzle          ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/scripts/fly-migrate.mjs ./scripts/fly-migrate.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/fly-start.sh    ./scripts/fly-start.sh
RUN chmod +x ./scripts/fly-start.sh

# Bake the DB into the image
RUN mkdir -p ./data && chown nextjs:nodejs ./data
COPY --from=builder --chown=nextjs:nodejs /app/data/shufazidian.db ./data/shufazidian.db

USER nextjs

EXPOSE 3000

CMD ["./scripts/fly-start.sh"]