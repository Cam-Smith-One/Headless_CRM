#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ -f ".env" ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

DB_URL="${DATABASE_URL:-file:$ROOT/headless-crm.db}"
DB_PATH="${DB_URL#file:}"
DB_PATH="${DB_PATH#sqlite:}"
BACKUP_DIR="${1:-$ROOT/backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"

if [ ! -f "$DB_PATH" ]; then
  echo "SQLite database not found: $DB_PATH" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
OUT="$BACKUP_DIR/headless-crm-$STAMP.db"
cp "$DB_PATH" "$OUT"
if [ -f "$DB_PATH-wal" ]; then cp "$DB_PATH-wal" "$OUT-wal"; fi
if [ -f "$DB_PATH-shm" ]; then cp "$DB_PATH-shm" "$OUT-shm"; fi
echo "$OUT"
