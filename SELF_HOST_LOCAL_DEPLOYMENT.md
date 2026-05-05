# Self-Hosting Headless CRM Locally

Use this when a team wants a local CRM that humans use in the browser and agents use through API keys or MCP.

## SQLite path

SQLite is the fastest local path for a solo user, demos, and small teams with light agent writes.

```bash
git clone https://github.com/Cam-Smith-One/Headless_CRM.git
cd Headless_CRM
npm run setup:sqlite
npm run selfhost:check
npm run build
npm run selfhost:sqlite
```

Open `http://localhost:3000/setup`, create the first admin user, then use **Agents** to provision agent keys.

Use Postgres instead of SQLite when you have multiple app/API processes, heavy concurrent agent writes, or production workloads where database locking and online backups matter.

## Postgres path

```bash
npm run setup
npm run selfhost:check
npm run build
docker compose up
```

The setup script creates a `.env` and generates strong local values for `JWT_SECRET`, `BETTER_AUTH_SECRET`, and `ADMIN_API_KEY`. Do not reuse these values across environments.

## Agent setup

1. Sign in as a developer/admin human.
2. Go to **Agents**.
3. Provision an agent with the least role it needs:
   - `reader`: read-only CRM access.
   - `operator`: create and update records.
   - `auditor`: read records and audit trail.
   - `developer`: full access, including delete and management actions.
4. Save the API key immediately. It is shown once.
5. Rotate the key from **Agents** if it is exposed or no longer trusted.
6. Suspend the agent to revoke access without deleting its audit trail.

## Health checks

The API exposes:

- `GET /health` and `GET /api/health`: process is alive.
- `GET /ready` and `GET /api/ready`: process can query the configured database.

## SQLite backup and restore

```bash
npm run sqlite:backup
npm run sqlite:restore -- ./backups/headless-crm-YYYYMMDD-HHMMSS.db
```

Stop write-heavy agent jobs before restoring. Backups copy the main SQLite file and WAL/SHM sidecars when present.

## Production safety checks

Production mode refuses public default secrets:

- `JWT_SECRET`
- `BETTER_AUTH_SECRET`
- `ADMIN_API_KEY`

Use explicit `CORS_ORIGINS`; never use `*` for a team deployment.

## Known follow-up work

- Triage dependency audit findings.
- Move the Next `middleware` file to the newer `proxy` convention.
- Add a browser E2E suite that covers setup, invite accept, agent provisioning, key rotation, contact CRUD, and backup smoke checks.
