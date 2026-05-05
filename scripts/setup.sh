#!/usr/bin/env bash
# =============================================================================
# Headless CRM — Postgres Setup Script
#
# Usage: ./scripts/setup.sh
#
# Sets up the full development environment with Postgres via Docker Compose.
# For SQLite (no Docker), use ./scripts/setup-sqlite.sh instead.
# =============================================================================

set -euo pipefail

# ── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
RESET='\033[0m'

# ── Helpers ───────────────────────────────────────────────────────────────────
info()    { echo -e "${BLUE}[setup]${RESET} $*"; }
success() { echo -e "${GREEN}[setup]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[setup]${RESET} $*"; }
error()   { echo -e "${RED}[setup] ERROR:${RESET} $*" >&2; exit 1; }

# Find the repo root (directory containing this script's parent)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║       Headless CRM — Dev Setup           ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${RESET}"
echo ""

# ── 1. Prerequisites ──────────────────────────────────────────────────────────
info "Checking prerequisites..."

# Node.js >= 22
if ! command -v node &>/dev/null; then
  error "node is not installed. Install Node.js 22+ from https://nodejs.org"
fi
NODE_VERSION=$(node --version | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
  error "Node.js >= 22 is required (found v${NODE_VERSION}). Upgrade at https://nodejs.org"
fi
success "Node.js $(node --version) ✓"

# npm
if ! command -v npm &>/dev/null; then
  error "npm is not installed. It ships with Node.js — reinstall from https://nodejs.org"
fi
success "npm $(npm --version) ✓"

# Docker
if ! command -v docker &>/dev/null; then
  error "Docker is not installed. Install from https://docs.docker.com/get-docker/"
fi
if ! docker info &>/dev/null 2>&1; then
  error "Docker daemon is not running. Start Docker Desktop or 'sudo systemctl start docker'."
fi
success "Docker $(docker --version | awk '{print $3}' | tr -d ',') ✓"

# docker compose (v2 plugin preferred, v1 fallback)
if docker compose version &>/dev/null 2>&1; then
  DOCKER_COMPOSE="docker compose"
elif command -v docker-compose &>/dev/null; then
  DOCKER_COMPOSE="docker-compose"
else
  error "docker compose is not available. Install Docker Compose v2: https://docs.docker.com/compose/install/"
fi
success "Docker Compose ✓"

# ── 2. Environment file ───────────────────────────────────────────────────────
cd "$REPO_ROOT"

info "Checking .env file..."
generate_secret() {
  node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
}

replace_env_value() {
  KEY="$1"
  VALUE="$2"
  node -e "const fs=require('fs');const p='.env';const key=process.argv[1];const value=process.argv[2];let s=fs.readFileSync(p,'utf8');const line=key+'='+value;if(new RegExp('^'+key+'=.*$','m').test(s)){s=s.replace(new RegExp('^'+key+'=.*$','m'),line)}else{s+='\\n'+line+'\\n'}fs.writeFileSync(p,s)" "$KEY" "$VALUE"
}

if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env
    success ".env created from .env.example"
    replace_env_value "JWT_SECRET" "$(generate_secret)"
    replace_env_value "BETTER_AUTH_SECRET" "$(generate_secret)"
    replace_env_value "ADMIN_API_KEY" "$(generate_secret)"
    success "Generated strong local secrets"
    warn "Review .env before sharing or deploying."
  else
    error ".env.example not found. Cannot create .env."
  fi
else
  success ".env already exists, skipping copy"
fi

node -e "const fs=require('fs'),crypto=require('crypto');const p='.env';let s=fs.readFileSync(p,'utf8');const weak=new Set(['','change-me-in-production','change-me-in-production-32chars!!','dev-only-change-me-in-production-32chars!!']);for(const key of ['JWT_SECRET','BETTER_AUTH_SECRET','ADMIN_API_KEY']){const m=s.match(new RegExp('^'+key+'=(.*)$','m'));const value=m?m[1]:'';if(value.length<32||weak.has(value)){const next=crypto.randomBytes(32).toString('base64url');const line=key+'='+next;if(m)s=s.replace(new RegExp('^'+key+'=.*$','m'),line);else s+='\\n'+line+'\\n';console.log('[setup] Rotated weak '+key);}}fs.writeFileSync(p,s)"

# ── 3. Install dependencies ───────────────────────────────────────────────────
info "Installing npm dependencies..."
npm install
success "Dependencies installed"

# ── 4. Start Postgres via Docker Compose ──────────────────────────────────────
info "Starting Postgres container (docker compose)..."
# Only start the postgres service — not the full stack (api/redis require more config)
$DOCKER_COMPOSE up -d postgres
success "Postgres container started"

# Wait for the healthcheck to pass (docker compose already defines one)
info "Waiting for Postgres to be healthy..."
MAX_WAIT=60
ELAPSED=0
until [ "$($DOCKER_COMPOSE ps -q postgres | xargs docker inspect --format='{{.State.Health.Status}}' 2>/dev/null)" = "healthy" ]; do
  if [ "$ELAPSED" -ge "$MAX_WAIT" ]; then
    error "Postgres did not become healthy within ${MAX_WAIT}s. Check logs: $DOCKER_COMPOSE logs postgres"
  fi
  sleep 2
  ELAPSED=$((ELAPSED + 2))
  echo -n "."
done
echo ""
success "Postgres is healthy"

# ── 5. Run database migrations ────────────────────────────────────────────────
info "Running database migrations..."
npm run db:migrate
success "Migrations applied"

# ── 6. Seed the database ──────────────────────────────────────────────────────
info "Seeding the database..."
npm run db:seed
success "Database seeded"

# ── 7. Done ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}✓ Setup complete!${RESET}"
echo ""
echo -e "  Next steps:"
echo -e "    ${BOLD}npm run dev${RESET}   — start all services in watch mode (Turborepo)"
echo -e "    ${BOLD}npm start${RESET}     — run the CLI agent interface"
echo ""
echo -e "  Useful commands:"
echo -e "    ${BOLD}$DOCKER_COMPOSE logs -f postgres${RESET}   — tail Postgres logs"
echo -e "    ${BOLD}$DOCKER_COMPOSE down${RESET}               — stop containers"
echo -e "    ${BOLD}$DOCKER_COMPOSE down -v${RESET}            — stop and wipe volumes"
echo ""
