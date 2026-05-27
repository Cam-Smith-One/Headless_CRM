<p align="center">
  <img src="./apps/web/public/headless-crm-crab.png" alt="Headless CRM crab logo" width="180" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/MCP-Native-blueviolet?style=for-the-badge" alt="MCP Native" />
  <img src="https://img.shields.io/badge/API-First-blue?style=for-the-badge" alt="API First" />
  <img src="https://img.shields.io/badge/Self--Hostable-green?style=for-the-badge" alt="Self-Hostable" />
</p>

# Headless CRM

**The open-source CRM built for AI agents. MCP-native, API-first, self-hostable.**

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![CI](https://github.com/Cam-Smith-One/Headless_CRM/actions/workflows/ci.yml/badge.svg)](https://github.com/Cam-Smith-One/Headless_CRM/actions)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FCam-Smith-One%2FHeadless_CRM&env=DATABASE_URL,JWT_SECRET,ADMIN_API_KEY&envDescription=Required%20environment%20variables%20for%20Headless%20CRM&envLink=https%3A%2F%2Fgithub.com%2FCam-Smith-One%2FHeadless_CRM%23configuration&project-name=headless-crm&repository-name=headless-crm)

> **Want it fully managed?** Skip the setup — [get the hosted version →](https://humaie.com) _(zero ops, auto-updates, Humaie support)_

---

## Why Headless CRM?

Traditional CRMs were designed for humans clicking buttons. Headless CRM is designed for **AI agents making API calls**.

- **MCP-native** — 28+ tools via the Model Context Protocol. Connect Claude, Cursor, or any MCP client in seconds.
- **Agent identity** — Every agent gets its own API key, JWT, role, and audit trail. No more repurposing user accounts for bots.
- **Event-sourced** — Every mutation tracked with before/after diffs. Full audit trail, webhook notifications, approval workflows.
- **Self-hostable** — Docker, SQLite single-binary, or one-click Vercel deploy. Your data stays yours.

<details>
<summary><strong>See it in action: MCP agent creating a contact</strong></summary>

```
User: Create a contact for Jane Smith at Acme Corp, email jane@acme.com

Agent (via MCP): Using crm_create tool...
  → collection: "contacts"
  → firstName: "Jane", lastName: "Smith"
  → email: "jane@acme.com", companyId: "comp_abc123"

Result: Contact created (id: c_xK9mPq2r)
  → Event emitted: contacts.created
  → Webhook fired to 2 subscribers
  → Notification sent to dashboard
```

</details>

---

## Quick Start

> **Builder / agent framework user?** Use [Option 2 (SQLite)](#option-2-sqlite-no-docker--full-runtime) — no Docker, no external DB, runs in under a minute. The full API + MCP transport + UI all work against SQLite. Great with Claude, OpenClaw, Hermes, and any MCP client.

### Option 1: One-Command Setup (PostgreSQL)

```bash
git clone https://github.com/Cam-Smith-One/Headless_CRM.git
cd Headless_CRM
./scripts/setup.sh
```

This installs dependencies, starts PostgreSQL via Docker, runs migrations, seeds demo data, and tells you how to start.

Then:

```bash
npm run dev    # API on :3001, Dashboard on :3000
```

### Option 2: SQLite (no Docker — full runtime)

**Simplest for local dev and agent integrations.** No external dependencies — just Node.js. The full API server, web UI, and MCP transport all run against SQLite.

```bash
git clone https://github.com/Cam-Smith-One/Headless_CRM.git
cd Headless_CRM
./scripts/setup-sqlite.sh   # creates ./headless-crm.db, applies migrations, seeds demo data
npm run dev                 # API on :3001, dashboard on :3000
```

- For production-like local runs, see [`SELF_HOST_LOCAL_DEPLOYMENT.md`](./SELF_HOST_LOCAL_DEPLOYMENT.md).
- Run `npm run selfhost:check` before handing a local deploy to a team or agent.
- Re-running `setup:sqlite` is safe: the seed step skips demo inserts when the demo workspace already has companies.
- Run `npm run sqlite:backup` before upgrades or heavy agent tests.
- Run `npm run postgres:backup` before Postgres upgrades or risky schema work.
- Run `npm run test:selfhost` for an API/agent smoke test, or `npm run test:e2e` for browser E2E.
- `npm audit --omit=dev` is currently clean on this branch. The web app is pinned to `next@16.3.0-canary.19` because the latest stable Next 16 line still ships a nested `postcss` advisory path.

How it works:
- Setup script writes `DATABASE_URL=file:<absolute-path>/headless-crm.db` to `.env`.
- `packages/db/src/index.ts` detects the `file:` URL at module-load and
  re-exports the SQLite-compatible schema; `getDb()` uses `better-sqlite3`.
- A driver-level patch converts `Date` params to ISO strings before binding
  (better-sqlite3 only accepts primitives + Buffer + null).
- Everything else (REST, MCP tools, agent auth, webhooks, custom fields,
  tags, pipeline triggers) works identically across both backends.

Postgres-only features in SQLite mode:
- **Vector search** (`/api/search/semantic`) — depends on pgvector. Falls
  back to keyword search.
- **Resend email-engagement triggers** — the metadata-JSON SQL filter uses
  the Postgres JSONB `->>` operator. The webhook itself works; the
  cross-tenant lookup query is Postgres-specific.

Both are documented limitations; everything else is feature-equivalent.

### Option 3: Docker Compose (full stack)

```bash
git clone https://github.com/Cam-Smith-One/Headless_CRM.git
cd Headless_CRM
cp .env.example .env
docker compose up -d    # PostgreSQL + API + Web Dashboard
```

Visit http://localhost:3000 for the dashboard, http://localhost:3001/api/docs for the API.

### Option 4: Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FCam-Smith-One%2FHeadless_CRM&env=DATABASE_URL,JWT_SECRET,ADMIN_API_KEY&envDescription=Required%20environment%20variables%20for%20Headless%20CRM&envLink=https%3A%2F%2Fgithub.com%2FCam-Smith-One%2FHeadless_CRM%23configuration&project-name=headless-crm&repository-name=headless-crm)

1. Click the button above
2. Add a **Neon Postgres** integration from the Vercel Marketplace
3. Set `JWT_SECRET` and `ADMIN_API_KEY` environment variables
4. Deploy

### Option 5: npx (scaffolder)

```bash
npx create-headless-crm
```

Interactive setup — choose PostgreSQL or SQLite, set your port and admin key, and get running in under a minute.

---

## Docs Map

- [ARCHITECTURE.md](./ARCHITECTURE.md) - how the web app, API, auth, database, and eventing fit together
- [SELF_HOST_LOCAL_DEPLOYMENT.md](./SELF_HOST_LOCAL_DEPLOYMENT.md) - local self-host flow for humans and agents
- [EXTENDING_HEADLESS_CRM.md](./EXTENDING_HEADLESS_CRM.md) - where to add entities, tools, routes, and UI
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - common local install and auth/runtime issues
- [UPGRADING.md](./UPGRADING.md) - safe upgrade checklist for SQLite and Postgres
- [ROADMAP.md](./ROADMAP.md) - what we are actively improving next
- [AI_HANDOFF_STATUS.md](./AI_HANDOFF_STATUS.md) - current state, recent work, and next priorities for future AI agents and maintainers
- [SUPPORT.md](./SUPPORT.md) - where to file bugs, ask for help, and report security issues
- [RELEASING.md](./RELEASING.md) - maintainer release checklist

## Examples

- [examples/claude-desktop/mcp.json](./examples/claude-desktop/mcp.json) - MCP client config starter
- [examples/http/provision-and-create-contact.sh](./examples/http/provision-and-create-contact.sh) - provision an agent and create a contact over HTTP

---

## Features

### Core CRM
- **Contacts, Companies, Deals, Cases** — full CRUD with search, filtering, and pagination
- **Pipelines** — multi-pipeline support with customizable stages
- **Activities** — timeline events (calls, emails, meetings, notes, tasks, agent actions)
- **Tags** — categorization labels for any record
- **Custom Fields** — extend any entity with tenant-specific fields (text, number, boolean, date, select, multiselect, url, email) with validation
- **Entity Relationships** — contacts ↔ companies ↔ deals ↔ cases with full linkage

### Agent Platform
- **MCP-native** — 28+ tools for AI agent access via Streamable HTTP or stdio
- **Agent Identity** — unique API keys (`hcrm_sk_...`), JWT-based auth, full lifecycle management
- **RBAC** — four roles (reader, operator, developer, auditor) enforced at API middleware level
- **Human Approval Workflows** — agent provisioning and dangerous actions require human approval
- **Agent Memory** — persistent memory with pgvector embeddings for semantic recall

### API & Integrations
- **REST API** — full CRUD for all entities with OpenAPI 3.1 docs (Scalar UI at `/api/docs`)
- **Webhooks** — outbound HTTP callbacks with HMAC-SHA256 signing, delivery retries
- **Inbound Webhooks** — receive data from external systems
- **MCP Tools** — agents pull data on demand via Model Context Protocol
- **Email Integration** — send/log emails via Resend with graceful degradation
- **Vector Search** — semantic search via OpenAI text-embedding-3-small + pgvector

### Security
- **MCP Role Enforcement** — every tool gated by `ctx.role`; readers/auditors can't write, operators can't delete, only developers can modify schema
- **Tenant Isolation** — every query scoped by `tenantId`; foreign keys (contact, company, deal, agent) validated to belong to caller's tenant before insert
- **Rate Limiting** — 100 req/min authenticated, 20 req/min unauthenticated
- **CORS Lockdown** — configurable allowed origins
- **Timing-safe Admin Key** — prevents timing attacks on admin endpoints
- **MCP Session TTL** — automatic session cleanup (30min timeout)
- **Webhook Replay Protection** — timestamp-based HMAC signing, configurable tolerance
- **Resend Webhook Signing** — `RESEND_WEBHOOK_SECRET` required in production; unsigned requests rejected

### Dashboard
- **Customizable Dashboard** — drag-and-drop widgets with localStorage persistence
- **Notification System** — auto-generated notifications for key CRM events
- **File Attachments** — upload and manage files on any record
- **Bulk Import / Export** — CSV import plus CSV/JSON export from the operator settings surface
- **Light/Dark Mode** — full theme support
- **Mobile Responsive** — works on desktop and mobile
- **Real-time Polling** — dashboard auto-refreshes with live data

### Deployment
- **Event Sourcing** — every mutation persisted with before/after change tracking
- **Multi-tenant** — complete data isolation per tenant
- **Self-hostable** — Docker Compose, single-binary CLI, or Vercel
- **Dual Database** — PostgreSQL (production) or SQLite (local/edge)
- **Redis Optional** — falls back to in-memory event bus when unavailable

---

## Architecture

```
+-----------------------------------------------------+
|                     apps/web                         |
|              Next.js 16 Dashboard                    |
|           (shadcn/ui, dark/light mode)               |
|     + API proxy routes (/api/* → Hono on Vercel)     |
+-----------------------------------------------------+
                          |
+-----------------------------------------------------+
|                     apps/api                         |
|     Hono REST API  +  MCP Streamable HTTP (/mcp)     |
|     OpenAPI 3.1 docs (Scalar UI at /api/docs)        |
+-----------------------------------------------------+
       |            |            |            |
+----------+  +-----------+  +--------+  +----------+
| packages |  | packages  |  |packages|  | packages |
|   /core  |  |   /auth   |  |/events |  |/mcp-server|
|          |  |           |  |        |  |          |
| Services |  | JWT+RBAC  |  | Redis  |  | 18+ MCP  |
| Zod CRUD |  | Agent     |  | or     |  | Tools    |
| Queries  |  | Lifecycle |  | Memory |  | Resources|
+----------+  +-----------+  +--------+  +----------+
       \            |            /
        +-------------------------+
        |      packages/db        |
        |  Drizzle ORM + pgvector |
        |  PostgreSQL or SQLite   |
        +-------------------------+
              |
        +-------------------------+
        |      packages/cli       |
        |  npx headless-crm start |
        |  Auto-detect PG/SQLite  |
        +-------------------------+
```

---

## Project Structure

```
headless-crm/
├── apps/
│   ├── api/            Hono REST API + MCP HTTP transport
│   └── web/            Next.js 16 dashboard + Vercel API proxy
├── packages/
│   ├── db/             Drizzle ORM schemas (PostgreSQL + SQLite)
│   ├── core/           CRM engine (contacts, companies, deals, cases, pipelines,
│   │                   activities, webhooks, custom fields, approvals, emails,
│   │                   embeddings, notifications, attachments)
│   ├── auth/           Agent JWT auth, RBAC, agent lifecycle
│   ├── auth-web/       Human user auth (Better Auth, cookie sessions, OAuth)
│   ├── events/         Event bus (Redis Streams or in-memory fallback)
│   ├── mcp-server/     MCP server with 28+ tools
│   └── cli/            CLI entry point (npx headless-crm start)
├── scripts/            Setup & provisioning scripts
├── docker-compose.yml  PostgreSQL + API + Web (full stack)
├── Dockerfile          API Docker image
├── Dockerfile.web      Web dashboard Docker image
├── vercel.json         Vercel deployment config
├── turbo.json          Turborepo pipeline config
└── package.json        Workspace root
```

---

## MCP Integration

AI agents connect via the Model Context Protocol. The server exposes 28+ tools:

| Tool | Description | Write |
|------|-------------|-------|
| `crm_query` | Query any collection with filters, sort, pagination | No |
| `crm_get` | Retrieve a single record by ID | No |
| `crm_search` | Semantic and keyword search across collections | No |
| `crm_schema` | Retrieve data model, fields, types, relationships | No |
| `crm_list_fields` | List custom field definitions for a collection | No |
| `crm_create` | Create a new record with validation | Yes |
| `crm_update` | Update specific fields on an existing record | Yes |
| `crm_delete` | Soft-delete a record | Yes |
| `crm_bulk_update` | Batch update multiple records | Yes |
| `crm_log_activity` | Append an activity to a record's timeline | Yes |
| `crm_subscribe` | Register a webhook for event notifications | Yes |
| `crm_unsubscribe` | Remove an event subscription | Yes |
| `crm_define_field` | Define a custom field on a collection | Yes |
| `crm_send_email` | Send an email via Resend | Yes |
| `crm_log_email` | Log an email to a contact's timeline | Yes |
| `crm_request_approval` | Request human approval for an action | Yes |
| `crm_attach_file` | Attach a file to a record | Yes |
| `crm_import` | Bulk import records from JSON/CSV | Yes |
| `crm_memory_propose` | Store an agent memory (insight, preference) | Yes |
| `crm_deal_add_contact` | Link a contact to a deal | Yes |
| `crm_deal_remove_contact` | Unlink a contact from a deal | Yes |
| `crm_deal_get_contacts` | List contacts linked to a deal | No |
| `crm_tag_list` | List tags in the tenant (filterable by objectType) | No |
| `crm_tag_create` | Create a new tag | Yes |
| `crm_tag_delete` | Delete a tag and all its attachments | Yes (developer) |
| `crm_tag_attach` | Attach a tag to a record | Yes |
| `crm_tag_detach` | Detach a tag from a record | Yes |
| `crm_tag_list_for_record` | List tags attached to a specific record | No |

### Connecting via Streamable HTTP

```
URL:   https://your-domain.com/mcp   (or http://localhost:3001/mcp)
Auth:  Bearer <agent-jwt-token>
```

When using the dashboard origin as the MCP entrypoint, use `http://localhost:3000/api/mcp`; discovery is available at `/.well-known/mcp.json`.

For `crm_create`, agents should include the collection-specific required fields:

- `contacts`: `firstName`, `lastName`
- `companies`: `name`
- `deals`: `name`, `stage`, `pipelineId`
- `cases`: `title`, `contactId`

### Connecting via stdio (Claude Desktop)

```json
{
  "mcpServers": {
    "headless-crm": {
      "command": "npx",
      "args": ["tsx", "packages/mcp-server/src/stdio.ts"],
      "env": {
        "DATABASE_URL": "postgresql://headless:headless@localhost:5433/headless_crm",
        "JWT_SECRET": "<generate-a-32-char-random-secret>",
        "HEADLESS_CRM_TOKEN": "<your-agent-jwt-token>"
      }
    }
  }
}
```

### Obtaining an Agent Token

**Via Admin API Key (bootstrap):**

```bash
curl -X POST http://localhost:3001/api/agents/provision \
  -H "X-Admin-Key: <your-admin-key>" \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "tenant_demo", "name": "my-agent", "role": "operator"}'
```

**Via Settings UI:** Navigate to Settings in the dashboard to provision agents with auto-generated API keys.

---

## REST API

All routes under `/api` require a Bearer token (except health checks and setup status).

Full interactive API docs available at `/api/docs` (Scalar UI).

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| **Contacts** | | |
| `GET/POST` | `/api/contacts` | List / Create |
| `GET/PATCH/DELETE` | `/api/contacts/:id` | Get / Update / Delete |
| **Companies** | | |
| `GET/POST` | `/api/companies` | List / Create |
| `GET/PATCH/DELETE` | `/api/companies/:id` | Get / Update / Delete |
| **Deals** | | |
| `GET/POST` | `/api/deals` | List / Create (supports `stage`, `pipelineId` filters) |
| `GET/PATCH/DELETE` | `/api/deals/:id` | Get / Update / Delete |
| `GET/POST/DELETE` | `/api/deals/:id/contacts` | Deal-contact associations |
| **Cases** | | |
| `GET/POST` | `/api/cases` | List / Create (supports `status`, `priority` filters) |
| `GET/PATCH/DELETE` | `/api/cases/:id` | Get / Update / Delete |
| **Pipelines** | | |
| `GET/POST` | `/api/pipelines` | List / Create |
| `GET/PATCH/DELETE` | `/api/pipelines/:id` | Get / Update / Delete |
| **Activities** | | |
| `GET/POST` | `/api/activities` | List / Log (supports `type` filter) |
| `GET` | `/api/activities/:id` | Get a single activity |
| **Tags** | | |
| `GET/POST` | `/api/tags` | List / Create (supports `objectType` filter) |
| `DELETE` | `/api/tags/:id` | Delete a tag |
| `POST` | `/api/tags/attach` | Attach tag to record |
| `POST` | `/api/tags/detach` | Detach tag from record |
| `GET` | `/api/tags/record/:type/:id` | List tags for a record |
| **Pipeline Triggers** | | |
| `GET/POST` | `/api/pipeline-triggers` | List / Create auto-advance rule |
| `GET/PATCH/DELETE` | `/api/pipeline-triggers/:id` | Get / Update / Delete |
| **Events** | | |
| `GET` | `/api/events` | Audit trail (auditor or developer; supports `limit`, `offset`) |
| `GET` | `/api/agents/:id/logs` | Per-agent action log (auditor or developer) |
| **Agents** | | |
| `GET/POST` | `/api/agents` | List / Provision |
| `POST` | `/api/agents/provision` | Bootstrap provision (Admin Key) |
| `POST` | `/api/agents/:id/suspend` | Suspend agent |
| `POST` | `/api/agents/:id/approve` | Approve pending agent |
| **Webhooks** | | |
| `GET/POST` | `/api/webhooks` | List / Register |
| `GET/PATCH/DELETE` | `/api/webhooks/:id` | Get / Update / Delete |
| `GET` | `/api/webhooks/:id/deliveries` | Delivery history |
| `POST` | `/api/webhooks/:id/test` | Send test event |
| `POST` | `/api/webhooks/inbound` | Receive external data (60/min/tenant) |
| `POST` | `/api/webhooks/resend` | Resend email-engagement webhook (HMAC-signed; `RESEND_WEBHOOK_SECRET` required in prod) |
| **Custom Fields** | | |
| `GET/POST` | `/api/custom-fields` | List / Define |
| `GET/PATCH/DELETE` | `/api/custom-fields/:id` | Get / Update / Delete |
| **Approvals** | | |
| `GET` | `/api/approvals` | List approvals |
| `POST` | `/api/approvals/:id/approve` | Approve |
| `POST` | `/api/approvals/:id/reject` | Reject |
| **Emails** | | |
| `POST` | `/api/emails/send` | Send email via Resend |
| `GET` | `/api/emails/thread/:contactId` | Get email thread |
| **Attachments** | | |
| `GET/POST` | `/api/attachments` | List / Upload |
| `GET/DELETE` | `/api/attachments/:id` | Get / Delete |
| **Notifications** | | |
| `GET` | `/api/notifications` | List notifications |
| `GET` | `/api/notifications/unread-count` | Unread count |
| `POST` | `/api/notifications/:id/read` | Mark read |
| `POST` | `/api/notifications/read-all` | Mark all read |
| **Search** | | |
| `GET` | `/api/search/semantic` | Vector similarity search |
| **Stats** | | |
| `GET` | `/api/stats` | Dashboard counts |
| **MCP** | | |
| `ALL` | `/mcp` | MCP Streamable HTTP transport |
| `GET` | `/.well-known/mcp.json` | MCP discovery document |
| **Docs** | | |
| `GET` | `/api/docs` | OpenAPI 3.1 Scalar UI |

---

## RBAC Roles

| Role | Read CRM | Create/Update | Delete | Manage Schema | Read audit trail |
|------|----------|---------------|--------|---------------|------------------|
| `reader` | Yes | No | No | No | No |
| `operator` | Yes | Yes | No | No | No |
| `developer` | Yes | Yes | Yes | Yes | Yes |
| `auditor` | Yes | No | No | No | Yes |

`auditor` is read-only across CRM data **plus** the audit trail (`GET /api/events`,
`GET /api/agents/:id/logs`). Reader and operator cannot read the audit trail —
that gating prevents agents from enumerating each other's actions.

Role enforcement happens at three layers:
- **API routes** — `requireWrite` / `requireDelete` / `requireManage` /
  `requireAudit` middleware in `apps/api/src/app.ts`.
- **MCP tools** — every tool is gated by `ctx.role` in
  `packages/mcp-server/src/index.ts` against the tool's `annotations.readOnly`
  / `annotations.destructive` flags before execute.
- **Service layer** — every service filters by `ctx.tenantId` and validates
  any FK reference (contactId, companyId, dealId, agentId) belongs to the
  caller's tenant before mutation.

---

## Team Access & Human Authentication

The dashboard supports multiple human team members via [Better Auth](https://better-auth.com) — self-hostable, Drizzle-native HttpOnly cookie sessions.

### First Run: Setup Wizard

On first visit, you'll be redirected to `/setup` to create the owner account and workspace:

1. Enter your name, email, password, and workspace name
2. Your account is created with the `owner` role
3. You're signed in and redirected to the dashboard

If users already exist, `/setup` returns `403`.

### Login

Visit `/login` to sign in with email and password. Optional Google/GitHub OAuth buttons appear when `NEXT_PUBLIC_OAUTH_ENABLED=true`.

### Inviting Team Members

From **Settings → Team**, owners and admins can invite members:

- Click **Invite Member**, enter email and role (`admin` or `member`)
- **Self-hosted (no SMTP):** copy the invite link from the modal and share it manually — zero external dependencies
- **With Resend configured:** invite email is sent automatically

Invite links expire after 48 hours. Pending invites are listed in the Team page until accepted or expired.

Owners can also:

- change member roles between `member` and `admin`
- remove members from the tenant without deleting their underlying auth account

Admins can cancel pending invites but cannot promote, demote, or remove the owner.

### Human Roles

| Role | Dashboard access | Can invite |
|------|-----------------|------------|
| `owner` | Full — including all settings | Yes |
| `admin` | Full — including agent provisioning | Yes |
| `member` | Read-only — cannot manage agents or settings | No |

### Human Auth Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `BETTER_AUTH_SECRET` | 32+ char signing secret for sessions | Yes |
| `BETTER_AUTH_URL` | Canonical URL (e.g. `https://app.example.com`) | Vercel only |
| `NEXT_PUBLIC_APP_URL` | Public URL for invite links | Recommended |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Enable Google OAuth | No |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Enable GitHub OAuth | No |
| `NEXT_PUBLIC_OAUTH_ENABLED` | Show OAuth buttons on login page | No |

Generate a secure secret:
```bash
openssl rand -base64 32
```

### How It Works

Human sessions (cookie-based) are separate from agent JWTs. On login, the dashboard exchanges the session cookie for a CRM agent token stored in `localStorage` as `hcrm_token`. This bridges the human identity to the existing Hono API with no changes to the API layer.

---

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | (SQLite mode if unset) |
| `DB_PATH` | SQLite file path (when no DATABASE_URL) | `./headless-crm.db` |
| `REDIS_URL` | Redis connection string (optional) | (in-memory fallback) |
| `JWT_SECRET` | Secret for signing agent JWTs | (required in production; generate a 32+ char random value) |
| `PORT` | API server port | `3001` |
| `ADMIN_API_KEY` | Admin key for bootstrap provisioning | (none) |
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:3000` |
| `RESEND_API_KEY` | Resend API key for emails (optional) | (email disabled) |
| `EMAIL_FROM` | Sender email address | `crm@headless-crm.dev` |
| `OPENAI_API_KEY` | OpenAI key for embeddings/vector search (optional) | (vector search disabled) |
| `HEADLESS_CRM_TOKEN` | Agent JWT for stdio MCP mode | (none) |
| `NEXT_PUBLIC_API_URL` | API URL for web dashboard | `http://localhost:3001` |
| `BETTER_AUTH_SECRET` | 32+ char secret for human session signing | (required for dashboard login) |
| `BETTER_AUTH_URL` | Canonical deployment URL (required on Vercel) | `http://localhost:3000` |
| `NEXT_PUBLIC_APP_URL` | Public URL used in invite links | `http://localhost:3000` |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Monorepo | Turborepo + npm workspaces |
| API framework | Hono (Node.js + Vercel Functions) |
| Database | PostgreSQL 16 + pgvector / SQLite (local) |
| ORM | Drizzle ORM |
| Event bus | Redis 7 Streams or in-memory fallback |
| Auth | JWT via jose, RBAC middleware |
| Validation | Zod |
| MCP SDK | @modelcontextprotocol/sdk |
| Web framework | Next.js 16 |
| UI components | shadcn/ui + Tailwind CSS 4 |
| Email | Resend |
| Embeddings | OpenAI text-embedding-3-small + pgvector |
| Language | TypeScript 5.7 |

---

## Self-Hosting

### Docker Compose (full stack)

```bash
# Set strong secrets first
export JWT_SECRET="$(openssl rand -base64 32)"
export ADMIN_API_KEY="$(openssl rand -base64 32)"

# Start everything (PostgreSQL + API + Dashboard)
docker compose up -d

# Visit http://localhost:3000 (dashboard) or http://localhost:3001/api/docs (API)
```

### Docker Compose with Redis

```bash
docker compose --profile full up -d
```

### Docker (standalone API)

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t headless-crm .
docker run -p 3001:3001 \
  -e DATABASE_URL=postgresql://... \
  -e JWT_SECRET=your-secret \
  headless-crm
```

### Single Binary (no Docker)

```bash
npm start
# Or: npx tsx packages/cli/src/index.ts --port 3001 --db-path ./my-crm.db
```

---

## Development

```bash
npm run dev          # Start all apps in watch mode
npm run build        # Build everything
npm run lint         # Lint all packages
npm run test         # Run tests (Vitest, packages/core)
npm run db:generate  # Generate Drizzle migrations
npm run db:migrate   # Apply migrations
npm run db:seed      # Seed demo data
```

### Running tests

Tests live in `packages/core/src/__tests__/` and use [Vitest](https://vitest.dev/). They mock the database layer and focus on service-layer business logic.

```bash
# Run all tests once
npm run test -w packages/core

# Watch mode
npm run test:watch -w packages/core

# With coverage
npm run test:coverage -w packages/core
```

---

## Database Tables

| Table | Description |
|-------|-------------|
| `tenants` | Multi-tenant isolation |
| `agents` | AI agent identities, API keys, roles, metadata |
| `contacts` | People records with pgvector embeddings |
| `companies` | Organization records with parent hierarchy |
| `deals` | Sales opportunities tied to pipelines |
| `deal_contacts` | Many-to-many deal ↔ contact associations |
| `pipelines` | Pipeline definitions with JSONB stages |
| `activities` | Timeline events (calls, emails, meetings, notes, tasks) |
| `tags` / `record_tags` | Categorization labels |
| `agent_memories` | Agent-specific persistent memory (pgvector) |
| `events` | Event sourcing audit trail |
| `cases` | Support/service cases with status and priority |
| `webhooks` | Registered webhook endpoints with HMAC secrets |
| `webhook_deliveries` | Delivery attempts and retry tracking |
| `custom_field_definitions` | Tenant-specific field definitions per collection |
| `approvals` | Human approval requests for agent actions |
| `attachments` | File attachments on any record |
| `notifications` | System notifications with read/unread state |
| `users` | Human user accounts (name, email, role, tenantId) |
| `sessions` | Better Auth HttpOnly cookie sessions |
| `accounts` | OAuth provider accounts + bcrypt password hashes |
| `verifications` | Email verification tokens |
| `invites` | Team invite tokens with expiry and accept status |

---

## Webhooks

Register HTTP callbacks for real-time event notifications with HMAC-SHA256 signature verification.

```bash
curl -X POST http://localhost:3001/api/webhooks \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/webhook", "eventTypes": ["contacts.*", "deals.stage_changed"]}'
```

**Signature verification:**

Each webhook delivery includes `X-Webhook-Timestamp` and `X-Webhook-Signature` headers. The signature format is `t=<timestamp>,v1=<hex>` where the HMAC input is `<timestamp>.<body>`.

```javascript
import { createHmac, timingSafeEqual } from "crypto";

function verifyWebhook(rawBody, signatureHeader, secret, timestamp) {
  const [, v1] = signatureHeader.match(/v1=([0-9a-f]+)/) ?? [];
  if (!v1) return false;
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  // Use constant-time comparison to prevent timing attacks
  return timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
}
```

Deliveries retry up to 3 times with exponential backoff. Monitor delivery history at `GET /api/webhooks/:id/deliveries`.

Subscribe to `notifications.created` to receive webhook pushes for in-app notifications.

---

## Custom Fields

Extend any entity with tenant-specific fields:

```bash
curl -X POST http://localhost:3001/api/custom-fields \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"collection": "contacts", "fieldName": "linkedin_url", "fieldType": "url"}'
```

Supported types: `text`, `number`, `boolean`, `date`, `select`, `multiselect`, `url`, `email`

Custom fields are automatically:
- Available to agents via the `crm_list_fields` MCP tool
- Shown in the web dashboard on create/edit forms and detail pages
- Included in API responses and webhook payloads
- Schema changes emit events so agents can discover new fields

---

## Error Responses

All API errors follow a consistent JSON format:

```json
{
  "error": "Human-readable error message"
}
```

| HTTP Status | Meaning |
|-------------|---------|
| `400` | Bad request — validation failure or missing required fields |
| `401` | Unauthorized — missing, invalid, or expired token |
| `403` | Forbidden — valid token but insufficient role for this action |
| `404` | Not found — record does not exist or belongs to another tenant |
| `409` | Conflict — duplicate record or constraint violation |
| `429` | Rate limited — 100 req/min (authenticated) or 20 req/min (unauthenticated). Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After` |
| `500` | Internal server error |

---

## Known Limitations

| Limitation | Details |
|------------|---------|
| **File attachment storage** | Local and self-host deploys can keep attachments on disk with `ATTACHMENTS_STORAGE=disk` and back up that directory alongside the database. Database-backed attachment storage is still available for lightweight eval environments. |
| **No real-time push** | The dashboard polls the API for updates. WebSocket or Server-Sent Events support is not currently implemented. For real-time integrations, use webhooks. |
| **Dual-database type abstraction** | PostgreSQL and SQLite Drizzle schemas have different TypeScript types. Service layer code branches on `db.type`. A unified abstract schema type is planned. |
| **Approval expiration is on-read** | Expired approvals are marked as `expired` automatically when a `list` or `getPending` call is made — not via a background job. Approvals will remain as `pending` in the database until next polled. |

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup instructions and PR guidelines.
For extension work, start with [EXTENDING_HEADLESS_CRM.md](./EXTENDING_HEADLESS_CRM.md).
For community expectations, see [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

---

## License

Headless CRM is licensed under the [GNU Affero General Public License v3.0](LICENSE).

Copyright 2026 Humaie.
