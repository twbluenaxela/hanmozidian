#!/bin/sh
set -e

: "${DATABASE_PATH:=/app/data/shufazidian.db}"
export DATABASE_PATH

echo "---------------------------------------"
echo "🔍 DATABASE DIAGNOSTICS"
echo "📍 Target Path: ${DATABASE_PATH}"
echo "📂 File Exists? $(test -f "$DATABASE_PATH" && echo true || echo false)"
ls -lh "$DATABASE_PATH" || true
du -h "$DATABASE_PATH" || true
echo "📁 Data Directory Contents:"
ls -lh /app/data || true
echo "---------------------------------------"

echo "→ Skipping migrations for now"
echo "→ Starting Next.js server on 0.0.0.0:${PORT:-8080}"

PORT=${PORT:-8080} HOSTNAME=0.0.0.0 exec node server.js