#!/bin/sh
set -e

: "${DATABASE_PATH:=/app/data/shufazidian.db}"
export DATABASE_PATH

echo "---------------------------------------"
echo "🔍 DATABASE DIAGNOSTICS"
echo "📍 Target Path: ${DATABASE_PATH}"

if [ -f "${DATABASE_PATH}" ]; then
  echo "📂 File Exists? true"
  ls -lh "${DATABASE_PATH}"
  du -h "${DATABASE_PATH}"
else
  echo "📂 File Exists? false"
fi

echo "📁 Data Directory Contents:"
ls -lh /app/data || true
echo "---------------------------------------"

echo "→ Running DB migrations against ${DATABASE_PATH}"
node scripts/fly-migrate.mjs

echo "---------------------------------------"
echo "🔍 POST-MIGRATION CHECK"
ls -lh "${DATABASE_PATH}" || true
du -h "${DATABASE_PATH}" || true
echo "---------------------------------------"

echo "→ Starting Next.js server on ${HOSTNAME:-0.0.0.0}:${PORT:-3000}"
exec node server.js