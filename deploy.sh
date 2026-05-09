#!/bin/bash
set -e

echo "Checkpointing WAL into main DB..."
sqlite3 data/shufazidian.db "PRAGMA wal_checkpoint(TRUNCATE);"

echo "Deploying to Fly.io..."
fly deploy "$@"

date -u +"%Y-%m-%dT%H:%M:%S" > pipeline/data/last_deployed.txt
echo "✓ Deploy timestamp recorded."
