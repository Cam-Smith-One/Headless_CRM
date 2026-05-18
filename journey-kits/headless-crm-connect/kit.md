# Headless CRM — Connect Kit

Give any AI agent a full CRM in under 60 seconds. This kit wires your agent into a running Headless CRM instance via MCP, instantly unlocking 29 typed CRM tools: query contacts, log activities, advance deals, request human approvals, and more — without writing a single line of integration code.

**Owner:** onezeroten  
**Version:** 1.0.0  
**License:** AGPL-3.0  
**Targets:** claude-code, cursor, codex, cline, windsurf, openclaw, generic

---

## What You Get

Once installed your agent can:

- **Read** contacts, companies, deals, cases, activities, pipelines, tags, and custom fields
- **Write** new records, log activities, update deal stages, enrich contact data
- **Search** semantically across contacts and companies (Postgres deployments)
- **Manage** pipeline stages and trigger auto-advance rules
- **Request human approval** before destructive or high-value actions
- **Audit** every mutation through the built-in event trail

All tools are role-gated (reader / operator / developer / auditor). Your agent's API key determines what it can do.

---

## Critical Requirements

### A running Headless CRM instance

You need one of:

| Option | Time | Command |
|--------|------|---------|
| SQLite (local, no Docker) | ~60 sec | `./scripts/setup-sqlite.sh && npm run dev` |
| Docker Compose (Postgres) | ~2 min | `docker compose up -d` |
| Vercel (managed) | ~5 min | See [README deploy button](https://github.com/Cam-Smith-One/Headless_CRM) |
| Hosted (zero ops) | instant | [humaie.com](https://humaie.com) |

### An agent API key

Provision one via the admin endpoint (requires `ADMIN_API_KEY`):

```bash
curl -X POST http://localhost:3001/api/agents/provision \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "my-agent", "role": "operator", "tenantId": "your-tenant-id"}'
```

The response includes `apiKey` — save it, it is never shown again.

### Environment variables

```
HEADLESS_CRM_API_URL=http://localhost:3001   # or your deployed URL
HEADLESS_CRM_TOKEN=hcrm_sk_...              # agent API key from provision step
HEADLESS_CRM_TENANT_ID=tenant_...           # your tenant ID
```

---

## Setup Steps

### 1. Start Headless CRM

```bash
# Fastest path — SQLite, no Docker
git clone https://github.com/Cam-Smith-One/Headless_CRM.git
cd Headless_CRM
./scripts/setup-sqlite.sh
npm run dev
```

API is now live at `http://localhost:3001`. Dashboard at `http://localhost:3000`.

### 2. Provision your agent

```bash
curl -X POST http://localhost:3001/api/agents/provision \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-agent",
    "role": "operator",
    "tenantId": "tenant_demo"
  }'
```

Copy the `apiKey` from the response.

### 3. Configure MCP in your agent

Add to your agent's MCP configuration (path varies by agent):

```json
{
  "mcpServers": {
    "headless-crm": {
      "type": "http",
      "url": "http://localhost:3001/mcp",
      "headers": {
        "Authorization": "Bearer hcrm_sk_YOUR_KEY_HERE"
      }
    }
  }
}
```

For Claude Code, add to `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "headless-crm": {
      "type": "http",
      "url": "http://localhost:3001/mcp",
      "headers": {
        "Authorization": "Bearer hcrm_sk_YOUR_KEY_HERE"
      }
    }
  }
}
```

### 4. Verify the connection

Ask your agent: *"List my CRM contacts"* or *"What deals are in my pipeline?"*

The agent should call `crm_query` and return results. If it errors, check the `Authorization` header and that the CRM server is running.

---

## Available MCP Tools (29 total)

| Category | Tools |
|----------|-------|
| **Contacts** | `crm_query`, `crm_get`, `crm_create`, `crm_update`, `crm_delete`, `crm_search`, `crm_merge`, `crm_enrich` |
| **Companies** | `crm_query`, `crm_get`, `crm_create`, `crm_update`, `crm_delete`, `crm_enrich` |
| **Deals** | `crm_query`, `crm_get`, `crm_create`, `crm_update`, `crm_delete`, `crm_stage_history` |
| **Activities** | `crm_log_activity`, `crm_query` |
| **Cases** | `crm_query`, `crm_get`, `crm_create`, `crm_update` |
| **Pipelines** | `crm_query`, `crm_get`, `crm_create`, `crm_update` |
| **Approvals** | `crm_request_approval`, `crm_query` |
| **Memory** | `crm_remember`, `crm_recall` |
| **Bulk** | `crm_bulk_delete` |
| **Search** | `crm_search` (semantic, Postgres only) |

---

## Agent Roles

Choose the right role when provisioning:

| Role | Can do |
|------|--------|
| `reader` | Query and read only — safe for reporting agents |
| `operator` | Read + write + log activities — best for general-purpose agents |
| `developer` | Full access including schema changes and bulk delete |
| `auditor` | Read + export audit logs — compliance agents |

---

## Failure Patterns and Mitigations

**401 Unauthorized** — API key is missing, malformed, or revoked. Check the `Authorization: Bearer hcrm_sk_...` header is present and the key hasn't been deleted from the Agents dashboard.

**403 Forbidden** — The agent's role doesn't permit the action (e.g. a `reader` trying to create a contact). Provision a new key with a higher role or use the appropriate tool for the role.

**404 on MCP endpoint** — The CRM server isn't running or the URL is wrong. Verify `HEADLESS_CRM_API_URL` and that `npm run dev` is active.

**Tool not found** — The MCP server is connected but the tools aren't registering. Restart your agent's MCP connection after changing the config file.

---

## Constraints

- The MCP transport uses **HTTP streaming** (`/mcp`). Agents that only support stdio MCP must use the CLI bridge: `npx headless-crm start`.
- **Semantic search** (`crm_search`) requires a Postgres deployment with `OPENAI_API_KEY` set. It silently returns empty results in SQLite mode — use `crm_query` with filters instead.
- **Multi-tenant:** each agent key is scoped to one tenant. To give multiple agents access to the same data, provision them all with the same `tenantId`.

---

## Verification

After setup, run this check:

```bash
# Should return your tenant's contacts
curl http://localhost:3001/api/contacts \
  -H "Authorization: Bearer hcrm_sk_YOUR_KEY"
```

A `200` response with a `data` array means the connection is working.
