# Security Policy

## Reporting a Vulnerability

If you discover a security issue in Headless CRM, please **do not file a
public GitHub issue**. Instead, email the maintainers privately so we can
investigate and ship a fix before public disclosure:

- **Contact:** open a private security advisory on GitHub at
  https://github.com/Cam-Smith-One/Headless_CRM/security/advisories/new
- **Acknowledgement:** within 72 hours.
- **Triage + initial fix target:** within 14 days for critical issues.

Please include, where possible:

- A clear reproduction (steps, payload, environment).
- The version (commit SHA) you tested against.
- Affected endpoints / files / services.
- Your proposed severity classification (CVSS or qualitative).

We're a small team — clear, well-scoped reports get fixed faster.

## Scope

In-scope:

- Auth bypass, privilege escalation, role/RBAC enforcement gaps.
- Cross-tenant data exposure (any leak between tenants in a multi-tenant
  deploy).
- SQL/NoSQL injection, XSS, SSRF, CSRF.
- Secrets exposure, credential leaks, unsafe defaults.
- MCP transport bypass / agent JWT vulnerabilities.
- Webhook signature bypass.
- DoS that's reachable without authentication.

Out of scope:

- Issues requiring physical access to the server.
- Volumetric DDoS (handled by your hosting layer).
- Vulnerabilities in dependencies that don't affect this codebase's
  usage of them — please report those upstream.
- Self-XSS or social engineering.
- Setup wizard returning `{ configured: bool }` without auth — this is
  intentional (single bit needed for the redirect logic).

## Hardening defaults baked into this repo

A pre-public-release security audit pass closed:

- 4 critical issues (MCP role enforcement, middleware allowlist, tenant
  FK validation, Resend webhook signing).
- 6 high issues (Better Auth secret, approval self-approval, invite
  email binding, auditor role, route-level Zod validation, +1 from a
  follow-up audit).
- 14 medium/low issues (setup-status leak, tags entity, CORS sanity
  check, error sanitization, inbound webhook rate limit, Redis-backed
  rate limiter, setup race, etc.).

See [CHANGELOG.md](./CHANGELOG.md) for the full list.

## Required production env vars

The following MUST be set at runtime in production. The app refuses to
start (or operate certain endpoints) without them:

| Var | Required for |
|-----|--------------|
| `DATABASE_URL` | All endpoints — Postgres connection string |
| `JWT_SECRET` | Agent JWT signing |
| `BETTER_AUTH_SECRET` | Human session signing — must be ≥32 chars |
| `ADMIN_API_KEY` | Bootstrap agent provisioning |
| `RESEND_WEBHOOK_SECRET` | `/webhooks/resend` (501s without it in prod) |

Recommended:

| Var | Recommended for |
|-----|-----------------|
| `REDIS_URL` | Cross-instance rate-limit counters on Vercel |
| `CORS_ORIGINS` | Comma-separated allowlist (NEVER `*` in production) |

## Threat model

- **Multi-tenant by default.** Every CRM record carries `tenantId`;
  every service filters by `ctx.tenantId`. Foreign-key references are
  validated to belong to the caller's tenant before insert.
- **Two auth schemes coexist.** Better Auth cookies for human users
  (web UI) and JWT bearer tokens for AI agents (API + MCP). The
  `/api/auth/session-token` endpoint exchanges a Better Auth cookie
  for an agent JWT scoped to the user's tenant.
- **Outgoing webhooks are HMAC-signed** with a per-webhook secret.
- **Inbound webhooks are tenant-scoped and rate-limited** (60/min).
- **MCP tools are role-gated** — every tool is checked against the
  caller's role before `execute()`. Schema modifications require
  the `developer` role.
