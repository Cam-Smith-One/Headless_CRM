# Headless CRM Self-Host SQLite E2E Audit

Date: 2026-05-05 (Australia/Melbourne)
Repo tested: `Cam-Smith-One/Headless_CRM`, branch `main`
Mode: SQLite self-host, API + web dashboard, human persona, agent persona

## What Was Tested

- Cloned fresh repo into `Headless_CRM/`.
- Ran SQLite setup path:
  - `./scripts/setup-sqlite.sh`
  - `npm run generate:sqlite -w packages/db`
  - `npm run migrate:sqlite -w packages/db`
  - `npm run db:seed`
- Started API with root `.env` loaded.
- Started web dashboard with SQLite env loaded.
- Ran tests and build:
  - `npm test`: passed, 18 tests.
  - `npm run build`: passed after allowing Google Fonts network access.
  - `npm audit --omit=dev`: 8 vulnerabilities, 4 high and 4 moderate.

## E2E Results

### Agent Persona

Agent setup via admin provisioning works when API process has `.env` loaded:

- `POST /api/agents/provision` created an active operator agent.
- Operator agent created a contact through REST.
- Operator agent updated that contact.
- Operator agent delete attempt returned `403 Insufficient permissions`, confirming RBAC for delete.
- `/.well-known/mcp.json` responded and advertised streamable HTTP MCP at `/api/mcp`.

Observed gap: MCP discovery says bearer auth uses "Agent API key", but normal REST flow works with both JWT token and API key. Docs should be explicit about which credential each transport expects.

### Human Persona

Human first-run setup works only after web process receives SQLite env:

- Direct `/setup` created first user `Alex Morgan`.
- Setup created workspace/tenant.
- Dashboard issued session token after setup.
- Human user created a contact in dashboard.
- Human user opened contact detail route and updated contact title.

Observed UX/security gap: unauthenticated `/login` and `/setup` render the full app shell/sidebar, causing protected navigation and background API calls to appear before auth is complete.

## Gaps Found

## Follow-Up Fixes Applied

The following issues from this audit were fixed in the follow-up patch:

- Workspace dev scripts now load the root `.env` without leaking `--env-file` through `NODE_OPTIONS`.
- Web dev forces `PORT=3000` so the API's `PORT=3001` does not move Next.js onto the API port.
- `/api/stats` now uses SQLite-compatible numeric casting when `DATABASE_URL=file:...`.
- Auth routes (`/login`, `/setup`, `/signup`) no longer render the protected app shell/sidebar.
- SQLite database artifacts are ignored by git.
- Web dev/build now run Next.js from the repo root so the root `package-lock.json`
  is detected and the false `yarn@npm@10.9.2` lockfile patch warning is gone.
- `package-lock.json` now includes all `@next/swc-*` optional package entries
  that Next expects for cross-platform installs.

Verified after patch:

- `npm test` passed.
- `npm run build` passed.
- `npm run dev` started web on `:3000` and API on `:3001` from the normal root command.
- `POST /api/agents/provision` works through normal dev env loading.
- `GET /api/stats` returns 200 in SQLite mode.
- Browser check confirmed `/login` has sign-in UI and no protected sidebar.

### P0/P1

1. Dev scripts do not load root `.env`. **Fixed in follow-up patch.**
   - `npm run dev` starts API without `DATABASE_URL`, `ADMIN_API_KEY`, or `JWT_SECRET`.
   - API returned `Admin provisioning is not configured` even though `.env` contained `ADMIN_API_KEY`.
   - Web without env tried default Postgres and failed signup with `database "cameronsmith" does not exist`.
   - Fix: add explicit env loading to API and web dev scripts, or use a root process loader that injects `.env` into all workspaces.

2. SQLite dashboard stats endpoint is not SQLite-compatible. **Fixed in follow-up patch.**
   - `GET /api/stats` fails with `SqliteError: unrecognized token: ":"`.
   - Cause: Postgres cast syntax in `sql<string>\`coalesce(sum(${deals.value}::numeric), 0)\``.
   - Fix: branch by `isSqlite()` and use SQLite-compatible cast, for example `cast(${deals.value} as real)`.

3. Setup status semantics conflict.
   - API `/api/setup/status` returns configured based on `ADMIN_API_KEY`.
   - Web `/api/auth/setup-status` returns `hasUsers`.
   - User can land on `/login` instead of first-run setup in SQLite self-host if relying on the API endpoint.
   - Fix: define one first-run status contract: "has human owner" vs "admin provisioning configured".

### P1/P2

4. Next lockfile patch misdetects package manager. **Fixed in follow-up patch.**
   - Next repeatedly prints `packageManager: "yarn@npm@10.9.2"` even though root has `npm@10.9.2`.
   - It still builds, but logs are noisy and can confuse setup.
   - Fix: web scripts now run Next from the repo root; lockfile includes all SWC optional packages.

5. SQLite setup optional dependency path is brittle. **Partly mitigated by git ignore; still open.**
   - `npm install` skipped `better-sqlite3`, then explicit install was needed.
   - Failed install damaged `package-lock.json` under npm 11 until restored.
   - Fix: make `better-sqlite3` a normal dependency for SQLite-capable package or document `npm install --include=optional`; pin/test npm version.

6. Dashboard empty/loading states mask API errors. **Still open.**
   - Dashboard stats showed em dashes rather than surfacing `/api/stats` 500.
   - Contacts page initially sat on loading until token/API calls completed.
   - Fix: show API error state with endpoint/retry action for operator-facing pages.

### Security / Dependency Findings

7. `npm audit --omit=dev` reports high vulnerabilities:
   - `drizzle-orm <0.45.2`: SQL injection via escaped identifiers.
   - `next`: Server Components DoS advisory in installed range.
   - `path-to-regexp`: ReDoS advisories.
   - `picomatch`: ReDoS/method injection advisories.
   - Moderate: `hono`, `@hono/node-server`, `postcss`, `brace-expansion`.
   - Fix: run non-breaking `npm audit fix`, then plan breaking upgrades for Drizzle/Next with focused regression tests.

8. Default `.env.example` secrets are accepted in dev.
   - Good for local quickstart, unsafe if copied to public deploy.
   - Existing production guards help, but docs should warn SQLite/local users loudly.
   - Fix: setup script should generate random `JWT_SECRET`, `BETTER_AUTH_SECRET`, and `ADMIN_API_KEY`.

## Fix Plan

1. Self-host setup reliability PR
   - Update `apps/api/package.json` dev script to load root `.env`.
   - Update `apps/web/package.json` or root dev runner so Next gets root env.
   - Make `setup-sqlite.sh` verify `better-sqlite3` import after install and fail with a clear command.
   - Acceptance: `./scripts/setup-sqlite.sh && npm run dev` supports signup, API provisioning, dashboard CRUD without manual env injection.

2. SQLite parity PR
   - Fix `/api/stats` Postgres-only cast.
   - Add SQLite integration test for `/api/stats`.
   - Check other raw SQL for `::`, JSONB operators, Postgres-only syntax.
   - Acceptance: dashboard metrics load in SQLite mode.

3. First-run auth UX/security PR
   - Split auth layout from app shell so unauthenticated pages do not render protected sidebar/nav.
   - Consolidate setup status endpoints/naming.
   - Add unauthenticated browser test for `/login`, `/setup`, `/contacts`.
   - Acceptance: no protected nav on auth pages; first user path is obvious.

4. Dependency/security PR
   - Upgrade Hono/path-to-regexp/picomatch/PostCSS where non-breaking.
   - Plan Drizzle and Next upgrades separately if breaking.
   - Add `npm audit --omit=dev` to CI with allowlist only for accepted residuals.

5. E2E coverage PR
   - Add Playwright smoke test: SQLite setup, signup, create/edit contact.
   - Add API smoke test: provision operator, create/update contact, verify delete denied.
   - Add MCP smoke test for discovery and at least one tool call.

## Commands Worth Keeping

```bash
./scripts/setup-sqlite.sh
npm run generate:sqlite -w packages/db
npm run migrate:sqlite -w packages/db
npm run db:seed
npm test
npm audit --omit=dev
npm run build
```
