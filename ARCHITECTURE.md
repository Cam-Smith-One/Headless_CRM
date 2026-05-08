# Headless CRM Architecture

This document is the "how the system fits together" view for contributors, operators, and agent builders.

## Design goals

- Keep CRM operations API-first so agents and humans use the same source of truth.
- Keep auth split cleanly between human browser sessions and agent/API credentials.
- Keep the service layer portable across PostgreSQL and SQLite.
- Make tenant isolation and auditability default behavior, not optional add-ons.

## System layout

```text
apps/web      Next.js dashboard, login/setup flows, same-origin API proxy
apps/api      Hono API, MCP transport, OpenAPI docs, readiness endpoints

packages/core Business logic, validation, CRUD services, event emission
packages/db   Drizzle schemas, migrations, dual database runtime, seed data
packages/auth Agent auth, JWTs, API key lifecycle, RBAC helpers
packages/auth-web Better Auth integration for human sessions
packages/events Redis-backed or in-memory event bus
packages/mcp-server MCP server, tool registration, transport glue
packages/cli  Local CLI entrypoint for agent-oriented usage
```

## Runtime request paths

### Human browser flow

1. Browser requests a page from `apps/web`.
2. Next.js checks auth/session state for protected routes.
3. Browser-side API calls use same-origin `/api/*` routes.
4. Proxy forwards to the Hono API.
5. API resolves session or exchanges it for a scoped agent JWT where needed.
6. Services in `packages/core` read/write through `packages/db`.
7. Mutations emit events for audit trail, webhooks, notifications, and dashboards.

### Agent / MCP flow

1. Agent calls REST endpoints or the MCP transport directly.
2. Hono validates bearer token or bootstrap admin key.
3. RBAC middleware checks role before tool or route execution.
4. Core services apply tenant scoping and FK ownership checks.
5. Database writes persist entity state plus audit events.
6. Downstream integrations observe the same events as human-driven changes.

## Auth model

Two auth systems coexist intentionally:

- **Human auth**: Better Auth cookie sessions for web login, setup, invites, and team access.
- **Agent auth**: agent API keys and JWT bearer tokens for REST and MCP access.

This split keeps browser UX simple without forcing bots to impersonate humans.

## Multi-tenancy

- Every record is tenant-scoped.
- Services filter by `ctx.tenantId`.
- Foreign-key references are validated against the caller's tenant before mutation.
- Audit reads are role-gated to avoid cross-agent visibility inside a tenant.

## Database modes

### PostgreSQL

Use PostgreSQL for:

- production deployments
- heavier concurrent agent workloads
- vector search
- stronger operational backup/restore tooling

### SQLite

Use SQLite for:

- local evaluation
- demos
- solo or small-team self-hosting
- CI and deterministic end-to-end testing

The repo supports both at runtime. The dual-schema export in `packages/db` chooses the correct schema at module load based on `DATABASE_URL`.

## Eventing and audit trail

Every mutation is expected to emit an event. That gives the project three important properties:

- audit history for human and agent actions
- integration hooks for outbound webhooks and notifications
- a consistent place to add approval workflows or background automation later

## Extension seams

The main extension surfaces are:

- new entities and services
- new REST routes
- new MCP tools
- new dashboard pages
- new webhook handlers or event consumers

For the practical workflow, see [EXTENDING_HEADLESS_CRM.md](./EXTENDING_HEADLESS_CRM.md).

## Operational boundaries

- `apps/web` should stay focused on UX, auth entry, and proxy behavior.
- `apps/api` owns protocol concerns, route wiring, transport, and readiness.
- `packages/core` owns business logic and should stay framework-agnostic.
- `packages/db` owns schema and database-specific branching.

If a change crosses those boundaries, it should usually come with end-to-end coverage.
