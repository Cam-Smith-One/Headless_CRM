<h1 align="center">Headless CRM</h1>

<p align="center">
  <img src="./banner.png" alt="Headless CRM — the open-source CRM built for AI agents" width="480" /><br><br>
  <a href="https://github.com/Cam-Smith-One/Headless_CRM/stargazers"><img src="https://img.shields.io/github/stars/Cam-Smith-One/Headless_CRM?style=flat&color=yellow" alt="GitHub Stars" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-AGPL_v3-blue.svg" alt="License: AGPL v3" /></a>
  <img src="https://img.shields.io/badge/MCP-Native-blueviolet?style=flat" alt="MCP Native" />
  <img src="https://img.shields.io/badge/API-First-blue?style=flat" alt="API First" />
  <img src="https://img.shields.io/badge/Self--Hostable-green?style=flat" alt="Self-Hostable" />
  <a href="https://github.com/Cam-Smith-One/Headless_CRM/actions/workflows/ci.yml"><img src="https://github.com/Cam-Smith-One/Headless_CRM/actions/workflows/ci.yml/badge.svg" alt="CI" /></a><br>
  <strong>The open-source CRM built for AI agents. MCP-native, API-first, self-hostable.</strong><br>
  <a href="#quick-start">Quick Start</a> •
  <a href="#mcp-integration">MCP Tools</a> •
  <a href="#rest-api">REST API</a> •
  <a href="#self-hosting">Self-Hosting</a> •
  <a href="https://github.com/Cam-Smith-One/Headless_CRM/issues">Issues</a>
</p>

> **Want it fully managed?** Skip the setup — [get the hosted version →](https://humaie.com) _(zero ops, auto-updates)_

---

# Why Headless?

The SaaS CRM you're paying $150/month for was built for humans clicking buttons. Your AI agents don't click buttons.

They make API calls. They need tool schemas, audit trails, role-scoped access, and something that fires a webhook when a deal moves stages. They don't need a kanban board they'll never look at.

**We're in the early innings of an AI-agent-first world.** If you're building a startup, running a one-person shop, or shipping products with Claude, Codex, OpenClaw, or Hermes — your CRM should be as programmable as your agents. You should be able to hand an agent a JWT and an MCP endpoint and have it managing your entire pipeline by end of day.

That's what Headless CRM is. It's not a replacement for Salesforce. It's what you reach for when a Salesforce subscription costs more than your infrastructure.

> _"The companies that win in an agent-first world won't be the ones with the best dashboards. They'll be the ones with the best APIs."_

<p align="center">
  <img src="./apps/web/public/dashboard-preview.jpg" alt="Headless CRM Dashboard" width="900" style="border-radius:8px;box-shadow:0 4px 24px rgba(0,0,0,0.12);" />
</p>

### What that looks like in practice

```
# You: "Research and qualify all leads that replied to last week's campaign"

Agent → crm_query contacts where lastActivityType = email.replied, after = 7d ago
Agent → crm_search companies by domain for each contact
Agent → crm_update contacts set score = 85, stage = Qualified
Agent → crm_log_activity "Qualified via reply signal. Company: Series A, 50–200 employees."
Agent → crm_request_approval "Move 12 contacts to Proposal — estimated value $480k"

Human → ✓ Approved
```

No manual data entry. No clicking through 40 records. One prompt, 12 deals advanced.

### Who it's for

- **Startups and solo builders** who want enterprise CRM features without enterprise pricing
- **Agent developers** building with Claude Code, Codex, OpenClaw, or Hermes who need a CRM their agents can actually talk to
- **Small teams** who want a self-hosted, private CRM they own completely

---

## Quick Start

> **Builder / agent developer?** Use [Option 2 (SQLite)](#option-2-sqlite-no-docker--full-runtime) — no Docker, no external DB, under a minute. Perfect with Claude, Codex, OpenClaw, and Hermes.

### Option 1: One-Command Setup (PostgreSQL)

```bash
git clone https://github.com/Cam-Smith-One/Headless_CRM.git
cd Headless_CRM
./scripts/setup.sh
npm run dev    # API on :3001, Dashboard on :3000
```

### Option 2: SQLite (no Docker — full runtime)

**No external dependencies — just Node.js.** The full API, web UI, and MCP transport all run against SQLite.

```bash
git clone https://github.com/Cam-Smith-One/Headless_CRM.git
cd Headless_CRM
./scripts/setup-sqlite.sh   # creates ./headless-crm.db, applies migrations, seeds demo data
npm run dev                 # API on :3001, dashboard on :3000
```

Postgres-only features in SQLite mode: vector search (`/api/search/semantic`) and the Resend email-engagement metadata SQL filter. Everything else is feature-equivalent.

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

1. Click the button → add a **Neon Postgres** integration from the Vercel Marketplace
2. Set `JWT_SECRET` and `ADMIN_API_KEY`
3. Deploy

### Option 5: npx (scaffolder)

```bash
npx create-headless-crm
```

---

## Features

### Core CRM
- **Contacts, Companies, Deals, Cases** — full CRUD with search, filtering, and pagination
- **Contact Merge** — `POST /api/contacts/:id/merge`: primary fields win, gaps fill from the other, all FK refs (activities, cases, deals, tags) re-pointed, merged contact archived
- **Enrichment hooks** — push enrichment payloads to contacts or companies; standard fields fill gaps, non-standard keys go into `customFields`
- **Bulk Delete** — soft-delete up to 500 records in one call (developer role)
- **Case SLA** — `dueAt` (timestamp) + `slaHours` (integer) on every case for agent-driven deadline tracking
- **Pipelines** — multi-pipeline with customizable stages; full stage-change history via audit trail
- **Activities** — timeline events: calls, emails, meetings, notes, tasks, agent actions
- **Tags** — categorization labels for any record, queryable by type
- **Saved Searches** — store named filter sets per collection so agents can reuse queries
- **Custom Fields** — extend any entity with tenant-specific fields (text, number, boolean, date, select, multiselect, url, email)

### Agent Platform
- **29 MCP tools** — every CRM operation exposed as a typed tool agents can call directly
- **Agent Identity** — unique API keys (`hcrm_sk_...`), JWT auth, full lifecycle management
- **RBAC** — four roles: `reader`, `operator`, `developer`, `auditor` — enforced at API, MCP, and service layers
- **Human Approval Workflows** — agents request approval before dangerous actions; humans approve in the dashboard
- **Agent Memory** — persistent memory with pgvector embeddings for semantic recall
- **Pipeline Triggers** — auto-advance deals on email events, field changes, or elapsed time

### API & Integrations
- **REST API** — full CRUD for all entities with OpenAPI 3.1 docs (Scalar UI at `/api/docs`)
- **Webhooks** — outbound HMAC-SHA256-signed HTTP callbacks with delivery retries
- **Inbound Webhooks** — receive data from external systems (rate-limited 60/min per tenant)
- **Email Integration** — send/log emails via Resend with graceful degradation
- **Vector Search** — semantic search via OpenAI text-embedding-3-small + pgvector

### Security
- **MCP Role Enforcement** — every tool gated by `ctx.role`; readers can't write, operators can't delete, only developers modify schema
- **Tenant Isolation** — every query scoped by `tenantId`; FK references validated against caller's tenant before mutation
- **Error Sanitization** — all 73 catch blocks route through a central sanitizer — no DB column names leak to callers
- **Rate Limiting** — Redis-backed (in-memory fallback), 100/min authenticated, 20/min unauthenticated
- **Resend Webhook Signing** — HMAC-signed; unsigned requests rejected in production

---

## Architecture

```
+-----------------------------------------------------+
|                     apps/web                         |
|              Next.js Dashboard                       |
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
| Services |  | JWT+RBAC  |  | Redis  |  | 29 MCP   |
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
│   └── web/            Next.js dashboard + Vercel API proxy
├── packages/
│   ├── db/             Drizzle ORM schemas (PostgreSQL + SQLite), migrations, seed
│   ├── core/           CRM services (contacts, companies, deals, cases, pipelines,
│   │                   activities, webhooks, custom fields, approvals, emails,
│   │                   embeddings, notifications, attachments, saved searches)
│   ├── auth/           Agent JWT auth, RBAC, agent lifecycle
│   ├── auth-web/       Human user auth (Better Auth, cookie sessions, OAuth)
│   ├── events/         Event bus (Redis Streams or in-memory fallback)
│   ├── mcp-server/     MCP server with 29 tools
│   └── cli/            CLI entry point (npx headless-crm start)
├── scripts/            Setup & provisioning scripts
├── docker-compose.yml  PostgreSQL + API + Web (full stack)
└── turbo.json          Turborepo pipeline config
```

---

## MCP Integration

AI agents connect via the Model Context Protocol. The server exposes **29 tools**:

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
| `crm_bulk_delete` | Soft-delete up to 500 records in one call (developer role) | Yes |
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

### Connecting via stdio (Claude Desktop)

```json
{
  "mcpServers": {
    "headless-crm": {
      "command": "npx",
      "args": ["tsx", "packages/mcp-server/src/stdio.ts"],
      "env": {
        "DATABASE_URL": "postgresql://headless:headless@localhost:5433/headless_crm",
        "JWT_SECRET": "change-me-in-production",
        "HEADLESS_CRM_TOKEN": "<your-agent-jwt-token>"
      }
    }
  }
}
```

### Obtaining an Agent Token

```bash
curl -X POST http://localhost:3001/api/agents/provision \
  -H "X-Admin-Key: <your-admin-key>" \
  -H "Content-Type: application/json" \
  -d '{"name": "my-agent", "role": "operator"}'
```

Or navigate to **Settings** in the dashboard to provision agents with auto-generated API keys.

> **`developer`-role agents** are automatically activated when provisioned via `POST /api/agents/provision` (admin key required). Self-service `developer` registrations via the standard flow remain `pending_approval` until peer-approved.

---

## REST API

All routes under `/api` require a Bearer token (except health checks). Full interactive docs at `/api/docs` (Scalar UI).

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| **Contacts** | | |
| `GET/POST` | `/api/contacts` | List / Create |
| `GET/PATCH/DELETE` | `/api/contacts/:id` | Get / Update / Delete |
| `POST` | `/api/contacts/:id/merge` | Merge duplicate into this contact |
| `POST` | `/api/contacts/:id/enrich` | Apply enrichment payload |
| `DELETE` | `/api/contacts/bulk` | Bulk delete up to 500 (developer) |
| **Companies** | | |
| `GET/POST` | `/api/companies` | List / Create |
| `GET/PATCH/DELETE` | `/api/companies/:id` | Get / Update / Delete |
| `POST` | `/api/companies/:id/enrich` | Apply enrichment payload |
| `DELETE` | `/api/companies/bulk` | Bulk delete up to 500 (developer) |
| **Deals** | | |
| `GET/POST` | `/api/deals` | List / Create (supports `stage`, `pipelineId` filters) |
| `GET/PATCH/DELETE` | `/api/deals/:id` | Get / Update / Delete |
| `GET/POST/DELETE` | `/api/deals/:id/contacts` | Deal-contact associations |
| `GET` | `/api/deals/:id/stage-history` | Full stage-change history from audit trail |
| `DELETE` | `/api/deals/bulk` | Bulk delete up to 500 (developer) |
| **Cases** | | |
| `GET/POST` | `/api/cases` | List / Create (`dueAt`, `slaHours` accepted) |
| `GET/PATCH/DELETE` | `/api/cases/:id` | Get / Update / Delete |
| `DELETE` | `/api/cases/bulk` | Bulk delete up to 500 (developer) |
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
| `GET/POST` | `/api/pipeline-triggers` | List / Create (`email_event` \| `field_change` \| `time_elapsed`) |
| `GET/PATCH/DELETE` | `/api/pipeline-triggers/:id` | Get / Update / Delete |
| **Saved Searches** | | |
| `GET/POST` | `/api/saved-searches` | List / Create saved filter set |
| `GET/PATCH/DELETE` | `/api/saved-searches/:id` | Get / Update / Delete |
| **Events** | | |
| `GET` | `/api/events` | Audit trail (auditor or developer) |
| `GET` | `/api/agents/:id/logs` | Per-agent action log (auditor or developer) |
| **Agents** | | |
| `GET/POST` | `/api/agents` | List / Provision |
| `POST` | `/api/agents/provision` | Bootstrap provision (Admin Key) |
| `POST` | `/api/agents/:id/suspend` | Suspend agent |
| `POST` | `/api/agents/:id/approve` | Approve pending agent |
| **Approvals** | | |
| `GET` | `/api/approvals` | List approvals |
| `POST` | `/api/approvals` | Create an approval request (operator role) |
| `POST` | `/api/approvals/:id/approve` | Approve |
| `POST` | `/api/approvals/:id/reject` | Reject |
| **Webhooks** | | |
| `GET/POST` | `/api/webhooks` | List / Register |
| `GET/PATCH/DELETE` | `/api/webhooks/:id` | Get / Update / Delete |
| `POST` | `/api/webhooks/:id/test` | Send test event |
| `POST` | `/api/webhooks/inbound` | Receive external data (60/min/tenant) |
| `POST` | `/api/webhooks/resend` | Resend email-engagement webhook (HMAC-signed) |
| **Custom Fields** | | |
| `GET/POST` | `/api/custom-fields` | List / Define |
| `GET/PATCH/DELETE` | `/api/custom-fields/:id` | Get / Update / Delete |
| **Emails** | | |
| `POST` | `/api/emails/send` | Send email via Resend |
| `GET` | `/api/emails/thread/:contactId` | Get email thread |
| **Attachments** | | |
| `GET/POST` | `/api/attachments` | List / Upload |
| `GET/DELETE` | `/api/attachments/:id` | Get / Delete |
| **Notifications** | | |
| `GET` | `/api/notifications` | List notifications |
| `POST` | `/api/notifications/:id/read` | Mark read |
| `POST` | `/api/notifications/read-all` | Mark all read |
| **Search** | | |
| `GET` | `/api/search/semantic` | Vector similarity search (Postgres only) |
| **MCP** | | |
| `ALL` | `/mcp` | MCP Streamable HTTP transport |
| `GET` | `/.well-known/mcp.json` | MCP discovery document |
| **Docs** | | |
| `GET` | `/api/docs` | OpenAPI 3.1 Scalar UI |

---

## RBAC Roles

| Role | Read CRM | Create/Update | Delete | Manage Schema | Audit Trail |
|------|----------|---------------|--------|---------------|-------------|
| `reader` | ✅ | — | — | — | — |
| `operator` | ✅ | ✅ | — | — | — |
| `developer` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `auditor` | ✅ | — | — | — | ✅ |

`auditor` can read the audit trail — `reader` and `operator` cannot. Enforcement happens at three layers: API middleware, MCP tool annotations, and service-layer tenant isolation.

---

## Team Access & Human Authentication

The dashboard supports multiple team members via [Better Auth](https://better-auth.com) — self-hostable, cookie-based sessions. On first visit you're redirected to `/setup` to create the owner account. Invite members from **Settings → Team** (link sharing works without SMTP; Resend sends automatically when configured).

| Variable | Description | Required |
|----------|-------------|----------|
| `BETTER_AUTH_SECRET` | 32+ char signing secret | Yes |
| `BETTER_AUTH_URL` | Canonical URL (Vercel only) | Vercel |
| `NEXT_PUBLIC_APP_URL` | Used in invite links | Recommended |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth | No |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth | No |

---

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | SQLite mode if unset |
| `REDIS_URL` | Redis (optional) | in-memory fallback |
| `JWT_SECRET` | Agent JWT signing | `change-me-in-production` |
| `PORT` | API port | `3001` |
| `ADMIN_API_KEY` | Bootstrap provisioning | (none) |
| `CORS_ORIGINS` | Comma-separated allowed origins | `*` |
| `RESEND_API_KEY` | Email via Resend (optional) | email disabled |
| `OPENAI_API_KEY` | Embeddings / vector search (optional) | vector search disabled |
| `HEADLESS_CRM_TOKEN` | Agent JWT for stdio MCP | (none) |
| `NEXT_PUBLIC_API_URL` | API URL for dashboard | `http://localhost:3001` |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Monorepo | Turborepo + npm workspaces |
| API framework | Hono (Node.js + Vercel Functions) |
| Database | PostgreSQL 16 + pgvector / SQLite |
| ORM | Drizzle ORM |
| Event bus | Redis 7 Streams or in-memory fallback |
| Auth | JWT via jose, RBAC middleware |
| Validation | Zod |
| MCP SDK | @modelcontextprotocol/sdk |
| Web framework | Next.js App Router |
| UI components | shadcn/ui + Tailwind CSS 4 |
| Email | Resend |
| Embeddings | OpenAI text-embedding-3-small + pgvector |
| Language | TypeScript 5.7 |

---

## Self-Hosting

```bash
export JWT_SECRET="your-secure-secret"
export ADMIN_API_KEY="your-admin-key"
docker compose up -d
# Dashboard: http://localhost:3000  API docs: http://localhost:3001/api/docs

# With Redis:
docker compose --profile full up -d
```

---

## Development

```bash
npm run dev          # Start all apps in watch mode
npm run build        # Build everything
npm run test         # Run tests (Vitest)
npm run db:generate  # Generate Drizzle migrations
npm run db:migrate   # Apply migrations
npm run db:seed      # Seed demo data (set SEED_TENANT_ID to target a specific tenant)
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
| `cases` | Support/service cases with status, priority, SLA (`due_at`, `sla_hours`) |
| `webhooks` | Registered webhook endpoints with HMAC secrets |
| `webhook_deliveries` | Delivery attempts and retry tracking |
| `custom_field_definitions` | Tenant-specific field definitions per collection |
| `approvals` | Human approval requests for agent actions |
| `attachments` | File attachments on any record |
| `notifications` | System notifications with read/unread state |
| `saved_searches` | Named filter sets per collection for agents to reuse |
| `pipeline_triggers` | Auto-advance rules (email_event \| field_change \| time_elapsed) |
| `users` | Human user accounts |
| `sessions` | Better Auth HttpOnly cookie sessions |
| `accounts` | OAuth provider accounts + bcrypt password hashes |
| `verifications` | Email verification tokens |
| `invites` | Team invite tokens with expiry and accept status |

---

## Webhooks

```bash
curl -X POST http://localhost:3001/api/webhooks \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/webhook", "eventTypes": ["contacts.*", "deals.stage_changed"]}'
```

Each delivery includes `X-Webhook-Timestamp` and `X-Webhook-Signature` headers. Signature format: `t=<timestamp>,v1=<hex>` where the HMAC input is `<timestamp>.<body>`. Retries up to 3× with exponential backoff.

---

## Known Limitations

| Limitation | Details |
|------------|---------|
| **File attachment storage** | Stored as base64 blobs in the database — not recommended for large/frequent uploads. S3/Vercel Blob migration planned. |
| **No real-time push** | Dashboard polls the API. For real-time integrations use webhooks. |
| **Approval expiration is on-read** | Expired approvals are marked when polled, not via background job. |
| **30-day JWT expiry** | No rotation list — suspending the agent is the mitigation if a JWT leaks. |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and PR guidelines.

---

## Star History

<p align="center">
  <a href="https://www.star-history.com/#Cam-Smith-One/Headless_CRM&type=date">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Cam-Smith-One/Headless_CRM&type=date&theme=dark" />
      <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=Cam-Smith-One/Headless_CRM&type=date" />
      <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=Cam-Smith-One/Headless_CRM&type=date" />
    </picture>
  </a>
</p>

---

## Contributors

<a href="https://github.com/Cam-Smith-One/Headless_CRM/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Cam-Smith-One/Headless_CRM" alt="Contributors" />
</a>

---

## License

Headless CRM is licensed under the [GNU Affero General Public License v3.0](LICENSE).

Copyright 2026 Humaie.
