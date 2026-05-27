# Troubleshooting

## Setup script says Node.js is too old

Use Node.js 22 or newer. The setup scripts and native dependencies assume the current LTS-era runtime.

## SQLite setup works, but the app will not start

Run:

```bash
npm run selfhost:check
```

That catches weak secrets, missing database files, and dangerous CORS settings before you spend time debugging the wrong thing.

## SQLite setup fails while running the seed step

The seed script runs through `node --import tsx` so it does not need the `tsx` CLI IPC server. If you are on an older checkout and see an error like `listen EPERM ... tsx-*.pipe`, update to the latest version or run:

```bash
node --env-file=../../.env --import tsx src/seed.ts
```

from `packages/db`.

## Login works in dev, but self-hosted auth says "Invalid origin"

Make sure these values line up with the host and ports you are actually using:

- `BETTER_AUTH_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_API_URL`
- `WEB_PORT`
- `API_PORT`

For local production-style startup, the easiest path is:

```bash
API_PORT=3201 WEB_PORT=3200 npm run selfhost:sqlite
```

## Browser loads, but saves fail silently or return 400/401

Check:

1. the browser is using same-origin `/api/*` requests
2. the API is reachable at `/api/ready` without an agent token
3. the session is still valid after any secret rotation

If secrets were rotated, sign out and sign back in.

## Agent requests return 403

Most often this is expected RBAC behavior:

- `reader`: read-only
- `operator`: create/update, no delete
- `auditor`: read + audit trail
- `developer`: full access

If the role is correct, verify the token belongs to the same tenant as the target records.

## First-run setup does not appear

The setup route only appears when the database has no human users. If you want to re-test that path locally:

```bash
rm -f headless-crm.db headless-crm.db-shm headless-crm.db-wal
SEED_DEMO=0 npm run setup:sqlite
npm run selfhost:sqlite
```

Then open `/setup`.

## Playwright E2E is skipping tests

That is usually intentional:

- first-run setup only runs on an empty database
- human CRUD only runs when `E2E_EMAIL` and `E2E_PASSWORD` are set
- agent persona only runs when `ADMIN_API_KEY` is available

## SQLite is behaving strangely under heavy writes

SQLite is the right local/default path, but not the right answer for multi-process or high-write team deployments. Move to Postgres if you have:

- multiple app or API instances
- frequent background jobs
- concurrent agent workers
- large attachment usage

## Postgres backup or restore script cannot find the database

The scripts work in two modes:

1. the repo's Docker Compose `postgres` service is running
2. `DATABASE_URL` is available and local `pg_dump` / `pg_restore` tools are installed

If neither is true, the scripts will fail on purpose.

## Public release hygiene

Before publishing the repo or a release branch, run:

```bash
npm run oss:check
```

That verifies required docs are present and blocks obvious tracked local artifacts such as `.env` files or SQLite database files.
