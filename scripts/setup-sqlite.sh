#!/usr/bin/env bash
# =============================================================================
# Headless CRM — SQLite Setup Script
#
# Usage: ./scripts/setup-sqlite.sh
#
# Sets up a lightweight development environment using SQLite instead of
# Postgres. No Docker required — ideal for quick local exploration or CI.
#
# For the full Postgres setup, use ./scripts/setup.sh instead.
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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║   Headless CRM — Dev Setup (SQLite)      ║${RESET}"
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

# ── 2. Environment file ───────────────────────────────────────────────────────
cd "$REPO_ROOT"

info "Checking .env file..."
if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env
    success ".env created from .env.example"
    # Override DATABASE_URL for SQLite mode
    # Append a SQLite-specific override so it takes precedence
    echo "" >> .env
    echo "# SQLite mode (overrides the Postgres DATABASE_URL above)" >> .env
    echo "DATABASE_URL=file:./headless-crm.db" >> .env
    success "DATABASE_URL set to SQLite path (file:./headless-crm.db)"
    warn "Review .env and fill in any required secrets before use."
  else
    error ".env.example not found. Cannot create .env."
  fi
else
  success ".env already exists, skipping copy"
  # Check if DATABASE_URL is already pointing at SQLite
  if grep -q "^DATABASE_URL=file:" .env 2>/dev/null; then
    success "DATABASE_URL already configured for SQLite"
  else
    warn "Your .env DATABASE_URL does not look like a SQLite path."
    warn "For SQLite mode, set:  DATABASE_URL=file:./headless-crm.db"
  fi
fi

# ── 3. Install dependencies ───────────────────────────────────────────────────
info "Installing npm dependencies (including optional better-sqlite3)..."
npm install
success "Dependencies installed"

# ── 4. Generate SQLite migrations ─────────────────────────────────────────────
info "Generating SQLite migration files..."
# Uses the drizzle-sqlite.config.ts config in packages/db
npm run generate:sqlite -w packages/db
success "SQLite migrations generated"

# ── 5. Apply SQLite migrations ────────────────────────────────────────────────
info "Applying SQLite migrations..."
npm run migrate:sqlite -w packages/db
success "SQLite migrations applied"

# ── 6. Seed the database ──────────────────────────────────────────────────────
info "Seeding the database..."
npm run db:seed
success "Database seeded"

# ── 7. Done ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}✓ Setup complete! (SQLite mode)${RESET}"
echo ""
echo -e "  Next steps:"
echo -e "    ${BOLD}npm start${RESET}     — run the CLI agent interface"
echo -e "    ${BOLD}npm run dev${RESET}   — start all services in watch mode"
echo ""
echo -e "  SQLite database file: ${BOLD}./headless-crm.db${RESET}"
echo ""
echo -e "  Note: SQLite is great for local dev and testing. For production or"
echo -e "  multi-process workloads, use Postgres (./scripts/setup.sh)."
echo ""
