# Contributing to Headless CRM

Thank you for your interest in contributing! This guide will help you get set up.

## Prerequisites

- Node.js 22+
- Docker (for PostgreSQL + Redis, optional — see SQLite option below)
- npm 10+

## Setup

### Option A: PostgreSQL (full features)

```bash
# Clone the repo
git clone https://github.com/Cam-Smith-One/Headless_CRM.git
cd Headless_CRM

# Install dependencies
npm install

# Start infrastructure
docker compose up -d postgres redis

# Copy environment config
cp .env.example .env

# Generate and run database migrations
npm run db:generate
npm run db:migrate

# Seed demo data
npm run db:seed

# Start development
npm run dev
```

### Option B: SQLite (no Docker needed)

```bash
git clone https://github.com/Cam-Smith-One/Headless_CRM.git
cd Headless_CRM
./scripts/setup-sqlite.sh
npm run dev
```

The API runs on `http://localhost:3001` and the web UI on `http://localhost:3000`.

## Project Structure

```
apps/
  api/         Hono REST API server (Hono + MCP HTTP transport)
  web/         Next.js dashboard + Vercel API proxy

packages/
  db/          Drizzle ORM schemas, migrations, seed data (PostgreSQL + SQLite)
  core/        CRM business logic (services, validation, event emission)
  auth/        Agent identity, JWT tokens, RBAC
  auth-web/    Human user auth (Better Auth, cookie sessions, OAuth)
  events/      Redis Streams or in-memory event bus
  mcp-server/  MCP tools and server (stdio + HTTP transport)
  cli/         CLI entry point (npx headless-crm start)
```

## How to Add a New Entity

1. **Schema** — Create `packages/db/src/schema/your-entity.ts` with a Drizzle `pgTable`, export from `schema/index.ts`
2. **Service** — Create `packages/core/src/services/your-entity.ts` with CRUD + query, Zod validation, event emission
3. **CRM factory** — Wire the service into `packages/core/src/crm.ts`
4. **API routes** — Add GET/POST/PATCH/DELETE endpoints in `apps/api/src/app.ts`
5. **MCP tools** — Add the collection to `crm_query`, `crm_get`, `crm_search`, `crm_create`, `crm_update`, `crm_delete` enums in `packages/mcp-server/src/tools/index.ts`
6. **UI page** — Create `apps/web/src/app/your-entity/page.tsx` and add to the sidebar
7. **Migration** — Run `npm run db:generate` and `npm run db:migrate`

## Code Style

- TypeScript strict mode throughout
- Zod for all input validation
- Every mutation emits a CRM event for audit trail
- Services are framework-agnostic (no HTTP concerns)
- UI uses shadcn/ui components with dark-first design

## Pull Requests

- Create a feature branch from `main`
- Write descriptive PR titles
- Test locally with `npm run dev` and verify the build with `turbo build`
- Update README.md if adding new features or API endpoints
- Add seed data for new entities

## License

By contributing, you agree that your contributions will be licensed under the AGPL v3 license.
