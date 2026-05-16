# Headless CRM - AI Handoff Status

This file is for future AI agents and maintainers who need a quick, honest view of what has already been done, what is currently solid, and what still needs work.

## Current release posture

As of 2026-05-16, the open-source self-host path is in good shape:

- local SQLite setup works for humans and AI agents
- local Postgres + Docker Compose setup works for humans and AI agents
- runtime `npm audit --omit=dev` is clean
- the project has explicit docs for self-hosting, security, extending, upgrading, releasing, and troubleshooting
- browser and API E2E coverage exists for the highest-value local deployment personas

This is not just a docs claim. It was re-run against a fresh Postgres volume with first-run setup, agent flows, and human/team flows.

## What was recently completed

### Security and dependency posture

- upgraded Better Auth to `1.6.11`
- pinned web to `next@16.3.0-canary.19` because stable Next 16 still carried the nested `postcss` advisory path
- `npm audit --omit=dev` now returns `0 vulnerabilities`
- strong production secret checks are already in place for:
  - `JWT_SECRET`
  - `BETTER_AUTH_SECRET`
  - `ADMIN_API_KEY`

### Local deployment hardening

- SQLite self-host flow works end to end
- Postgres self-host flow works end to end
- fresh Postgres startup no longer depends on Drizzle CLI behaving perfectly
- `packages/db/scripts/migrate-postgres.mjs` now:
  - ensures `pgvector`
  - creates the Drizzle migration schema/table
  - applies the checked-in SQL migrations directly
  - retries on early database-start races such as `ECONNRESET` and `ECONNREFUSED`

### Persona coverage that has been tested

- public login page
- public MCP discovery
- first-run owner setup
- human login
- human contact create/edit
- owner invite flow
- teammate join flow
- owner promote-to-admin flow
- agent provision
- agent create/update
- operator delete denied
- reader read-only enforcement
- auditor audit-trail enforcement
- concurrent operator writes

### Documentation and repo maturity already added

- `ARCHITECTURE.md`
- `SELF_HOST_LOCAL_DEPLOYMENT.md`
- `EXTENDING_HEADLESS_CRM.md`
- `TROUBLESHOOTING.md`
- `UPGRADING.md`
- `ROADMAP.md`
- `SUPPORT.md`
- `RELEASING.md`
- `SECURITY.md`
- examples for Claude Desktop and HTTP provisioning
- CI and readiness checks for self-host posture

## What is solid today

### Good fit

- solo builder or small team evaluating locally on SQLite
- team self-hosting on Postgres
- agent-first CRM use through REST and MCP
- mixed human + agent workflows

### Especially strong parts

- auth split between human sessions and agent JWT/API keys
- role enforcement on the API and MCP layers
- local setup ergonomics
- audit trail and agent identity model
- open-source operator documentation compared with the project’s earlier state

## What is still outstanding

These are not all launch blockers. This is the practical next-work list.

### Product depth

- granular RBAC beyond the current role model
  - per-entity permissions
  - per-action scopes
  - more team/admin controls
- richer audit/admin UI
  - agent key activity
  - approval history
  - suspicious auth/action review
- better import/export from main CRM pages, not just operator/settings surfaces
- more polished error states and operator feedback in the dashboard

### Operator and deployment maturity

- move back from the Next canary line once a stable release contains the `postcss` fix
- add managed Postgres provider notes beyond the current local/self-host scripts
- add object-storage guidance for attachments in non-local production deployments
- improve Docker image dependency posture if you want image-layer audit cleanliness, not just repo runtime cleanliness

### Test and CI expansion

- more E2E for:
  - member removal
  - key rotation UI
  - backup/restore smoke
  - longer-running restore validation
- potentially add a Postgres clean-room E2E lane to CI if runtime/cost allows

### OSS adoption polish

- more screenshots or GIFs in README
- more ready-made client examples:
  - Cursor
  - OpenAI Responses / Agents
  - other MCP clients
- more realistic seeded demo data

## Recommended next priorities

If another AI picks this up, the best next sequence is:

1. Move product permissions beyond coarse roles
2. Improve admin/audit UX
3. Expand import/export and operator workflows
4. Improve attachment guidance for production storage
5. Replace Next canary with stable once safe
6. Add richer examples and demo assets for adoption

## Verification commands

These were the highest-signal checks used most recently:

```bash
npm audit --omit=dev
npm test
npm run build
npm run selfhost:check
```

Fresh local Postgres proof path:

```bash
COMPOSE_PROJECT_NAME=headlesscrmfinal docker compose down -v
COMPOSE_PROJECT_NAME=headlesscrmfinal docker compose up -d postgres
DATABASE_URL=postgresql://headless:headless@127.0.0.1:5433/headless_crm npm run db:migrate
COMPOSE_PROJECT_NAME=headlesscrmfinal docker compose up -d --build api web
```

Then:

```bash
E2E_API_URL=http://127.0.0.1:3001 npm run test:selfhost
E2E_REUSE_SERVER=1 E2E_BASE_URL=http://127.0.0.1:3000 E2E_API_URL=http://127.0.0.1:3001 E2E_EMAIL=owner@example.com E2E_PASSWORD=TestPassword123! npm run test:e2e
```

## Bottom line

Headless CRM is now a credible, well-rounded open-source project for local deployment by humans and AI agents.

The remaining work is mostly about:

- deeper product polish
- finer operational controls
- broader adoption assets

It is no longer mainly about "does the self-host version work?"

