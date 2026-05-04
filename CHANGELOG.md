# Changelog

All notable changes to Headless CRM are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased] — Security & feature hardening pass

This pass closes a full pre-public-release audit (three rounds) that
surfaced 4 critical, 6 high, and 14 medium/low findings. All blockers
are addressed; the repo is ready to flip public.

### Security — Critical

- **MCP role enforcement.** Every MCP tool is now gated by `ctx.role`
  before `execute()`. `reader` and `auditor` JWTs can no longer call
  `crm_create`, `crm_update`, `crm_delete`, `crm_send_email`,
  `crm_attach_file`, etc. Schema-modifying tools (`crm_define_field`)
  require the `developer` role. (`packages/mcp-server/src/index.ts`)
- **Next.js middleware no longer redirects API/MCP traffic to /login.**
  `/api/*`, `/health`, `/.well-known/*`, `/mcp`, and `/webhooks/*` now
  bypass the cookie redirect — bearer-token clients (agents, MCP) can
  reach the Hono app without a Better Auth session cookie.
- **Tenant isolation on join queries.** `deals.getContacts`,
  `deals.addContact`, and `cases.create` now validate every foreign-key
  field belongs to the caller's tenant before the join/insert. Stops
  cross-tenant data exposure via guessed IDs.
- **Resend webhook now requires HMAC signing in production.** Returns
  `501` if `RESEND_WEBHOOK_SECRET` is missing in prod. Verification
  uses `crypto.createHmac` (Svix-compatible — accepts the `whsec_`
  prefix and `id+timestamp+body` Svix scheme) instead of plain SHA.
  Route is reachable both at `/webhooks/resend` and
  `/api/webhooks/resend` so Vercel forwards it correctly.

### Security — High

- **`BETTER_AUTH_SECRET`** is required (≥32 chars) in production.
  Removed the hard-coded fallback string. Build phase
  (`NEXT_PHASE=phase-production-build`) is exempt so `next build`
  doesn't fail with the secret only in the runtime env.
- **Approval self-approval blocked.** `approvals.approve` and
  `approvals.reject` reject when `ctx.agentId === existing.requestedByAgentId`.
- **Invite acceptance binds to invitee email.** `/api/auth/invite/accept`
  returns 403 unless the session user's email matches the invite email.
- **`auditor` role given a real meaning.** Distinct from `reader`:
  has read access to CRM data **and** the audit trail (`GET /api/events`,
  `GET /api/agents/:id/logs`); reader/operator do NOT have audit access.
- **Route-level Zod validation** (`.strict()`) on the previously
  unprotected routes: `POST /api/agents`, `POST /api/webhooks/inbound`,
  `POST /api/approvals/:id/{approve,reject}`,
  `POST /api/agents/provision` (admin bootstrap).

### Security — Medium / Low

- **`/api/setup/status`** returns only `{ configured: boolean }` — no
  more leaked `agentCount` / `adminKeySet` enumeration.
- **`tags` entity implemented.** Service + 6 REST routes + 6 MCP tools
  (`crm_tag_*`). Tenant-scoped on both the tag id and the target
  record id (per-recordType lookup).
- **`CORS_ORIGINS=*` rejected in production** — `createApp()` throws.
- **`errorResponse()` helper** routes all 73 catch blocks through a
  single sanitizer that maps Zod → 400, "not found" → 404,
  forbidden / self-approval → 403, expired / not pending → 409, and
  generic errors to 500 with a correlation ID. No more `c.json({ error: e.message })`
  leaking DB column names or constraint hints.
- **Inbound webhook fan-out rate-limited per tenant** (60/min). Returns
  429 + Retry-After. Stops self-DoS / abuse via `inbound.*` subscribers.
- **Rate limiter is Redis-backed** when `REDIS_URL` is set (atomic INCR
  + PTTL), in-memory fallback otherwise. Effective limit on Vercel is
  now the advertised limit, not `N_instances × limit`.
- **`/api/auth/setup` wrapped in a DB transaction** — race window where
  two simultaneous setup calls could both pass the count check is
  closed.
- **`tags.attach` validates the target record's tenant** (per-recordType
  lookup table for contacts/companies/deals/cases/activities).
- **`GET /api/agents`** no longer returns the `apiKey` hash column.
- **Resend webhook activity scan** uses a Drizzle JSONB SQL filter
  (`metadata->>'resendId' = $1`) instead of loading the full
  activities table into memory.

### Features added

- **Activities API now has GET routes** — `GET /api/activities` (list,
  paginated, filterable by `type`) and `GET /api/activities/:id`.
- **Pipeline Triggers UI page** at `/pipeline-triggers` with
  create/list/delete and pipeline+stage dropdowns sourced from
  `/api/pipelines`. Sidebar entry between Pipelines and Cases.
- **Tags MCP tools** — `crm_tag_list`, `crm_tag_create`,
  `crm_tag_delete`, `crm_tag_attach`, `crm_tag_detach`,
  `crm_tag_list_for_record`. Total MCP tool count: **28**.
- **Tags REST API** — full CRUD plus attach/detach/list-for-record.

### Build & local-dev fixes

- **Vercel build: `@tailwindcss/oxide` Linux x64 native binding** is
  now in the lockfile (added as a non-optional `optionalDependencies`
  at the workspace root) so npm install includes it on Vercel even
  when the lockfile was generated on macOS.
- **`packages/db/src/seed.ts`** auto-detects `DATABASE_URL=file:*` and
  uses better-sqlite3 + `sqlite-schema` instead of postgres-js.
  Loads `.env` via Node's `--env-file-if-exists` flag so the seed
  script sees `DATABASE_URL` when run via npm workspace.
- **SQLite migration uses absolute path** in `DATABASE_URL` (set by
  `setup-sqlite.sh`) so drizzle-kit and the seed both write to the
  same file regardless of cwd.
- **`pipelineTriggers` table added to `sqlite-schema.ts`** so the full
  data model can be materialized in SQLite for offline inspection.
- **`better-sqlite3` bumped to `^12.9.0`** (v11 didn't compile on
  Node 25; v12.9 supports Node 20–25).
- **Reserved `sqlite_*` index prefix renamed to `sqlt_*`** —
  SQLite rejects user-created object names starting with `sqlite_`.

### SQLite is now a fully-supported runtime backend

Closed out the previously deferred limitation. `DATABASE_URL=file:./foo.db`
runs the full API server, web UI, MCP transport, agent auth, webhooks,
custom fields, tags, pipeline triggers — everything except pgvector
semantic search and the Postgres-JSONB-specific resend lookup.

Implementation:
- `packages/db/src/index.ts` checks `DATABASE_URL` at module-load and
  re-exports the SQLite-compatible schema (`sqliteSchema.tenants`,
  `.agents`, etc.) instead of the Postgres one when the URL starts with
  `file:` or `sqlite:`. Service code that does
  `import { contacts } from "@headless-crm/db"` automatically gets the
  right table for the active backend.
- `packages/db/src/client.ts` lazy-loads `better-sqlite3` (via
  `createRequire`, so Postgres-only deploys never see the install) and
  patches every prepared statement so `Date` params are serialized to
  ISO strings before binding. (better-sqlite3 only accepts primitives +
  Buffer + null.)
- New `ilikeCompat` helper in `@headless-crm/db` replaces Drizzle's
  Postgres-only `ilike` in the contacts/companies/cases services with
  cross-backend `LOWER(col) LIKE LOWER(pattern)`.
- All 25 tables now exist in both schemas (added `pipelineTriggers` to
  the SQLite schema; regenerated migrations).
- `bumped better-sqlite3` to `^12.9.0` for Node 25 support.

### Known limitations (intentionally deferred)

- **30-day JWT expiry, no rotation list.** Suspending the agent is
  the only mitigation if a JWT leaks. Acceptable for now; documented.
- **pgvector + Postgres-JSONB resend lookup don't run on SQLite.** Both
  are documented as Postgres-only features.

### Documentation

- README: SQLite section rewritten to reflect "data-model exploration
  only" reality. RBAC table updated to include audit-trail column.
  MCP tools table includes the 6 new tag tools. REST API table
  includes activities GET, tags routes, pipeline-triggers, and the
  new resend webhook path.
- CONTRIBUTING: SQLite setup walked-through with the actual outcome.
- `.env.example` documents `RESEND_WEBHOOK_SECRET` requirement.
- This CHANGELOG.

---

## Earlier history

See `git log` for commits before this hardening pass. The `humaie-dev/headless-crm`
upstream maintains its own changelog.
