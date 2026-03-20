# Headless CRM

**The open-source CRM built for AI agents. MCP-native, API-first, self-hostable.**

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)

---

## Overview

Headless CRM is an open-source, agent-first customer relationship management system. Unlike traditional CRMs that bolt AI features onto human-centric interfaces, Headless CRM treats AI agents as first-class operators with their own identities, permissions, and audit trails.

Agents connect through the **Model Context Protocol (MCP)** — the same open standard used by Claude, Cursor, and other AI tools — giving them structured, authenticated access to contacts, companies, deals, pipelines, activities, and more.

**Why Headless CRM exists:**

- Traditional CRMs were designed for humans clicking buttons, not agents making API calls.
- Agent identity matters. Repurposing user accounts for bots creates security and audit gaps.
- CRM data is high-value. Every read and write should be traceable, permissioned, and replayable.
- AI agents need structured tool interfaces, not screen-scraped UIs.

---

## Features

### Core CRM
- **Contacts, Companies, Deals, Cases** — full CRUD with search, filtering, and pagination
- **Pipelines** — multi-pipeline support with customizable stages
- **Activities** — timeline events (calls, emails, meetings, notes, tasks, agent actions)
- **Tags** — categorization labels for any record
- **Custom Fields** — extend any entity with tenant-specific fields (text, number, boolean, date, select, multiselect, url, email) with validation

### Agent Platform
- **MCP-native** — 18+ tools for AI agent access via Streamable HTTP or stdio
- **Agent Identity** — unique API keys (`hcrm_sk_...`), JWT-based auth, full lifecycle management
- **RBAC** — four roles (reader, operator, developer, auditor) enforced at API middleware level
- **Human Approval Workflows** — agent provisioning and dangerous actions require human approval
- **Agent Memory** — persistent memory with pgvector embeddings for semantic recall

### API & Integrations
- **REST API** — full CRUD for all entities with OpenAPI 3.1 docs (Scalar UI at `/api/docs`)
- **Webhooks** — HTTP callbacks with HMAC-SHA256 signing, timestamp replay protection, delivery retries with exponential backoff
- **Email Integration** — send/log emails via Resend with graceful degradation
- **Vector Search** — semantic search via OpenAI text-embedding-3-small + pgvector cosine similarity

### Security
- **Rate Limiting** — 100 req/min authenticated, 20 req/min unauthenticated
- **CORS Lockdown** — configurable allowed origins via `CORS_ORIGINS` env var
- **Timing-safe Admin Key** — prevents timing attacks on admin endpoints
- **MCP Session TTL** — automatic session cleanup (30min timeout, 60s interval)
- **Webhook Replay Protection** — timestamp-based with configurable tolerance

### Monitoring & UI
- **Customizable Dashboard** — drag-and-drop widgets with localStorage persistence
- **Notification System** — auto-generated notifications for key CRM events with read/unread states
- **File Attachments** — upload and manage files on any record
- **Light/Dark Mode** — full theme support in the Next.js dashboard
- **Real-time Polling** — dashboard auto-refreshes with live data

### Deployment
- **Event Sourcing** — every mutation persisted with before/after change tracking
- **Multi-tenant** — complete data isolation per tenant
- **Self-hostable** — Docker Compose, single-binary CLI, or deploy to Vercel
- **Dual Database** — PostgreSQL (production) or SQLite (local/edge/single-binary)
- **Redis Optional** — falls back to in-memory event bus when Redis is unavailable

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

## Quick Start

### Option 1: Docker Compose (recommended)

```bash
git clone https://github.com/YOUR_ORG/headless-crm.git
cd headless-crm
cp .env.example .env
npm install

# Start PostgreSQL
docker compose up -d

# Run migrations and seed demo data
npm run db:generate
npm run db:migrate
npm run db:seed

# Start dev servers (API on :3001, Web on :3000)
npm run dev
```

### Option 2: Single Binary (SQLite)

No Docker or PostgreSQL needed — runs entirely on SQLite:

```bash
git clone https://github.com/YOUR_ORG/headless-crm.git
cd headless-crm
npm install

# Start with SQLite (auto-creates headless-crm.db)
npm start

# Or with options:
npx tsx packages/cli/src/index.ts --port 3001 --admin-key my-secret-key
```

### Option 3: Deploy to Vercel

The repo deploys as a single Vercel project — the Next.js web app proxies API routes to the Hono backend via catch-all API routes.

1. Push to GitHub
2. Import in Vercel Dashboard
3. Add a **Neon Postgres** integration (Marketplace)
4. Set environment variables: `DATABASE_URL`, `JWT_SECRET`, `ADMIN_API_KEY`
5. Deploy

Redis is optional — the event bus falls back to in-memory mode on Vercel.

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
│   ├── events/         Event bus (Redis Streams or in-memory fallback)
│   ├── mcp-server/     MCP server with 18+ tools
│   └── cli/            CLI entry point (npx headless-crm start)
├── scripts/            Provisioning scripts
├── docker-compose.yml  PostgreSQL + optional Redis
├── Dockerfile          Multi-arch Docker image
├── vercel.json         Vercel deployment config
├── turbo.json          Turborepo pipeline config
└── package.json        Workspace root
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

---

## MCP Integration

AI agents connect via the Model Context Protocol. The server exposes 18+ tools:

| Tool | Description | Write |
|------|-------------|-------|
| `crm_query` | Query any collection with filters, sort, pagination | No |
| `crm_get` | Retrieve a single record by ID | No |
| `crm_search` | Semantic and keyword search across collections | No |
| `crm_schema` | Retrieve data model, fields, types, relationships | No |
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

**Via Admin API Key (bootstrap):**

```bash
curl -X POST http://localhost:3001/api/agents/provision \
  -H "X-Admin-Key: <your-admin-key>" \
  -H "Content-Type: application/json" \
  -d '{"name": "my-agent", "role": "operator"}'
```

**Via Settings UI:** Navigate to Settings in the dashboard to provision agents with auto-generated API keys.

---

## REST API

All routes under `/api` require a Bearer token (except health checks and setup status).

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
| **Cases** | | |
| `GET/POST` | `/api/cases` | List / Create (supports `status`, `priority` filters) |
| `GET/PATCH/DELETE` | `/api/cases/:id` | Get / Update / Delete |
| **Pipelines** | | |
| `GET/POST` | `/api/pipelines` | List / Create |
| `GET/PATCH/DELETE` | `/api/pipelines/:id` | Get / Update / Delete |
| **Activities** | | |
| `GET/POST` | `/api/activities` | List / Log (supports `type` filter) |
| **Events** | | |
| `GET` | `/api/events` | Audit trail (supports `limit`, `offset`) |
| **Agents** | | |
| `GET/POST` | `/api/agents` | List / Provision |
| `POST` | `/api/agents/provision` | Bootstrap provision (Admin Key) |
| `POST` | `/api/agents/:id/suspend` | Suspend agent |
| `POST` | `/api/agents/:id/approve` | Approve pending agent |
| `POST` | `/api/agents/:id/reject` | Reject pending agent |
| **Webhooks** | | |
| `GET/POST` | `/api/webhooks` | List / Register |
| `GET/PATCH/DELETE` | `/api/webhooks/:id` | Get / Update / Delete |
| `GET` | `/api/webhooks/:id/deliveries` | Delivery history |
| `POST` | `/api/webhooks/:id/test` | Send test event |
| **Custom Fields** | | |
| `GET/POST` | `/api/custom-fields` | List / Define |
| `GET/PATCH/DELETE` | `/api/custom-fields/:id` | Get / Update / Delete |
| **Approvals** | | |
| `GET` | `/api/approvals` | List approvals (supports `status` filter) |
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
| **Stats** | | |
| `GET` | `/api/stats` | Dashboard counts |
| **MCP** | | |
| `ALL` | `/mcp` | MCP Streamable HTTP transport |
| `GET` | `/.well-known/mcp.json` | MCP discovery document |
| **Docs** | | |
| `GET` | `/api/docs` | OpenAPI 3.1 Scalar UI |

---

## RBAC Roles

| Role | Read | Create/Update | Delete | Manage Schema |
|------|------|---------------|--------|---------------|
| `reader` | Yes | No | No | No |
| `operator` | Yes | Yes | No | No |
| `developer` | Yes | Yes | Yes | Yes |
| `auditor` | Yes (audit-scoped) | No | No | No |

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
```javascript
import { createHmac } from "crypto";

function verifyWebhook(body, signature, secret) {
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  return signature === `sha256=${expected}`;
}
```

Deliveries retry up to 3 times with exponential backoff. Monitor delivery history at `GET /api/webhooks/:id/deliveries`.

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

---

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | (SQLite mode if unset) |
| `DB_PATH` | SQLite file path (when no DATABASE_URL) | `./headless-crm.db` |
| `REDIS_URL` | Redis connection string (optional) | (in-memory fallback) |
| `JWT_SECRET` | Secret for signing agent JWTs | `change-me-in-production` |
| `PORT` | API server port | `3001` |
| `ADMIN_API_KEY` | Admin key for bootstrap provisioning | (none) |
| `CORS_ORIGINS` | Comma-separated allowed origins | `*` |
| `RESEND_API_KEY` | Resend API key for emails (optional) | (email disabled) |
| `EMAIL_FROM` | Sender email address | `crm@headless-crm.dev` |
| `OPENAI_API_KEY` | OpenAI key for embeddings/vector search (optional) | (vector search disabled) |
| `HEADLESS_CRM_TOKEN` | Agent JWT for stdio MCP mode | (none) |
| `NEXT_PUBLIC_API_URL` | API URL for web dashboard | `http://localhost:3001` |

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
| UI components | shadcn/ui + Base UI |
| Styling | Tailwind CSS 4 |
| Email | Resend |
| Embeddings | OpenAI text-embedding-3-small + pgvector |
| Language | TypeScript 5.7 |

---

## Self-Hosting

### Docker Compose

```bash
export JWT_SECRET="your-secure-secret"
export ADMIN_API_KEY="your-admin-key"

# PostgreSQL only (recommended)
docker compose up -d

# With Redis (high-throughput event streaming)
docker compose --profile full up -d
```

### Docker (standalone)

```bash
# Build multi-arch image
docker buildx build --platform linux/amd64,linux/arm64 -t headless-crm .

# Run
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
npm run test         # Run tests
npm run db:generate  # Generate Drizzle migrations
npm run db:migrate   # Apply migrations
npm run db:seed      # Seed demo data
```

---

## License

Headless CRM is licensed under the [GNU Affero General Public License v3.0](LICENSE).

Copyright 2026 Humaie.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and PR guidelines.
