# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=22-bookworm-slim

# ---- 1. deps ----
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# ---- 2. builder ----
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 🔥 CRITICAL CHECK: Verify the DB is 15MB before building.
# If this fails, your .dockerignore is blocking the file.
RUN echo "Checking database size..." && \
    ls -lh data/shufazidian.db && \
    node -e "const s = require('fs').statSync('data/shufazidian.db').size; \
    console.log('Detected DB Size:', (s/1024/1024).toFixed(2), 'MB'); \
    if (s < 10000000) { console.error('🛑 ERROR: DB is too small! Context did not include the 15MB file.'); process.exit(1); }"

# Set WAL mode before build to prevent SQLITE_BUSY during Next.js worker execution
RUN node -e "const db = require('better-sqlite3')('data/shufazidian.db'); db.pragma('journal_mode = WAL'); db.pragma('busy_timeout = 10000'); db.close();"

ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID

ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ENV NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID

RUN npm run build

# ---- 3. runner ----
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs

# Copy Standalone
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public           ./public
COPY --from=builder --chown=nextjs:nodejs /app/scripts          ./scripts
RUN chmod +x ./scripts/*.sh

# 🔥 MANUALLY COPY DATA INTO THE RUNNER
# Standalone mode does NOT include the /data folder by default.
COPY --from=builder --chown=nextjs:nodejs /app/data ./data

USER nextjs
EXPOSE 8080
CMD ["sh", "./scripts/fly-start.sh"]