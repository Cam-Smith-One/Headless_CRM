#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
INPUT_FILE="${1:-}"

if [[ -z "$INPUT_FILE" ]]; then
  echo "Usage: ./scripts/restore-postgres.sh <backup.dump>" >&2
  exit 1
fi

if [[ ! -f "$INPUT_FILE" ]]; then
  echo "[restore] backup file not found: $INPUT_FILE" >&2
  exit 1
fi

echo "[restore] this will overwrite the target Postgres database"

if docker compose -f "$REPO_ROOT/docker-compose.yml" ps --status running postgres >/dev/null 2>&1; then
  POSTGRES_USER="${POSTGRES_USER:-headless}"
  POSTGRES_DB="${POSTGRES_DB:-headless_crm}"
  echo "[restore] using docker compose postgres service"
  cat "$INPUT_FILE" | docker compose -f "$REPO_ROOT/docker-compose.yml" exec -T postgres \
    pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner
else
  if [[ -f "$REPO_ROOT/.env" ]]; then
    set -a
    source "$REPO_ROOT/.env"
    set +a
  fi
  : "${DATABASE_URL:?DATABASE_URL is required when docker compose postgres is not running}"
  command -v pg_restore >/dev/null 2>&1 || {
    echo "[restore] pg_restore is required when restoring to a non-docker Postgres instance" >&2
    exit 1
  }
  echo "[restore] using DATABASE_URL"
  pg_restore --dbname="$DATABASE_URL" --clean --if-exists --no-owner "$INPUT_FILE"
fi

echo "[restore] restore complete"
