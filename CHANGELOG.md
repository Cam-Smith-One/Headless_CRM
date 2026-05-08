# Changelog

All notable changes to Headless CRM are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [0.1.2] - 2026-05-08 - Open-source maturity and first-run CI pass

This pass is about making the repo easier to trust, adopt, extend, and maintain as a public open-source project.

### Added

- New operator and contributor docs:
  - `ARCHITECTURE.md`
  - `EXTENDING_HEADLESS_CRM.md`
  - `TROUBLESHOOTING.md`
  - `UPGRADING.md`
  - `ROADMAP.md`
  - `SUPPORT.md`
  - `RELEASING.md`
  - `CODE_OF_CONDUCT.md`
- New GitHub maintenance artifacts:
  - PR template
  - issue template config
  - Dependabot config
- New examples for MCP client configuration and HTTP provisioning.
- `scripts/check-open-source-readiness.mjs` plus `npm run oss:check` for repo hygiene checks.

### Changed

- README now includes a docs map and example entry points for new users.
- CONTRIBUTING now points contributors to the real verification commands and extension docs.
- `setup-sqlite.sh` accepts `SEED_DEMO=0` so maintainers and CI can exercise the true first-run owner setup path.
- CI now validates:
  - repo hygiene
  - Postgres build/lint/test
  - SQLite production-style self-host smoke + browser E2E against a no-seed first-run flow

### Why it matters

The repo now does a better job of proving the two things open-source users care about most:

- a fresh local install actually works for both humans and agents
- contributors can understand where to make changes without reverse-engineering the whole codebase

---

## [0.1.1] — 2026-05-05 — SQLite as a real runtime backend + E2E hardening

The big follow-up to v0.1.0. The previously-documented limitation
"SQLite is NOT a runtime backend yet" is gone — the full open-source
stack now runs on SQLite end-to-end.

### Added — SQLite runtime support

- `packages/db/src/index.ts` detects `DATABASE_URL=file:*` at module-load
  and re-exports the SQLite-compatible schema instead of the Postgres
  one. Service code's `import { contacts } from "@headless-crm/db"`
  silently gets the right table for the active backend.
- `packages/db/src/client.ts` lazy-loads `better-sqlite3` (via
  `createRequire`) and patches every prepared statement so `Date`
  params get serialized to ISO strings before binding (better-sqlite3
  only accepts primitives + Buffer + null).
- New `ilikeCompat(col, pattern)` helper in `@headless-crm/db` —
  `LOWER(col) LIKE LOWER(pattern)` works on both backends. Replaced 3
  Postgres-only `ilike()` calls in contacts/companies/cases services.
- `pipelineTriggers` table added to the SQLite schema; migrations
  regenerated. All 25 tables now exist in both schemas.
- Better Auth `drizzleAdapter` now switches its provider based on
  `isSqlite()` — SQLite mode uses `provider: "sqlite"`, Postgres uses
  `"pg"`. Fixes signup/sign-in on SQLite.

### Fixed — bugs surfaced by web-UI E2E test (2f31b40)

After flipping SQLite to a runtime backend, end-to-end-testing the open-
source path (clean clone → setup-sqlite.sh → npm run dev → sign up via
web → CRUD via API) surfaced four real bugs:

- **`apps/api/src/app.ts`**: 16 inline `require()` calls in route
  handlers worked when Next.js / tsx wrapped the file but threw
  `ReferenceError: require is not defined` in pure ESM runtime.
  Symptom: `GET /api/agents` and `GET /api/events` 500. Lifted all
  drizzle helpers and schema tables to static imports at the top.
- **`turbo.json`**: turbo's strict env model meant `npm run dev`
  didn't pass `DATABASE_URL` (and similar) through to the spawned web
  subprocess; Better Auth defaulted to Postgres with no URL and
  attempted to connect to "database `cameronsmith`". Added
  `globalPassThroughEnv` allowlist.
- **`packages/auth-web/src/index.ts`**: `provider: "pg"` was hardcoded.
  Even on SQLite, Better Auth generated Postgres SQL → 500 on signup.
- **`apps/web/src/app/api/auth/setup/route.ts`**: L-3's race fix wraps
  the count/insert/update in `db.transaction(async ...)`, but
  better-sqlite3's `transaction()` is sync-only and rejects async
  callbacks. Branched on `isSqlite()`: sequential check-and-act in
  SQLite (single-process WAL serializes writes anyway), transaction
  on Postgres.

### Documentation

- README "Option 2: SQLite (no Docker — full runtime)" — re-promoted
  as the simplest path for builders / agent framework users. Two
  Postgres-only features documented (pgvector, Resend metadata-JSON
  cross-tenant lookup); everything else is feature-equivalent.
- CONTRIBUTING walked through the cross-backend implementation.
- `.env.example` continues to document `RESEND_WEBHOOK_SECRET`.

### Verified live (SQLite, clean clone)

- All 14 read endpoints → 200
- All 9 valid POSTs → 201
- 5 search/filter queries → 200
- PATCH + DELETE roundtrip → 200
- Web UI signup → setup wizard → session-token → API CRUD: green
- 0 errors in API log; 33/33 tests pass; 9/9 packages build clean

---

## [0.1.0] — 2026-05-04 — Security & feature hardening pass

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

### Known limitations at v0.1.0

- **SQLite is NOT a runtime backend yet.** Setup script + seed work,
  but services statically import the Postgres schema with `defaultNow()`
  which generates `NOW()` SQL that SQLite cannot execute. Setting
  `DATABASE_URL=file:*` at runtime throws with a clear error pointing
  at Docker / Vercel as supported paths. **Closed in v0.1.1.**
- **30-day JWT expiry, no rotation list.** Suspending the agent is
  the only mitigation if a JWT leaks. Acceptable for now; documented.

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
