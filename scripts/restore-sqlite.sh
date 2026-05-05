#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BACKUP="${1:-}"
if [ -z "$BACKUP" ] || [ ! -f "$BACKUP" ]; then
  echo "Usage: npm run sqlite:restore -- /path/to/headless-crm-backup.db" >&2
  exit 1
fi

if [ -f ".env" ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

DB_URL="${DATABASE_URL:-file:$ROOT/headless-crm.db}"
DB_PATH="${DB_URL#file:}"
DB_PATH="${DB_PATH#sqlite:}"

mkdir -p "$(dirname "$DB_PATH")"
cp "$BACKUP" "$DB_PATH"
if [ -f "$BACKUP-wal" ]; then cp "$BACKUP-wal" "$DB_PATH-wal"; fi
if [ -f "$BACKUP-shm" ]; then cp "$BACKUP-shm" "$DB_PATH-shm"; fi
echo "Restored $BACKUP to $DB_PATH"
