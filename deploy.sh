#!/bin/bash
set -e

echo "Checkpointing WAL into main DB..."
sqlite3 data/shufazidian.db "PRAGMA wal_checkpoint(TRUNCATE);"

echo "Deploying to Fly.io..."
fly deploy "$@"
