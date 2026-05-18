# Security Policy

## Supported Versions

We actively maintain the latest release on `main`. Security fixes are backported if the vulnerability is critical and the previous version is less than 3 months old.

| Version | Supported |
|---------|-----------|
| Latest (`main`) | ✅ Active |
| Previous minor | ⚠️ Critical fixes only (≤ 3 months) |
| Older | ❌ Please upgrade |

---

## Reporting a Vulnerability

**Do not file a public GitHub issue for security vulnerabilities.** Public disclosure before a fix is available puts all self-hosted deployments at risk.

### Preferred: GitHub Private Advisory

Open a private security advisory directly on GitHub — only you and the maintainers can see it:

👉 **https://github.com/Cam-Smith-One/Headless_CRM/security/advisories/new**

### Alternative: Email

If you cannot use GitHub advisories, email **support@onezeroten.io** with the subject line `[SECURITY] Headless CRM — <brief description>`.

---

## What to Include

Clear, well-scoped reports get fixed faster. Please include:

- **Reproduction steps** — exact HTTP requests, payloads, or code paths
- **Version / commit SHA** you tested against
- **Affected component(s)** — endpoint, file, service
- **Impact assessment** — what an attacker can do, and under what conditions
- **Suggested severity** — CVSS score or qualitative (critical / high / medium / low)
- **Any proposed fix** — optional but appreciated

---

## Response Timeline

| Milestone | Target |
|-----------|--------|
| **Initial acknowledgement** | Within **2–4 business days** |
| **Triage + severity confirmation** | Within 7 days |
| **Fix for critical / high issues** | Within 14 days of confirmation |
| **Fix for medium / low issues** | Within 30 days of confirmation |
| **Public disclosure** | Coordinated with reporter after fix ships |

We're a small team — we appreciate your patience. If you haven't heard back within 4 business days, please follow up on the advisory thread.

---

## Bug Bounty

We do not currently operate a paid bug bounty program. We give public credit in the CHANGELOG and release notes to reporters who follow responsible disclosure (unless you prefer to remain anonymous).

---

## Scope

### In scope

- Auth bypass, privilege escalation, or RBAC enforcement gaps
- Cross-tenant data exposure (any read/write across tenant boundaries)
- SQL injection, XSS, SSRF, CSRF
- Credential / secret exposure or unsafe defaults in shipped configuration
- MCP transport bypass or agent JWT vulnerabilities
- Webhook HMAC signature bypass
- Unauthenticated denial-of-service reachable from the network

### Out of scope

- Vulnerabilities requiring physical server access
- Volumetric DDoS (handled by the hosting layer)
- Issues in upstream dependencies that don't affect this codebase — please report those to the dependency maintainer directly
- Self-XSS or social-engineering attacks
- The setup wizard returning `{ configured: bool }` without auth — this is intentional (single bit needed for the redirect logic)
- Missing security headers on the development server only

---

## Security Hardening in This Repo

A pre-release security audit closed the following issues (see [CHANGELOG.md](./CHANGELOG.md) for details):

| Severity | Count | Examples |
|----------|-------|---------|
| Critical | 4 | MCP role enforcement, middleware allowlist, tenant FK validation, Resend webhook signing |
| High | 6 | Better Auth secret enforcement, approval self-approval prevention, auditor role, route-level Zod validation |
| Medium / Low | 14 | Setup-status information leak, CORS sanity check, error sanitization (73 catch blocks), inbound webhook rate limiting, Redis-backed rate limiter |

---

## Required Production Environment Variables

The app refuses to start — or rejects requests — if these are missing in production:

| Variable | Required for |
|----------|-------------|
| `DATABASE_URL` | All database operations |
| `JWT_SECRET` | Agent JWT signing and verification |
| `BETTER_AUTH_SECRET` | Human session signing (must be ≥ 32 characters) |
| `ADMIN_API_KEY` | Agent provisioning bootstrap endpoint |
| `RESEND_WEBHOOK_SECRET` | `/webhooks/resend` (returns 501 without this in production) |

Recommended additional variables:

| Variable | Purpose |
|----------|---------|
| `REDIS_URL` | Cross-instance rate-limit counters (Vercel / multi-replica) |
| `CORS_ORIGINS` | Comma-separated allowlist — **never use `*` in production** |

---

## Threat Model

- **Multi-tenant by default.** Every CRM record carries `tenantId`; every service query is scoped to `ctx.tenantId`. FK references are validated to belong to the caller's tenant before any insert or update.
- **Two auth schemes coexist.** Better Auth cookie sessions for human users (web UI) and JWT bearer tokens for AI agents (API + MCP). The `/api/auth/session-token` endpoint bridges the two.
- **Outgoing webhooks are HMAC-SHA256 signed** with a per-webhook secret stored hashed in the DB.
- **Inbound webhooks are tenant-scoped and rate-limited** to 60 requests/minute.
- **MCP tools are role-gated.** Every tool checks `ctx.role` before `execute()`. Schema modifications require the `developer` role.
- **API keys are stored as SHA-256 hashes.** The raw key is returned only once at provisioning time and never stored.
