#!/bin/sh
set -e

# 1. Run migrations/repairs
echo "🔍 Checking database state..."
node scripts/fly-migrate.mjs

# 2. Start the optimized standalone server
echo "🚀 Starting Next.js Standalone..."
PORT=${PORT:-8080} HOSTNAME=0.0.0.0 node server.js