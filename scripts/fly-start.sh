#!/bin/sh
set -e

echo "---------------------------------------"
echo "🚀 Starting stateless server (R2 mode)"
echo "---------------------------------------"

PORT=${PORT:-8080} HOSTNAME=0.0.0.0 exec node server.js