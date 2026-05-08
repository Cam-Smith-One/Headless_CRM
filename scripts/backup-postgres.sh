#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="${1:-$REPO_ROOT/backups}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUTPUT_FILE="$BACKUP_DIR/headless-crm-postgres-$TIMESTAMP.dump"

mkdir -p "$BACKUP_DIR"

if docker compose -f "$REPO_ROOT/docker-compose.yml" ps --status running postgres >/dev/null 2>&1; then
  POSTGRES_USER="${POSTGRES_USER:-headless}"
  POSTGRES_DB="${POSTGRES_DB:-headless_crm}"
  echo "[backup] using docker compose postgres service"
  docker compose -f "$REPO_ROOT/docker-compose.yml" exec -T postgres \
    pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$OUTPUT_FILE"
else
  if [[ -f "$REPO_ROOT/.env" ]]; then
    set -a
    source "$REPO_ROOT/.env"
    set +a
  fi
  : "${DATABASE_URL:?DATABASE_URL is required when docker compose postgres is not running}"
  command -v pg_dump >/dev/null 2>&1 || {
    echo "[backup] pg_dump is required when backing up a non-docker Postgres instance" >&2
    exit 1
  }
  echo "[backup] using DATABASE_URL"
  pg_dump "$DATABASE_URL" -Fc -f "$OUTPUT_FILE"
fi

echo "[backup] wrote $OUTPUT_FILE"
