#!/bin/sh
# Entrypoint for the Fly.io container.
#
#   1. Runs pending Drizzle migrations against the SQLite file baked into
#      the image at /app/data/shufazidian.db (DATABASE_PATH override still
#      honored for flexibility).
#   2. Starts the Next.js standalone server.
#
# The DB is read-mostly: the app only reads at runtime, and populated data
# ships with each 'fly deploy' via the Dockerfile COPY. The migrator is
# still invoked on every boot to apply any pending schema changes that
# landed in code but haven't been run against the baked

set -e

: "${DATABASE_PATH:=/app/data/shufazidian.db}"
export DATABASE_PATH

echo "→ Running DB migrations against ${DATABASE_PATH}"
node scripts/fly-migrate.mjs

echo "→ Starting Next.js server on ${HOSTNAME:-0.0.0.0}:${PORT:-3000}"
exec node server.js