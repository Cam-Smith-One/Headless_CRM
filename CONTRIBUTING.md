# Contributing to Headless CRM

Thank you for your interest in contributing! We welcome bug reports, feature requests, documentation improvements, and code contributions.

By participating in this project you agree to abide by the [Code of Conduct](./CODE_OF_CONDUCT.md).

---

## Quick Links

- 🐛 [Report a bug](https://github.com/Cam-Smith-One/Headless_CRM/issues/new?template=bug_report.md)
- 💡 [Request a feature](https://github.com/Cam-Smith-One/Headless_CRM/issues/new?template=feature_request.md)
- 🔒 [Report a security issue](./SECURITY.md)
- 📖 [API docs](http://localhost:3001/api/docs) (local) / [README](./README.md)

---

## Before You Start

- **Check existing issues and PRs** — someone may already be working on it.
- **Open an issue first** for non-trivial changes — this saves you time if the direction doesn't fit the roadmap.
- **Security vulnerabilities** must go through the [security disclosure process](./SECURITY.md), not public issues.

---

## Prerequisites

- Node.js 22+
- npm 10+
- Docker (optional — for PostgreSQL + Redis; the SQLite path needs no Docker)

---

## Local Setup

### Option A: SQLite (fastest — no Docker needed)

```bash
git clone https://github.com/Cam-Smith-One/Headless_CRM.git
cd Headless_CRM
./scripts/setup-sqlite.sh   # creates headless-crm.db, migrates, seeds demo data
npm run dev                 # API :3001 · Dashboard :3000
```

### Option B: PostgreSQL (full feature set, including vector search)

```bash
git clone https://github.com/Cam-Smith-One/Headless_CRM.git
cd Headless_CRM
cp .env.example .env
docker compose up -d postgres redis
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

The API runs on `http://localhost:3001`, the web UI on `http://localhost:3000`, and the interactive API docs at `http://localhost:3001/api/docs`.

---

## Project Structure

```
apps/
  api/         Hono REST API + MCP HTTP transport
  web/         Next.js dashboard (shadcn/ui, dark/light)

packages/
  db/          Drizzle ORM schemas, migrations, seed (PostgreSQL + SQLite)
  core/        CRM business logic — services, Zod validation, event emission
  auth/        Agent identity, JWT tokens, RBAC
  auth-web/    Human user auth (Better Auth, cookie sessions, OAuth)
  events/      Redis Streams or in-memory event bus
  mcp-server/  MCP tools and server (stdio + HTTP transport)
  cli/         CLI entry point (npx headless-crm start)
```

---

## How to Add a New Entity

1. **Postgres schema** — Create `packages/db/src/schema/your-entity.ts` (Drizzle `pgTable`), export from `schema/index.ts`
2. **SQLite schema** — Add the matching `sqliteTable` to `packages/db/src/sqlite-schema.ts` (use `text` for timestamps/UUIDs, `integer` for booleans)
3. **DB re-export** — Add `export const yourEntity = active.yourEntity;` to `packages/db/src/index.ts`
4. **Service** — Create `packages/core/src/services/your-entity.ts` with CRUD, Zod validation, and event emission
5. **CRM factory** — Wire into `packages/core/src/crm.ts`
6. **API routes** — Add GET/POST/PATCH/DELETE in `apps/api/src/app.ts`
7. **MCP tools** — Extend `crm_query`, `crm_get`, `crm_create`, `crm_update`, `crm_delete` enums in `packages/mcp-server/src/tools/index.ts`
8. **UI** — Create `apps/web/src/app/your-entity/page.tsx` and add to the sidebar
9. **Migration** — `npm run db:generate && npm run db:migrate`

---

## Code Style

- **TypeScript strict mode** throughout — no `any` without justification
- **Zod** for all input validation at API boundaries
- **Every mutation emits a CRM event** — required for the audit trail
- **Services are framework-agnostic** — no HTTP or MCP concerns in `packages/core`
- **UI uses shadcn/ui** — prefer existing components over new primitives
- **Error sanitization** — all catch blocks must route through the central sanitizer; never let DB column names reach the caller

---

## Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

[optional body]
[optional footer]
```

| Type | Use for |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `chore` | Build, tooling, deps |
| `refactor` | Code change with no feature/fix |
| `test` | Adding or fixing tests |
| `perf` | Performance improvement |

Examples:
```
feat(api): add bulk-delete endpoint for contacts
fix(pipelines): hard-delete archived deals before removing pipeline
docs: update CONTRIBUTING with commit convention
```

---

## Pull Request Process

1. **Branch** from `main` with a descriptive name: `feat/bulk-delete`, `fix/pipeline-fk-error`
2. **Keep PRs focused** — one logical change per PR
3. **Test locally:**
   - `npm run dev` — verify the feature works end-to-end
   - `turbo build` — confirm the whole monorepo compiles
4. **Update docs** if you're adding endpoints, changing schemas, or modifying agent behaviour
5. **Add seed data** for new entities
6. **Write a clear PR description** — what, why, and how to test
7. **Link the related issue** — `Closes #123`

### Review timeline

We aim to review pull requests within **3–5 business days**. If your PR hasn't received a review after 5 days, feel free to leave a comment to bump it.

---

## Reporting Bugs

Use the GitHub issue tracker. Include:

- **Steps to reproduce** — exact commands, request payloads, or UI actions
- **Expected behaviour**
- **Actual behaviour**
- **Environment** — Node version, DB backend (Postgres/SQLite), OS
- **Version / commit SHA**

The more specific you are, the faster we can reproduce and fix it.

---

## Suggesting Features

Open a GitHub issue with the `enhancement` label. Describe:

- The problem you're trying to solve
- Your proposed solution
- Any alternatives you've considered
- Whether you're willing to implement it (helps us prioritise)

---

## SQLite vs PostgreSQL Compatibility

When contributing code that touches the database layer, test both backends if possible. Key rules:

- Use `ilikeCompat` (exported from `@headless-crm/db`) instead of `ilike` for case-insensitive search
- Use `text` columns (not `timestamp`) for date fields in the SQLite schema
- The `file:` prefix in `DATABASE_URL` activates SQLite mode automatically

Postgres-only features (acceptable to skip in SQLite mode):
- pgvector semantic search
- JSONB operator queries (`metadata->>'key'`)

---

## License

By contributing, you agree that your contributions will be licensed under the [AGPL v3 license](./LICENSE).
