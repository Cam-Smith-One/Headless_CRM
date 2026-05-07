# Open-Source Local Install Review — 2026-05-07

This review was run from the perspective of an open-source user cloning the repo and trying to self-host Headless CRM locally for both human users and agents.

## Scope

- Source repo reviewed: `Headless_CRM`
- Fresh-clone validation path:
  - clone into `/private/tmp/headless-crm-local-review-20260506-final`
  - `npm install`
  - `npm run setup:sqlite`
  - `npm run selfhost:check`
  - `npm audit --omit=dev`
  - `npm run build`
- Persona coverage:
  - human first-run setup and contact CRUD
  - agent provisioning, contact CRUD, role enforcement, MCP discovery

## What passed

- Fresh SQLite setup completed successfully and generated strong local secrets.
- `npm run selfhost:check` passed in the fresh clone.
- `npm audit --omit=dev` passed with `0 vulnerabilities`.
- `npm test` passed: 18 tests.
- `npm run build` passed.
- Public runtime checks passed:
  - `/` redirected to `/login`
  - `/login` rendered
  - `/setup` rendered
  - `/.well-known/mcp.json` returned the MCP discovery document
  - `/ready` reported `{"status":"ready","database":"sqlite"}`
- Agent persona smoke passed against the fresh clone:
  - provision agent
  - create contact
  - update contact
  - delete denied for operator role with `403`
  - stats endpoint returned `200`

## Issues found during the review

### 1. Web start path did not match the Next standalone build

The app was built with `output: "standalone"` but `npm run start -w web` still used `next start`, which emitted a runtime warning and was the wrong production start path.

Status: fixed in this branch by switching the web start script to a standalone-aware launcher (`scripts/start-web.mjs`).

### 2. Production-style local self-hosting was too rigid on ports

The web app start script forced port `3000`, which made a clean local review brittle whenever another local process was already bound there. The combined `selfhost:sqlite` runner also needed separate API and web port control.

Status: fixed in this branch by:

- removing the hard-coded `PORT=3000` from the web package scripts
- adding `API_PORT` and `WEB_PORT` support to `selfhost:sqlite`
- wiring default `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, and `BETTER_AUTH_URL` from those ports

### 3. SQLite setup script ended with a slightly misleading next step

The script highlighted `npm start` first, even though the main user path for a local self-hosted CRM is the web UI and API stack.

Status: fixed in this branch by promoting `npm run dev` and `npm run selfhost:sqlite` as the primary next steps.

### 4. Branding was still mostly placeholder text

The app shell and auth views had a text-only wordmark and the default favicon path, which made the project feel less finished than the product itself.

Status: fixed in this branch by adding the provided crab logo to:

- app shell header
- sidebar branding
- auth layout
- generated app icon
- README header

## Fresh-clone operator notes

- A genuinely fresh clone now has a good SQLite path for local evaluation and small-team testing.
- The agent story is strong for local use once the first admin user is created and agent keys are provisioned.
- The app is much closer to a credible local open-source deployment than it was at the start of this review.

## Remaining recommendations

### High value

1. Add CI coverage for `npm run test:selfhost` and the Playwright self-host suite.
2. Expand Playwright coverage to include:
   - invite accept flow
   - team role changes
   - key rotation UI
   - backup and restore smoke
3. Add a documented Postgres backup and restore path to match the SQLite operational story.

### Medium value

1. Add a short troubleshooting section for local self-host users:
   - weak secrets in older `.env` files
   - occupied ports
   - `better-sqlite3` native install failures
2. Add a one-command first-run verifier that checks:
   - required env
   - DB readiness
   - auth setup status
   - web and API reachability
3. Add a visible UI path for team onboarding verification, not just agent provisioning.

### Product recommendation

For positioning, the project is now strongest as:

- local SQLite self-host for solo builders and small teams
- agent-first CRM sandbox for MCP/API workflows
- Postgres-backed self-host for more serious team use

That means the docs should keep steering users early toward:

- SQLite for evaluation and lightweight local ops
- Postgres for concurrent team usage and heavier agent workloads

## Bottom line

As of this review, the local open-source install path is credible and materially improved. A new user can clone the repo, stand it up on SQLite, create a human admin, provision an agent, and use both paths successfully.

The biggest remaining work is no longer core functionality. It is operational confidence:

- broader E2E coverage
- clearer troubleshooting
- stronger self-host docs for teams, not just individual builders
