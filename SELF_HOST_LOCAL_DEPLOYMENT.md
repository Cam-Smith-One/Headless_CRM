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

The SQLite quickstart now defaults uploads to:

- `ATTACHMENTS_STORAGE=disk`
- `ATTACHMENTS_DIR=./storage/attachments`

Back up that directory together with `headless-crm.db` if you want a complete restore point.

To exercise the true first-run owner setup from a fresh database without demo data:

```bash
SEED_DEMO=0 npm run setup:sqlite
npm run selfhost:sqlite
```

If `3000` or `3001` are already in use, set custom ports before starting:

```bash
API_PORT=3201 WEB_PORT=3200 npm run selfhost:sqlite
```

For watch mode instead of production-style local start:

```bash
PORT=3200 NEXT_PUBLIC_API_URL=http://127.0.0.1:3201 npm run dev -w web
PORT=3201 npm run start -w @headless-crm/api
```

Use Postgres instead of SQLite when you have multiple app/API processes, heavy concurrent agent writes, or production workloads where database locking and online backups matter.

## Postgres path

```bash
npm run setup
npm run selfhost:check
npm run build
docker compose up
```

The setup script creates a `.env` and generates strong local values for `JWT_SECRET`, `BETTER_AUTH_SECRET`, and `ADMIN_API_KEY`. Do not reuse these values across environments.

The Postgres migration path now uses the repo-local migration runner in `packages/db/scripts/migrate-postgres.mjs`. It still reads the Drizzle SQL files in `packages/db/drizzle`, but it also ensures `pgvector` and avoids the flaky generic CLI behavior some operators were hitting on fresh local installs.

For backups:

```bash
npm run postgres:backup
```

For restores:

```bash
npm run postgres:restore -- ./backups/headless-crm-postgres-YYYYMMDD-HHMMSS.dump
```

If you are not using the repo's Docker Compose Postgres service, the scripts fall back to `DATABASE_URL` plus local `pg_dump` and `pg_restore`.

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

## Smoke and E2E tests

With the API running and `.env` loaded:

```bash
npm run test:selfhost
```

For browser E2E:

```bash
npx playwright install chromium
npm run test:e2e
```

The Playwright suite always checks public login and MCP discovery. It runs the agent persona when `ADMIN_API_KEY` is available. It runs first-run setup only on an empty database. It runs logged-in human contact CRUD when `E2E_EMAIL` and `E2E_PASSWORD` are set.

## SQLite backup and restore

```bash
npm run sqlite:backup
npm run sqlite:restore -- ./backups/headless-crm-YYYYMMDD-HHMMSS.db
```

Stop write-heavy agent jobs before restoring. Backups copy the main SQLite file and WAL/SHM sidecars when present.
If you use disk-backed attachments, copy the attachment directory at the same time.

## Postgres backup and restore notes

- Prefer a backup immediately before upgrades.
- Pause write-heavy jobs before restore validation.
- For managed providers, provider-native snapshots are still the safest first line of defense.
- The included scripts are aimed at self-hosted and local operator workflows.
- If attachments are disk-backed, snapshot or rsync the attachment directory together with the database backup.

## Production safety checks

Production mode refuses public default secrets:

- `JWT_SECRET`
- `BETTER_AUTH_SECRET`
- `ADMIN_API_KEY`

Use explicit `CORS_ORIGINS`; never use `*` for a team deployment.

## Known follow-up work

- Expand browser E2E to cover member removal and key rotation UI.
- Add managed-provider specific Postgres backup/restore notes alongside the local scripts.
- The next self-host UX frontier is bulk import/export directly from the main CRM pages, not just the settings/operator surface.
