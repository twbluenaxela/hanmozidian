#!/bin/sh
set -e

echo "--- 🔍 RUNTIME DEBUGGING ---"
echo "Current Directory: $(pwd)"
echo "Listing /app/data contents:"
ls -lh /app/data || echo "Directory /app/data not found"
echo "--- 🔍 END DEBUGGING ---"

echo "Running migrations/repair..."
node scripts/fly-migrate.mjs

echo "🚀 Starting Next.js Standalone..."
PORT=${PORT:-8080} HOSTNAME=0.0.0.0 node server.js