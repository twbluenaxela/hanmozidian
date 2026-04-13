#!/bin/sh
# Entrypoint for the Fly.io container.
#
#   1. Runs pending Drizzle migrations against the SQLite file on the mounted
#      volume (DATABASE_PATH, typically /data/shufazidian.db).
#   2. Starts the Next.js standalone server.
#
# The migrator is idempotent, so re-running it on every boot is safe.

set -e

: "${DATABASE_PATH:=/data/shufazidian.db}"
export DATABASE_PATH

echo "→ Running DB migrations against ${DATABASE_PATH}"
node scripts/fly-migrate.mjs

echo "→ Starting Next.js server on ${HOSTNAME:-0.0.0.0}:${PORT:-3000}"
exec node server.js
