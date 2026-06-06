#!/bin/sh
set -e

echo "--- 🔍 RUNTIME DB CHECK ---"
if [ -f "./data/shufazidian.db" ]; then
    du -h ./data/shufazidian.db
else
    echo "❌ ERROR: /app/data/shufazidian.db NOT FOUND"
fi
echo "--- 🔍 END CHECK ---"

# Run migrations (This will "Skip" if the DB already has the migration table)
node scripts/fly-migrate.mjs

echo "🚀 Starting Next.js..."
NODE_OPTIONS='--max-old-space-size=400' node server.js