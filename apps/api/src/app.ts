import { timingSafeEqual, createHash, createHmac } from "crypto";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createCRM, type CRM, type CrmContext } from "@headless-crm/core";
import { createAuthService, type AuthService } from "@headless-crm/auth";
import { createEventBus, type EventBus } from "@headless-crm/events";
import { createMCPServer } from "@headless-crm/mcp-server";
import { getOpenAPISpec } from "./openapi";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import * as schema from "@headless-crm/db";
import { getDb as getCentralDb } from "@headless-crm/db";
// Static imports for drizzle helpers and schema tables that were previously
// `require()`d inline. The package is ESM (`"type": "module"`); require() at
// runtime throws ReferenceError outside of bundler-wrapped contexts.
import { eq, and, desc, gte, sql, isNotNull, count } from "drizzle-orm";
import { z } from "zod";

// Re-bind a few schema tables as bare identifiers so existing route handlers
// that reference them directly (without the `schema.` prefix) keep working.
// These resolve to the active backend's tables via packages/db's conditional
// re-export.
const { crmEvents, agents, attachments } = schema;

// ---------------------------------------------------------------------------
// Route-input schemas — keep alongside the routes that use them.
// Each route POST/PATCH should pass user input through one of these before
// handing it to a service. Reject unknown fields (`.strict()`) so a caller
// can't smuggle privileged fields into a service that uses spread syntax.
// ---------------------------------------------------------------------------
const provisionAgentSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(["autonomous", "supervised", "scheduled", "reactive"]).optional(),
  role: z.enum(["reader", "operator", "developer", "auditor"]),
  ownerUserId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  collections: z.array(z.string()).optional(),
}).strict();

// Admin bootstrap path: same fields as provisionAgentSchema PLUS tenantId
// (because there's no JWT context to derive it from).
const adminProvisionAgentSchema = z.object({
  name: z.string().min(1).max(200),
  tenantId: z.string().min(1).max(200),
  type: z.enum(["autonomous", "supervised", "scheduled", "reactive"]).optional(),
  role: z.enum(["reader", "operator", "developer", "auditor"]).optional(),
  ownerUserId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

const inboundWebhookSchema = z.object({
  source: z.string().min(1).max(200),
  eventType: z.string().min(1).max(200),
  data: z.record(z.string(), z.unknown()).optional(),
}).strict();

const approvalReviewSchema = z.object({
  reviewNote: z.string().max(2000).optional(),
}).strict();

/** Run a Zod schema against a JSON body. Returns parsed data or sends 400. */
async function parseBody<T extends z.ZodTypeAny>(c: any, schema: T): Promise<z.infer<T> | Response> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    return c.json(
      { error: "Validation failed", issues: result.error.issues },
      400,
    );
  }
  return result.data;
}

/**
 * errorResponse — map a thrown error to a sanitized JSON response.
 *
 * Goals:
 *   - 400 for Zod validation
 *   - 404 for "not found" service errors (matched by message)
 *   - 403 for forbidden / self-approval errors
 *   - 500 generic server error otherwise — DOES NOT echo the raw message,
 *     which can leak DB column names, "duplicate key" constraint text, etc.
 *     The full error is logged server-side with a correlation id.
 */
function errorResponse(c: any, e: any) {
  // Zod validation
  if (e?.name === "ZodError" || e?.issues) {
    return c.json({ error: "Validation failed", issues: e.issues ?? e.errors }, 400);
  }
  const msg = String(e?.message ?? e ?? "");
  // Common service-thrown errors
  if (/not found/i.test(msg)) return c.json({ error: msg }, 404);
  if (/cannot approve your own|cannot reject your own|self[- ]approval/i.test(msg)) {
    return c.json({ error: msg }, 403);
  }
  if (/forbidden/i.test(msg)) return c.json({ error: msg }, 403);
  if (/expired|not pending/i.test(msg)) return c.json({ error: msg }, 409);

  // Default: log server-side, return generic to client.
  const correlationId = `err_${Math.random().toString(36).slice(2, 10)}`;
  console.error(`[${correlationId}]`, e);
  return c.json({ error: "Internal server error", correlationId }, 500);
}

// ---------------------------------------------------------------------------
// Rate limiter — Redis-backed when REDIS_URL is set, in-memory fallback otherwise.
//
// In-memory is per-instance, which is fine for self-hosted single-process
// deploys but ineffective on Vercel where each cold start gets a fresh
// counter (effective limit ~ N_instances × advertised limit). Redis gives
// us a shared counter across all instances.
// ---------------------------------------------------------------------------
type LimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

class RateLimiter {
  private windows = new Map<string, { count: number; resetAt: number }>();
  private cleanupTimer: ReturnType<typeof setInterval>;
  private redis: any = null;
  private redisAttempted = false;

  constructor() {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.windows) {
        if (now >= entry.resetAt) this.windows.delete(key);
      }
    }, 60_000);
    if (this.cleanupTimer.unref) this.cleanupTimer.unref();
  }

  private getRedis(): any {
    if (this.redisAttempted) return this.redis;
    this.redisAttempted = true;
    const url = process.env.REDIS_URL;
    if (!url) return null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Redis = require("ioredis");
      this.redis = new Redis(url, {
        // Don't crash the request path on transient Redis failures —
        // we'll fall through to in-memory if Redis is unhealthy.
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      });
      this.redis.on("error", (e: any) => {
        console.warn("[rate-limit] Redis error, falling back to in-memory:", e.message);
      });
    } catch {
      this.redis = null;
    }
    return this.redis;
  }

  /**
   * Returns { allowed, limit, remaining, resetAt (epoch ms) }.
   * Atomic via Redis INCR+EXPIRE when available; per-instance Map otherwise.
   */
  async check(key: string, limit: number, windowMs: number): Promise<LimitResult> {
    const redis = this.getRedis();
    const now = Date.now();
    if (redis) {
      try {
        const windowSec = Math.ceil(windowMs / 1000);
        const redisKey = `rl:${key}`;
        // INCR + (set EXPIRE only on first hit) in a pipeline.
        const pipeline = redis.pipeline();
        pipeline.incr(redisKey);
        pipeline.pttl(redisKey);
        const results = await pipeline.exec();
        const count = Number(results?.[0]?.[1] ?? 0);
        let pttl = Number(results?.[1]?.[1] ?? -1);
        if (pttl < 0) {
          // Key didn't have an expiry yet — set one. -1 means no TTL, -2 missing.
          await redis.expire(redisKey, windowSec);
          pttl = windowMs;
        }
        const resetAt = now + Math.max(0, pttl);
        const allowed = count <= limit;
        const remaining = Math.max(0, limit - count);
        return { allowed, limit, remaining, resetAt };
      } catch {
        // Fall through to in-memory on any Redis failure.
      }
    }

    let entry = this.windows.get(key);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      this.windows.set(key, entry);
    }
    entry.count++;
    const remaining = Math.max(0, limit - entry.count);
    const allowed = entry.count <= limit;
    return { allowed, limit, remaining, resetAt: entry.resetAt };
  }
}

const rateLimiter = new RateLimiter();

const RATE_LIMIT_EXEMPT = new Set([
  "/api/setup/status",
  "/.well-known/mcp.json",
]);

const WINDOW_MS = 60_000; // 1 minute
const AUTHENTICATED_LIMIT = 100;
const UNAUTHENTICATED_LIMIT = 20;

// Lazy service initialization
let _db: any = null;
let _crm: CRM | null = null;
let _auth: AuthService | null = null;
let _events: EventBus | null = null;

function getDb() {
  if (!_db) {
    // Delegate to the central client which auto-detects file: → SQLite,
    // anything else → Postgres. Keeps the local-dev SQLite path real.
    _db = getCentralDb();
  }
  return _db;
}

function getEvents(): EventBus {
  if (!_events) {
    _events = createEventBus(process.env.REDIS_URL);
  }
  return _events;
}

function getCRM(): CRM {
  if (!_crm) {
    _crm = createCRM(getDb(), getEvents());
  }
  return _crm;
}

function getAuth(): AuthService {
  if (!_auth) {
    _auth = createAuthService(getDb());
  }
  return _auth;
}

// ---------------------------------------------------------------------------
// Role-based access control middleware
// ---------------------------------------------------------------------------
function requireRole(...roles: string[]) {
  return async (c: any, next: any) => {
    const ctx = c.get("ctx");
    if (!ctx || !roles.includes(ctx.role)) {
      return c.json({ error: "Insufficient permissions" }, 403);
    }
    await next();
  };
}

const requireWrite = requireRole("operator", "developer");
const requireDelete = requireRole("developer");
const requireManage = requireRole("developer");
// Audit-trail access. Auditor + developer can list events / read agent logs.
// Reader / operator can NOT — keeps the auditor role meaningful and prevents
// agents from seeing each other's actions unless explicitly granted.
const requireAudit = requireRole("auditor", "developer");

// Auth middleware
async function authenticate(c: any, next: any) {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header" }, 401);
  }
  try {
    const ctx = await getAuth().resolveContext(header.slice(7));
    c.set("ctx", ctx);
    await next();
  } catch (e: any) {
    // Log the underlying reason at info level so SQLite mode (or any auth-path
    // schema mismatch) is debuggable. The client still sees a generic 401.
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[auth] resolveContext failed: ${e?.message ?? e}`);
    }
    return c.json({ error: "Invalid or expired token" }, 401);
  }
}

export function createApp() {
  const app = new Hono();

  // Reject CORS_ORIGINS=* in production. Wildcard CORS in a tenant-scoped API
  // means any origin can attempt cookie-bearing requests; coupled with a leaked
  // session cookie this becomes a CSRF surface. Force an explicit allowlist.
  if (process.env.NODE_ENV === "production" && (process.env.CORS_ORIGINS ?? "").includes("*")) {
    throw new Error(
      "CORS_ORIGINS cannot include '*' in production. Set an explicit comma-separated allowlist of origins.",
    );
  }

  app.use("*", cors({
    origin: (process.env.CORS_ORIGINS || "http://localhost:3000").split(","),
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Admin-Key"],
    maxAge: 86400,
  }));
  app.use("*", logger());

  // Rate limiting middleware — after CORS/logger, before auth
  app.use("*", async (c, next) => {
    const path = new URL(c.req.url).pathname;
    if (RATE_LIMIT_EXEMPT.has(path)) {
      await next();
      return;
    }

    // Key authenticated requests by a hash of the full token (unique per credential).
    // Keying by token tail (slice(-16)) was wrong — JWT signatures share common suffixes.
    let key: string;
    let limit: number;
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const tokenHash = createHash("sha256").update(token).digest("hex").slice(0, 32);
      key = `agent:${tokenHash}`;
      limit = AUTHENTICATED_LIMIT;
    } else {
      key = `ip:${c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"}`;
      limit = UNAUTHENTICATED_LIMIT;
    }

    const result = await rateLimiter.check(key, limit, WINDOW_MS);
    const resetEpochSeconds = Math.ceil(result.resetAt / 1000);

    // Set rate limit headers on every response
    c.header("X-RateLimit-Limit", String(result.limit));
    c.header("X-RateLimit-Remaining", String(result.remaining));
    c.header("X-RateLimit-Reset", String(resetEpochSeconds));

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      c.header("Retry-After", String(retryAfter));
      return c.json({ error: "Rate limit exceeded", retryAfter }, 429);
    }

    await next();
  });

  // Health check (both root and /api prefix for Vercel compatibility)
  app.get("/health", (c) => c.json({ status: "ok", version: "0.1.0" }));
  app.get("/api/health", (c) => c.json({ status: "ok", version: "0.1.0" }));

  // Setup status endpoint — no auth required.
  // Returns ONLY whether setup is complete. Previously also leaked
  // `agentCount` (enumeration) and `adminKeySet` (probe for which deploys
  // have admin provisioning enabled). Trimmed to a single boolean.
  app.get("/api/setup/status", async (c) => {
    const adminKeySet = !!process.env.ADMIN_API_KEY;
    return c.json({ configured: adminKeySet });
  });

  // Admin bootstrap endpoint — no JWT required, uses ADMIN_API_KEY
  app.post("/api/agents/provision", async (c) => {
    const adminKey = process.env.ADMIN_API_KEY;
    if (!adminKey) {
      return c.json({ error: "Admin provisioning is not configured" }, 501);
    }
    const provided = c.req.header("X-Admin-Key");
    const isValid = provided && provided.length === adminKey.length && timingSafeEqual(Buffer.from(provided), Buffer.from(adminKey));
    if (!isValid) {
      return c.json({ error: "Invalid or missing admin key" }, 403);
    }
    const parsed = await parseBody(c, adminProvisionAgentSchema);
    if (parsed instanceof Response) return parsed;
    const result = await getAuth().provisionAgent(parsed.tenantId, {
      name: parsed.name,
      type: parsed.type,
      role: parsed.role,
      ownerUserId: parsed.ownerUserId,
      metadata: parsed.metadata,
      // Admin-key access already gates this action. Skip the pending-approval
      // flow for developer agents — otherwise the first developer in a fresh
      // tenant is unapprovable (only developers can approve, self-approval is
      // blocked, no other developers exist → deadlock).
      autoApprove: true,
    });
    return c.json(result, 201);
  });

  // Protected API routes
  const api = new Hono<{ Variables: { ctx: CrmContext } }>();
  api.use("*", authenticate);

  // ---------------------------------------------------------------------------
  // Export endpoints — registered FIRST so static paths are not shadowed by /:id
  // ---------------------------------------------------------------------------
  function recordToCsvRow(record: Record<string, unknown>, headers: string[]): string {
    return headers.map((h) => {
      const val = record[h];
      if (val == null) return "";
      const str = typeof val === "object" ? JSON.stringify(val) : String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(",");
  }

  function toCsv(records: Record<string, unknown>[]): string {
    if (records.length === 0) return "";
    const exclude = new Set(["embedding", "searchVector", "search_vector"]);
    const headers = Object.keys(records[0]).filter((k) => !exclude.has(k));
    const rows = [headers.join(","), ...records.map((r) => recordToCsvRow(r, headers))];
    return rows.join("\n");
  }

  for (const collection of ["contacts", "companies", "deals", "cases"] as const) {
    api.get(`/${collection}/export`, async (c) => {
      try {
        const ctx = c.get("ctx");
        const format = c.req.query("format") || "csv";
        const service = getCRM()[collection];
        const result = await (service as any).query(ctx, { limit: 10000 });
        const data = Array.isArray(result) ? result : result?.data ?? [];
        if (format === "json") return c.json(data);
        const csv = toCsv(data);
        c.header("Content-Type", "text/csv");
        c.header("Content-Disposition", `attachment; filename="${collection}-export.csv"`);
        return c.body(csv || "");
      } catch (e: any) {
        return errorResponse(c, e);
      }
    });
  }

  // Contacts
  api.get("/contacts", async (c) => {
    try {
      const ctx = c.get("ctx");
      const limit = parseInt(c.req.query("limit") || "") || 20;
      const offset = parseInt(c.req.query("offset") || "") || 0;
      const search = c.req.query("search") || undefined;
      const companyId = c.req.query("companyId") || undefined;
      return c.json(await getCRM().contacts.query(ctx, { limit, offset, search, companyId }));
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.get("/contacts/:id", async (c) => {
    try {
      const record = await getCRM().contacts.getById(c.get("ctx"), c.req.param("id"));
      return record ? c.json(record) : c.json({ error: "Not found" }, 404);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.post("/contacts", requireWrite, async (c) => {
    try {
      const record = await getCRM().contacts.create(c.get("ctx"), await c.req.json());
      return c.json(record, 201);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.patch("/contacts/:id", requireWrite, async (c) => {
    try {
      const record = await getCRM().contacts.update(c.get("ctx"), c.req.param("id"), await c.req.json());
      return c.json(record);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.delete("/contacts/:id", requireDelete, async (c) => {
    try {
      const record = await getCRM().contacts.delete(c.get("ctx"), c.req.param("id"));
      return c.json(record);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.post("/contacts/:id/merge", requireWrite, async (c) => {
    try {
      const body = await parseBody(c, z.object({ otherId: z.string().min(1) }).strict());
      if (body instanceof Response) return body;
      const record = await getCRM().contacts.merge(c.get("ctx"), c.req.param("id"), body.otherId);
      return c.json(record);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.post("/contacts/:id/enrich", requireWrite, async (c) => {
    try {
      const body = await parseBody(c, z.object({ data: z.record(z.string(), z.unknown()) }).strict());
      if (body instanceof Response) return body;
      const record = await getCRM().contacts.enrich(c.get("ctx"), c.req.param("id"), body.data);
      return c.json(record);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  // Companies
  api.get("/companies", async (c) => {
    try {
      const ctx = c.get("ctx");
      const limit = parseInt(c.req.query("limit") || "") || 20;
      const offset = parseInt(c.req.query("offset") || "") || 0;
      const search = c.req.query("search") || undefined;
      return c.json(await getCRM().companies.query(ctx, { limit, offset, search }));
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.get("/companies/:id", async (c) => {
    try {
      const record = await getCRM().companies.getById(c.get("ctx"), c.req.param("id"));
      return record ? c.json(record) : c.json({ error: "Not found" }, 404);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.post("/companies", requireWrite, async (c) => {
    try {
      const record = await getCRM().companies.create(c.get("ctx"), await c.req.json());
      return c.json(record, 201);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.patch("/companies/:id", requireWrite, async (c) => {
    try {
      const record = await getCRM().companies.update(c.get("ctx"), c.req.param("id"), await c.req.json());
      return c.json(record);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.delete("/companies/:id", requireDelete, async (c) => {
    try {
      const record = await getCRM().companies.delete(c.get("ctx"), c.req.param("id"));
      return c.json(record);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.post("/companies/:id/enrich", requireWrite, async (c) => {
    try {
      const body = await parseBody(c, z.object({ data: z.record(z.string(), z.unknown()) }).strict());
      if (body instanceof Response) return body;
      const record = await getCRM().companies.enrich(c.get("ctx"), c.req.param("id"), body.data);
      return c.json(record);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  // Deals
  api.get("/deals", async (c) => {
    try {
      const ctx = c.get("ctx");
      const limit = parseInt(c.req.query("limit") || "") || 20;
      const offset = parseInt(c.req.query("offset") || "") || 0;
      const stage = c.req.query("stage") || undefined;
      const pipelineId = c.req.query("pipelineId") || undefined;
      const companyId = c.req.query("companyId") || undefined;
      return c.json(await getCRM().deals.query(ctx, { limit, offset, stage, pipelineId, companyId }));
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.get("/deals/:id", async (c) => {
    try {
      const record = await getCRM().deals.getById(c.get("ctx"), c.req.param("id"));
      return record ? c.json(record) : c.json({ error: "Not found" }, 404);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.post("/deals", requireWrite, async (c) => {
    try {
      const record = await getCRM().deals.create(c.get("ctx"), await c.req.json());
      return c.json(record, 201);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.patch("/deals/:id", requireWrite, async (c) => {
    try {
      const record = await getCRM().deals.update(c.get("ctx"), c.req.param("id"), await c.req.json());
      return c.json(record);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.delete("/deals/:id", requireDelete, async (c) => {
    try {
      const record = await getCRM().deals.delete(c.get("ctx"), c.req.param("id"));
      return c.json(record);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  // Deal-Contact associations
  api.get("/deals/:id/contacts", async (c) => {
    try {
      const contactIds = await getCRM().deals.getContacts(c.get("ctx"), c.req.param("id"));
      return c.json({ contactIds });
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.post("/deals/:id/contacts", requireWrite, async (c) => {
    try {
      const { contactId } = await c.req.json();
      const result = await getCRM().deals.addContact(c.get("ctx"), c.req.param("id"), contactId);
      return c.json(result, 201);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.delete("/deals/:id/contacts/:contactId", requireDelete, async (c) => {
    try {
      const result = await getCRM().deals.removeContact(c.get("ctx"), c.req.param("id"), c.req.param("contactId"));
      return c.json(result);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.get("/deals/:id/stage-history", async (c) => {
    try {
      const ctx = c.get("ctx");
      const dealId = c.req.param("id");
      const rows = await getDb()
        .select()
        .from(crmEvents)
        .where(
          and(
            eq(crmEvents.tenantId, ctx.tenantId),
            eq(crmEvents.recordId, dealId),
            eq(crmEvents.eventType, "deals.stage_changed")
          )
        )
        .orderBy(desc(crmEvents.createdAt));
      return c.json(rows);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  // Pipelines
  api.get("/pipelines", async (c) => {
    try {
      const records = await getCRM().pipelines.list(c.get("ctx"));
      return c.json(records);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.get("/pipelines/:id", async (c) => {
    try {
      const record = await getCRM().pipelines.getById(c.get("ctx"), c.req.param("id"));
      return record ? c.json(record) : c.json({ error: "Not found" }, 404);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.post("/pipelines", requireManage, async (c) => {
    try {
      const record = await getCRM().pipelines.create(c.get("ctx"), await c.req.json());
      return c.json(record, 201);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.patch("/pipelines/:id", requireManage, async (c) => {
    try {
      const record = await getCRM().pipelines.update(c.get("ctx"), c.req.param("id"), await c.req.json());
      return c.json(record);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.delete("/pipelines/:id", requireDelete, async (c) => {
    try {
      const record = await getCRM().pipelines.delete(c.get("ctx"), c.req.param("id"));
      return c.json(record);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });
  // Cases
  api.get("/cases", async (c) => {
    try {
      const ctx = c.get("ctx");
      const limit = parseInt(c.req.query("limit") || "") || 20;
      const offset = parseInt(c.req.query("offset") || "") || 0;
      const search = c.req.query("search") || undefined;
      const status = c.req.query("status") || undefined;
      const priority = c.req.query("priority") || undefined;
      const contactId = c.req.query("contactId") || undefined;
      const companyId = c.req.query("companyId") || undefined;
      return c.json(await getCRM().cases.query(ctx, { limit, offset, search, status, priority, contactId, companyId }));
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.get("/cases/:id", async (c) => {
    try {
      const record = await getCRM().cases.getById(c.get("ctx"), c.req.param("id"));
      return record ? c.json(record) : c.json({ error: "Not found" }, 404);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.post("/cases", requireWrite, async (c) => {
    try {
      const record = await getCRM().cases.create(c.get("ctx"), await c.req.json());
      return c.json(record, 201);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.patch("/cases/:id", requireWrite, async (c) => {
    try {
      const record = await getCRM().cases.update(c.get("ctx"), c.req.param("id"), await c.req.json());
      return c.json(record);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.delete("/cases/:id", requireDelete, async (c) => {
    try {
      const record = await getCRM().cases.delete(c.get("ctx"), c.req.param("id"));
      return c.json(record);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  // ---------------------------------------------------------------------------
  // Import endpoints
  // ---------------------------------------------------------------------------
  for (const collection of ["contacts", "companies", "deals", "cases"] as const) {
    api.post(`/${collection}/import`, requireWrite, async (c) => {
      try {
        const ctx = c.get("ctx");
        const body = await c.req.json();
        const records: any[] = body.records;
        if (!Array.isArray(records)) {
          return c.json({ error: "body.records must be an array" }, 400);
        }

        const service = getCRM()[collection];
        let imported = 0;
        let failed = 0;
        const errors: { index: number; error: string }[] = [];

        for (let i = 0; i < records.length; i++) {
          try {
            let data = { ...records[i] };
            if (collection === "contacts") {
              const nameField = data.fullName || data.name;
              if (nameField && !data.firstName) {
                const parts = String(nameField).trim().split(/\s+/);
                data.firstName = parts[0];
                data.lastName = parts.slice(1).join(" ") || undefined;
                delete data.fullName;
                delete data.name;
              }
            }
            await (service as any).create(ctx, data);
            imported++;
          } catch (err: any) {
            failed++;
            errors.push({ index: i, error: err.message ?? String(err) });
          }
        }

        return c.json({ imported, failed, errors });
      } catch (e: any) {
        return errorResponse(c, e);
      }
    });
  }

  // Bulk delete — DELETE /:collection/bulk with body { ids: string[] }
  for (const collection of ["contacts", "companies", "deals", "cases"] as const) {
    api.delete(`/${collection}/bulk`, requireDelete, async (c) => {
      try {
        const body = await parseBody(c, z.object({ ids: z.array(z.string().min(1)).min(1).max(500) }).strict());
        if (body instanceof Response) return body;
        const ctx = c.get("ctx");
        const service = getCRM()[collection];
        let deleted = 0;
        let failed = 0;
        const errors: { id: string; error: string }[] = [];
        for (const id of body.ids) {
          try {
            await (service as any).delete(ctx, id);
            deleted++;
          } catch (err: any) {
            failed++;
            errors.push({ id, error: err.message ?? String(err) });
          }
        }
        return c.json({ deleted, failed, errors });
      } catch (e: any) {
        return errorResponse(c, e);
      }
    });
  }

  // Saved Searches
  api.get("/saved-searches", async (c) => {
    try {
      const collection = c.req.query("collection") || undefined;
      return c.json(await getCRM().savedSearches.list(c.get("ctx"), collection));
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.get("/saved-searches/:id", async (c) => {
    try {
      const record = await getCRM().savedSearches.getById(c.get("ctx"), c.req.param("id"));
      return record ? c.json(record) : c.json({ error: "Not found" }, 404);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.post("/saved-searches", requireWrite, async (c) => {
    try {
      const record = await getCRM().savedSearches.create(c.get("ctx"), await c.req.json());
      return c.json(record, 201);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.patch("/saved-searches/:id", requireWrite, async (c) => {
    try {
      const record = await getCRM().savedSearches.update(c.get("ctx"), c.req.param("id"), await c.req.json());
      return c.json(record);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.delete("/saved-searches/:id", requireDelete, async (c) => {
    try {
      const result = await getCRM().savedSearches.delete(c.get("ctx"), c.req.param("id"));
      return c.json(result);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  // Emails
  api.post("/emails/send", requireWrite, async (c) => {
    try {
      const result = await getCRM().emails.send(c.get("ctx"), await c.req.json());
      return c.json(result, 201);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.post("/emails/log", requireWrite, async (c) => {
    try {
      const record = await getCRM().emails.log(c.get("ctx"), await c.req.json());
      return c.json(record, 201);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.get("/emails", async (c) => {
    try {
      const { contactId, recordType, recordId } = c.req.query();
      if (contactId) {
        return c.json(await getCRM().emails.getThread(c.get("ctx"), contactId));
      }
      if (recordType && recordId) {
        const rt = recordType as "contact" | "company" | "deal";
        return c.json(await getCRM().emails.getByRecord(c.get("ctx"), rt, recordId));
      }
      return c.json({ error: "Provide contactId or recordType+recordId" }, 400);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  // Activities
  api.get("/activities", async (c) => {
    try {
      const limit = parseInt(c.req.query("limit") || "") || 50;
      const offset = parseInt(c.req.query("offset") || "") || 0;
      const type = c.req.query("type") ?? undefined;
      const result = await getCRM().activities.query(c.get("ctx"), { limit, offset, type });
      return c.json(result);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.get("/activities/:id", async (c) => {
    try {
      const record = await getCRM().activities.getById(c.get("ctx"), c.req.param("id"));
      if (!record) return c.json({ error: "Activity not found" }, 404);
      return c.json(record);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.post("/activities", requireWrite, async (c) => {
    try {
      const record = await getCRM().activities.log(c.get("ctx"), await c.req.json());
      return c.json(record, 201);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  // Events (audit trail)
  api.get("/events", requireAudit, async (c) => {
    try {
      const limit = Math.min(parseInt(c.req.query("limit") || "") || 50, 200);
      const offset = parseInt(c.req.query("offset") || "") || 0;
      const records = await getDb()
        .select()
        .from(crmEvents)
        .where(eq(crmEvents.tenantId, c.get("ctx").tenantId))
        .orderBy(desc(crmEvents.createdAt))
        .limit(limit)
        .offset(offset);
      return c.json(records);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  // Agents management
  api.get("/agents", async (c) => {
    try {
      // Explicitly select non-sensitive columns. Returning the full row
      // would leak `apiKey` (a sha256 hash of the bearer token) and
      // `metadata` may contain internal-only flags. The hashed key in
      // particular is rate-limited as a low-severity exposure today,
      // but there's no reason to ever return it from this endpoint.
      const records = await getDb()
        .select({
          id: agents.id,
          tenantId: agents.tenantId,
          name: agents.name,
          type: agents.type,
          role: agents.role,
          status: agents.status,
          ownerUserId: agents.ownerUserId,
          metadata: agents.metadata,
          lastActiveAt: agents.lastActiveAt,
          createdAt: agents.createdAt,
          updatedAt: agents.updatedAt,
        })
        .from(agents)
        .where(eq(agents.tenantId, c.get("ctx").tenantId));
      return c.json(records);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.post("/agents", requireManage, async (c) => {
    try {
      const parsed = await parseBody(c, provisionAgentSchema);
      if (parsed instanceof Response) return parsed;
      const result = await getAuth().provisionAgent(c.get("ctx").tenantId, parsed);
      return c.json(result, 201);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.post("/agents/:id/suspend", requireManage, async (c) => {
    try {
      const agent = await getAuth().suspendAgent(c.get("ctx").tenantId, c.req.param("id"));
      return c.json(agent);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.post("/agents/:id/approve", requireManage, async (c) => {
    try {
      const agent = await getAuth().activateAgent(c.get("ctx").tenantId, c.req.param("id"));
      return c.json(agent);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.post("/agents/:id/reject", requireManage, async (c) => {
    try {
      const agent = await getAuth().suspendAgent(c.get("ctx").tenantId, c.req.param("id"));
      return c.json(agent);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  // Agent logs — events filtered by agentId. Audit access only.
  api.get("/agents/:id/logs", requireAudit, async (c) => {
    try {
      const agentId = c.req.param("id");
      const tenantId = c.get("ctx").tenantId;
      const limit = Math.min(parseInt(c.req.query("limit") || "") || 50, 200);
      const offset = parseInt(c.req.query("offset") || "") || 0;
      const eventType = c.req.query("eventType");
      const since = c.req.query("since");

      const conditions = [
        eq(crmEvents.tenantId, tenantId),
        eq(crmEvents.agentId, agentId),
      ];
      if (eventType) conditions.push(eq(crmEvents.eventType, eventType));
      if (since) conditions.push(gte(crmEvents.createdAt, new Date(since)));

      const records = await getDb()
        .select()
        .from(crmEvents)
        .where(and(...conditions))
        .orderBy(desc(crmEvents.createdAt))
        .limit(limit)
        .offset(offset);
      return c.json(records);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  // Stats endpoint — aggregated counts for the dashboard
  api.get("/stats", async (c) => {
    try {
    const { contacts, companies, deals, cases, agents, crmEvents } = schema;
    const tenantId = c.get("ctx").tenantId;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      [{ contactsTotal }],
      [{ contactsThisWeek }],
      [{ companiesTotal }],
      [{ companiesThisWeek }],
      [{ dealsTotal }],
      [{ dealsActive }],
      [{ pipelineValue }],
      [{ casesTotal }],
      [{ casesOpen }],
      [{ agentsTotal }],
      [{ agentsActive }],
      [{ eventsTotal }],
      [{ eventsToday }],
    ] = await Promise.all([
      getDb().select({ contactsTotal: count() }).from(contacts).where(and(eq(contacts.tenantId, tenantId), eq(contacts.stateCode, "active"))),
      getDb().select({ contactsThisWeek: count() }).from(contacts).where(and(eq(contacts.tenantId, tenantId), eq(contacts.stateCode, "active"), gte(contacts.createdAt, sevenDaysAgo))),
      getDb().select({ companiesTotal: count() }).from(companies).where(and(eq(companies.tenantId, tenantId), eq(companies.stateCode, "active"))),
      getDb().select({ companiesThisWeek: count() }).from(companies).where(and(eq(companies.tenantId, tenantId), eq(companies.stateCode, "active"), gte(companies.createdAt, sevenDaysAgo))),
      getDb().select({ dealsTotal: count() }).from(deals).where(and(eq(deals.tenantId, tenantId), eq(deals.stateCode, "active"))),
      getDb().select({ dealsActive: count() }).from(deals).where(and(eq(deals.tenantId, tenantId), eq(deals.stateCode, "active"))),
      getDb().select({ pipelineValue: sql<string>`coalesce(sum(cast(${deals.value} as numeric)), 0)` }).from(deals).where(and(eq(deals.tenantId, tenantId), eq(deals.stateCode, "active"))),
      getDb().select({ casesTotal: count() }).from(cases).where(eq(cases.tenantId, tenantId)),
      getDb().select({ casesOpen: count() }).from(cases).where(and(eq(cases.tenantId, tenantId), eq(cases.status, "open"))),
      getDb().select({ agentsTotal: count() }).from(agents).where(eq(agents.tenantId, tenantId)),
      getDb().select({ agentsActive: count() }).from(agents).where(and(eq(agents.tenantId, tenantId), eq(agents.status, "active"))),
      getDb().select({ eventsTotal: count() }).from(crmEvents).where(eq(crmEvents.tenantId, tenantId)),
      getDb().select({ eventsToday: count() }).from(crmEvents).where(and(eq(crmEvents.tenantId, tenantId), gte(crmEvents.createdAt, todayStart))),
    ]);

    return c.json({
      contacts: { total: contactsTotal, thisWeek: contactsThisWeek },
      companies: { total: companiesTotal, thisWeek: companiesThisWeek },
      deals: { total: dealsTotal, active: dealsActive, pipelineValue: Number(pipelineValue) },
      cases: { total: casesTotal, open: casesOpen },
      agents: { total: agentsTotal, active: agentsActive },
      events: { total: eventsTotal, today: eventsToday },
    });
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  // Pipeline Triggers
  api.get("/pipeline-triggers", async (c) => {
    try {
      const { pipelineId } = c.req.query();
      const records = await getCRM().pipelineTriggers.list(c.get("ctx"), pipelineId);
      return c.json(records);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.post("/pipeline-triggers", requireManage, async (c) => {
    try {
      const record = await getCRM().pipelineTriggers.create(c.get("ctx"), await c.req.json());
      return c.json(record, 201);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.get("/pipeline-triggers/:id", async (c) => {
    try {
      const record = await getCRM().pipelineTriggers.getById(c.get("ctx"), c.req.param("id"));
      return record ? c.json(record) : c.json({ error: "Not found" }, 404);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.patch("/pipeline-triggers/:id", requireManage, async (c) => {
    try {
      const record = await getCRM().pipelineTriggers.update(c.get("ctx"), c.req.param("id"), await c.req.json());
      return c.json(record);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.delete("/pipeline-triggers/:id", requireDelete, async (c) => {
    try {
      const record = await getCRM().pipelineTriggers.delete(c.get("ctx"), c.req.param("id"));
      return c.json(record);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  // Tags — categorization labels attached to any record.
  api.get("/tags", async (c) => {
    try {
      const objectType = c.req.query("objectType") ?? undefined;
      const records = await getCRM().tags.list(c.get("ctx"), objectType);
      return c.json(records);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.post("/tags", requireWrite, async (c) => {
    try {
      const body = await c.req.json();
      const record = await getCRM().tags.create(c.get("ctx"), body);
      return c.json(record, 201);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.delete("/tags/:id", requireDelete, async (c) => {
    try {
      const result = await getCRM().tags.delete(c.get("ctx"), c.req.param("id"));
      return c.json(result);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.post("/tags/attach", requireWrite, async (c) => {
    try {
      const body = await c.req.json();
      const result = await getCRM().tags.attach(c.get("ctx"), body);
      return c.json(result);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.post("/tags/detach", requireWrite, async (c) => {
    try {
      const body = await c.req.json();
      const result = await getCRM().tags.detach(c.get("ctx"), body);
      return c.json(result);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.get("/tags/record/:type/:id", async (c) => {
    try {
      const records = await getCRM().tags.listForRecord(
        c.get("ctx"),
        c.req.param("type"),
        c.req.param("id"),
      );
      return c.json(records);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  // Webhooks
  api.get("/webhooks", async (c) => {
    try {
      const records = await getCRM().webhooks.list(c.get("ctx"));
      return c.json(records);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.post("/webhooks", requireWrite, async (c) => {
    try {
      const record = await getCRM().webhooks.register(c.get("ctx"), await c.req.json());
      return c.json(record, 201);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.get("/webhooks/:id", async (c) => {
    try {
      const record = await getCRM().webhooks.getById(c.get("ctx"), c.req.param("id"));
      return record ? c.json(record) : c.json({ error: "Not found" }, 404);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.patch("/webhooks/:id", requireWrite, async (c) => {
    try {
      const record = await getCRM().webhooks.update(c.get("ctx"), c.req.param("id"), await c.req.json());
      return c.json(record);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.delete("/webhooks/:id", requireDelete, async (c) => {
    try {
      const result = await getCRM().webhooks.delete(c.get("ctx"), c.req.param("id"));
      return c.json(result);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.get("/webhooks/:id/deliveries", async (c) => {
    try {
      const limit = parseInt(c.req.query("limit") || "") || 20;
      const offset = parseInt(c.req.query("offset") || "") || 0;
      const status = c.req.query("status") || undefined;
      const records = await getCRM().webhooks.getDeliveries(c.get("ctx"), c.req.param("id"), {
        status,
        limit,
        offset,
      });
      return c.json(records);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.post("/webhooks/:id/test", requireWrite, async (c) => {
    try {
      const webhook = await getCRM().webhooks.getById(c.get("ctx"), c.req.param("id"));
      if (!webhook) return c.json({ error: "Not found" }, 404);
      const testEvent = {
        eventType: "webhook.test",
        recordType: "webhooks" as const,
        recordId: webhook.id,
        tenantId: c.get("ctx").tenantId,
        changes: {},
        metadata: { test: true },
        timestamp: new Date().toISOString(),
      };
      const result = await getCRM().webhooks.deliver(webhook, testEvent);
      return c.json(result);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  // Inbound webhooks - receive data from external systems.
  // Per-tenant rate limit (60/min) so an operator agent can't fan out
  // unbounded inbound events through every subscribed outbound webhook —
  // would otherwise be a self-DoS / abuse vector for third-party endpoints.
  api.post("/webhooks/inbound", requireWrite, async (c) => {
    try {
      const ctx = c.get("ctx");
      const limit = await rateLimiter.check(`inbound:${ctx.tenantId}`, 60, 60_000);
      if (!limit.allowed) {
        c.header("Retry-After", String(Math.ceil((limit.resetAt - Date.now()) / 1000)));
        return c.json(
          { error: "Inbound webhook rate limit exceeded for this tenant (60/min)" },
          429,
        );
      }
      const parsed = await parseBody(c, inboundWebhookSchema);
      if (parsed instanceof Response) return parsed;
      const { source, eventType, data } = parsed;
      // Deliver to all outbound webhooks subscribed to inbound.* events
      const inboundEvent = {
        eventType: `inbound.${eventType}`,
        recordType: (data?.recordType || "external") as any,
        recordId: data?.recordId || source,
        tenantId: ctx.tenantId,
        changes: {},
        metadata: { source, ...data },
        timestamp: new Date().toISOString(),
      };
      const webhooks = await getCRM().webhooks.list(ctx);
      const active = webhooks.filter((w: any) =>
        w.active && w.eventTypes?.some((et: string) =>
          et === `inbound.${eventType}` || et === "inbound.*" || et === "*"
        )
      );
      const results = await Promise.all(
        active.map((w: any) => getCRM().webhooks.deliver(w, inboundEvent).catch((e: any) => ({ error: e.message })))
      );
      return c.json({ received: true, deliveredTo: active.length, results });
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  // Custom Fields
  api.get("/custom-fields", async (c) => {
    try {
      const { collection } = c.req.query();
      const records = await getCRM().customFields.list(c.get("ctx"), collection || undefined);
      return c.json(records);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.post("/custom-fields", requireManage, async (c) => {
    try {
      const record = await getCRM().customFields.define(c.get("ctx"), await c.req.json());
      return c.json(record, 201);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.get("/custom-fields/:id", async (c) => {
    try {
      const record = await getCRM().customFields.getById(c.get("ctx"), c.req.param("id"));
      return record ? c.json(record) : c.json({ error: "Not found" }, 404);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.patch("/custom-fields/:id", requireManage, async (c) => {
    try {
      const record = await getCRM().customFields.update(c.get("ctx"), c.req.param("id"), await c.req.json());
      return c.json(record);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.delete("/custom-fields/:id", requireDelete, async (c) => {
    try {
      const record = await getCRM().customFields.delete(c.get("ctx"), c.req.param("id"));
      return c.json(record);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  // Semantic search
  api.get("/search/semantic", async (c) => {
    try {
      const ctx = c.get("ctx");
      const q = c.req.query("q");
      const collection = c.req.query("collection") as "contacts" | "companies" | undefined;
      const limit = parseInt(c.req.query("limit") || "") || 10;

      if (!q) return c.json({ error: "q parameter is required" }, 400);
      if (!collection || !["contacts", "companies"].includes(collection)) {
        return c.json({ error: "collection must be 'contacts' or 'companies'" }, 400);
      }

      const results = await getCRM().embeddings.semanticSearch(ctx, collection, q, limit);
      return c.json({ data: results });
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  // Batch embedding generation
  api.post("/embeddings/generate", requireWrite, async (c) => {
    try {
      const ctx = c.get("ctx");
      const body = await c.req.json();
      const collection = body.collection as "contacts" | "companies" | undefined;

      if (!collection || !["contacts", "companies"].includes(collection)) {
        return c.json({ error: "collection must be 'contacts' or 'companies'" }, 400);
      }

      const result = await getCRM().embeddings.embedAll(ctx, collection);
      return c.json(result);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  // Approvals
  api.post("/approvals", requireWrite, async (c) => {
    try {
      const body = await parseBody(c, z.object({
        type: z.enum(["agent_provision", "destructive_action", "bulk_operation", "escalation"]),
        title: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
        expiresAt: z.string().datetime().optional(),
      }).strict());
      if (body instanceof Response) return body;
      const record = await getCRM().approvals.request(c.get("ctx"), body);
      return c.json(record, 201);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.get("/approvals", async (c) => {
    try {
      const ctx = c.get("ctx");
      const { status } = c.req.query();
      const records = await getCRM().approvals.list(ctx, { status: status || undefined });
      return c.json(records);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.get("/approvals/pending", async (c) => {
    try {
      const ctx = c.get("ctx");
      const pending = await getCRM().approvals.getPending(ctx);
      return c.json({ count: pending.length, data: pending });
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.get("/approvals/:id", async (c) => {
    try {
      const record = await getCRM().approvals.getById(c.get("ctx"), c.req.param("id"));
      return record ? c.json(record) : c.json({ error: "Not found" }, 404);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.post("/approvals/:id/approve", requireManage, async (c) => {
    try {
      // Allow empty body; reviewNote is optional.
      let body: any = {};
      try { body = await c.req.json(); } catch { /* empty */ }
      const result = approvalReviewSchema.safeParse(body);
      if (!result.success) {
        return c.json({ error: "Validation failed", issues: result.error.issues }, 400);
      }
      const record = await getCRM().approvals.approve(c.get("ctx"), c.req.param("id"), result.data.reviewNote);

      // If this was an agent_provision approval, activate the agent
      if (record.type === "agent_provision" && record.metadata && typeof record.metadata === "object") {
        const meta = record.metadata as Record<string, unknown>;
        if (meta.agentId) {
          await getAuth().activateAgent(record.tenantId, meta.agentId as string);
        }
      }

      return c.json(record);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.post("/approvals/:id/reject", requireManage, async (c) => {
    try {
      let body: any = {};
      try { body = await c.req.json(); } catch { /* empty */ }
      const result = approvalReviewSchema.safeParse(body);
      if (!result.success) {
        return c.json({ error: "Validation failed", issues: result.error.issues }, 400);
      }
      const record = await getCRM().approvals.reject(c.get("ctx"), c.req.param("id"), result.data.reviewNote);

      // If this was an agent_provision approval, suspend the agent
      if (record.type === "agent_provision" && record.metadata && typeof record.metadata === "object") {
        const meta = record.metadata as Record<string, unknown>;
        if (meta.agentId) {
          await getAuth().suspendAgent(record.tenantId, meta.agentId as string);
        }
      }

      return c.json(record);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  // Attachments
  // TODO: Migrate from base64 DB storage to Vercel Blob for production use.
  api.post("/attachments", requireWrite, async (c) => {
    try {
      const ctx = c.get("ctx");
      const body = await c.req.parseBody();
      const file = body["file"];
      const recordType = body["recordType"] as string;
      const recordId = body["recordId"] as string;

      if (!file || !(file instanceof File)) {
        return c.json({ error: "file is required (multipart)" }, 400);
      }
      if (!recordType || !recordId) {
        return c.json({ error: "recordType and recordId are required" }, 400);
      }

      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      const id = crypto.randomUUID();
      const [record] = await getDb().insert(attachments).values({
        id,
        tenantId: ctx.tenantId,
        recordType,
        recordId,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        data: base64,
        uploadedByAgentId: ctx.agentId ?? null,
      }).returning();

      const { data: _data, ...meta } = record;
      return c.json(meta, 201);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.get("/attachments", async (c) => {
    try {
      const ctx = c.get("ctx");
      const recordType = c.req.query("recordType");
      const recordId = c.req.query("recordId");
      if (!recordType || !recordId) {
        return c.json({ error: "recordType and recordId query params required" }, 400);
      }
      const records = await getDb()
        .select({
          id: attachments.id,
          tenantId: attachments.tenantId,
          recordType: attachments.recordType,
          recordId: attachments.recordId,
          filename: attachments.filename,
          url: attachments.url,
          mimeType: attachments.mimeType,
          size: attachments.size,
          uploadedByAgentId: attachments.uploadedByAgentId,
          createdAt: attachments.createdAt,
        })
        .from(attachments)
        .where(
          and(
            eq(attachments.tenantId, ctx.tenantId),
            eq(attachments.recordType, recordType),
            eq(attachments.recordId, recordId),
          )
        );
      return c.json(records);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.get("/attachments/:id/download", async (c) => {
    try {
      const ctx = c.get("ctx");
      const [record] = await getDb()
        .select()
        .from(attachments)
        .where(
          and(
            eq(attachments.tenantId, ctx.tenantId),
            eq(attachments.id, c.req.param("id")),
          )
        );
      if (!record) return c.json({ error: "Not found" }, 404);

      const buffer = Buffer.from(record.data, "base64");
      c.header("Content-Type", record.mimeType);
      c.header("Content-Disposition", `attachment; filename="${record.filename}"`);
      return c.body(buffer);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.delete("/attachments/:id", requireDelete, async (c) => {
    try {
      const ctx = c.get("ctx");
      const [deleted] = await getDb()
        .delete(attachments)
        .where(
          and(
            eq(attachments.tenantId, ctx.tenantId),
            eq(attachments.id, c.req.param("id")),
          )
        )
        .returning({
          id: attachments.id,
          filename: attachments.filename,
        });
      if (!deleted) return c.json({ error: "Not found" }, 404);
      return c.json(deleted);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });


  // Notifications
  api.get("/notifications", async (c) => {
    try {
      const ctx = c.get("ctx");
      const unreadOnly = c.req.query("unreadOnly") === "true";
      const limit = parseInt(c.req.query("limit") || "") || 50;
      const offset = parseInt(c.req.query("offset") || "") || 0;
      return c.json(await getCRM().notifications.list(ctx, { unreadOnly, limit, offset }));
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.get("/notifications/unread-count", async (c) => {
    try {
      const count = await getCRM().notifications.getUnreadCount(c.get("ctx"));
      return c.json({ count });
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.post("/notifications/:id/read", requireWrite, async (c) => {
    try {
      const record = await getCRM().notifications.markRead(c.get("ctx"), c.req.param("id"));
      return record ? c.json(record) : c.json({ error: "Not found" }, 404);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });

  api.post("/notifications/read-all", requireWrite, async (c) => {
    try {
      const result = await getCRM().notifications.markAllRead(c.get("ctx"));
      return c.json(result);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  });
  // ── API Documentation (public, no auth) ──────────────────────────────────
  app.get("/api/docs/openapi.json", (c) => {
    return c.json(getOpenAPISpec());
  });

  app.get("/api/docs", (c) => {
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Headless CRM — API Reference</title>
  <meta name="description" content="Headless CRM API documentation" />
</head>
<body>
  <script id="api-reference" data-url="/api/docs/openapi.json"></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;
    return c.html(html);
  });

  // Public webhook endpoints (NO auth middleware). Registered BEFORE the
  // /api group mount so they don't get shadowed by the auth-gated sub-app.
  // Both paths reach the same handler — Vercel forwards /api/* to Hono,
  // direct deploys can use /webhooks/* root paths.
  app.post("/webhooks/resend", resendWebhookHandler);
  app.post("/api/webhooks/resend", resendWebhookHandler);

  app.route("/api", api);

  // ---------------------------------------------------------------------------
  // Resend email engagement webhook (public, HMAC-verified)
  // Resend sends POST to this endpoint with events like email.opened,
  // email.clicked, email.delivered. We look up the matching deal via
  // the resendId stored in activity metadata and fire pipeline triggers.
  // ---------------------------------------------------------------------------
  // Shared handler for the resend webhook so it can be registered at BOTH
  // `/webhooks/resend` (legacy / direct host access) and `/api/webhooks/resend`
  // (Vercel forwards `/api/*` to the Hono app — without this prefix the route
  // is unreachable in production).
  async function resendWebhookHandler(c: any) {
    try {
      const signingSecret = process.env.RESEND_WEBHOOK_SECRET;
      const isProduction = process.env.NODE_ENV === "production";

      // In production, RESEND_WEBHOOK_SECRET is REQUIRED. Without it, an
      // attacker with a guessed resendId could spoof email events and advance
      // pipelines. Refuse unsigned webhooks in prod outright.
      if (!signingSecret) {
        if (isProduction) {
          return c.json(
            { error: "Webhook signing not configured: set RESEND_WEBHOOK_SECRET" },
            501,
          );
        }
        // Dev/test only: accept unsigned events to make local iteration easier.
        const body = await c.req.json();
        return handleResendEvent(c, body);
      }

      // Verify Resend / Svix signature.
      // Svix uses HMAC-SHA256 of `${msg_id}.${timestamp}.${body}` with the secret
      // (stripped of its `whsec_` prefix). We accept both the strict Svix scheme
      // and the simple HMAC(secret, body) variant Resend documents directly.
      const signature = c.req.header("svix-signature") ?? c.req.header("resend-signature");
      const svixId = c.req.header("svix-id");
      const svixTimestamp = c.req.header("svix-timestamp");
      const rawBody = await c.req.text();
      if (!signature) {
        return c.json({ error: "Missing signature" }, 401);
      }

      // The secret may be prefixed with `whsec_` per Svix convention; strip it.
      const secretBytes = signingSecret.startsWith("whsec_")
        ? Buffer.from(signingSecret.slice("whsec_".length), "base64")
        : Buffer.from(signingSecret, "utf8");

      // Compute Svix-style signature if id+timestamp present, else fall back
      // to plain HMAC(secret, body).
      const candidates: string[] = [];
      if (svixId && svixTimestamp) {
        const toSign = `${svixId}.${svixTimestamp}.${rawBody}`;
        candidates.push(
          "v1," + createHmac("sha256", secretBytes).update(toSign).digest("base64"),
        );
        // Some integrations encode hex; accept that too.
        candidates.push(
          "v1," + createHmac("sha256", secretBytes).update(toSign).digest("hex"),
        );
      }
      candidates.push(
        "v1," + createHmac("sha256", secretBytes).update(rawBody).digest("hex"),
      );
      candidates.push(
        "v1," + createHmac("sha256", secretBytes).update(rawBody).digest("base64"),
      );

      // svix sends multiple signatures in "v1,xxx v1,yyy" format; check any match
      const sigs = signature.split(" ");
      const valid = sigs.some((s: string) =>
        candidates.some((cand: string) => {
          try {
            return (
              s.length === cand.length &&
              timingSafeEqual(Buffer.from(s), Buffer.from(cand))
            );
          } catch {
            return false;
          }
        }),
      );
      if (!valid) {
        return c.json({ error: "Invalid signature" }, 401);
      }
      // Parse body we already read
      const body = JSON.parse(rawBody);
      return handleResendEvent(c, body);
    } catch (e: any) {
      return errorResponse(c, e);
    }
  }

  // (registrations moved to before app.route("/api", api) below)

  async function handleResendEvent(c: any, body: any) {
    // Resend webhook event shape: { type: "email.opened", data: { email_id: "...", ... } }
    const eventType: string = body.type ?? body.event ?? "";
    const resendId: string = body.data?.email_id ?? body.data?.id ?? "";

    if (!eventType || !resendId) {
      return c.json({ received: true, skipped: "missing type or email_id" });
    }

    // Map Resend event types to our trigger event names
    const triggerEventMap: Record<string, string> = {
      "email.opened": "email.opened",
      "email.clicked": "email.clicked",
      "email.delivered": "email.delivered",
      "email.bounced": "email.bounced",
    };
    const triggerEvent = triggerEventMap[eventType];
    if (!triggerEvent) {
      return c.json({ received: true, skipped: `unhandled event type: ${eventType}` });
    }

    // Find activities with this resendId across all tenants. Resend webhooks
    // don't carry tenant info, so we look up by the unique resendId in the
    // activity's metadata. Index this at the SQL layer rather than scanning
    // the full table — `metadata->>'resendId' = $1` uses the JSONB operator
    // and would benefit from a functional index in production.
    const { sql, eq, and, isNotNull } = await import("drizzle-orm");
    const matched = await getDb()
      .select()
      .from(schema.activities)
      .where(
        and(
          isNotNull(schema.activities.dealId),
          sql`${schema.activities.metadata}->>'resendId' = ${resendId}`,
        ),
      )
      .limit(50);

    const advanced: Array<{ dealId: string; tenantId: string; fromStage: string; toStage: string }> = [];
    for (const activity of matched) {
      if (!activity.dealId) continue;
      const ctx = { tenantId: activity.tenantId, agentId: undefined, userId: undefined };
      const result = await getCRM().pipelineTriggers.fireForDeal(ctx, activity.dealId, triggerEvent);
      if (result) advanced.push({ ...result, tenantId: activity.tenantId });
    }

    return c.json({ received: true, triggerEvent, resendId, advanced });
  }

  // ---------------------------------------------------------------------------
  // Pipeline triggers CRUD (authenticated)
  // ---------------------------------------------------------------------------
  // Mounted under /api so they get the auth middleware

  // MCP Streamable HTTP transport (Web Standard API)
  // Each session gets its own transport + MCP server scoped to the authenticated agent
  const mcpTransports = new Map<string, WebStandardStreamableHTTPServerTransport>();

  const MCP_SESSION_TTL = 30 * 60 * 1000; // 30 minutes
  const mcpSessionLastActivity = new Map<string, number>();

  setInterval(() => {
    const now = Date.now();
    for (const [id, lastActivity] of mcpSessionLastActivity) {
      if (now - lastActivity > MCP_SESSION_TTL) {
        const transport = mcpTransports.get(id);
        if (transport) {
          try { transport.close(); } catch {}
        }
        mcpTransports.delete(id);
        mcpSessionLastActivity.delete(id);
      }
    }
  }, 60_000).unref();

  // MCP endpoint — dual-mounted for Docker (/mcp) and Vercel (/api/mcp)
  async function handleMcp(c: any) {
    // Authenticate
    const header = c.req.header("Authorization");
    if (!header?.startsWith("Bearer ")) {
      return c.json({ error: "Missing or invalid Authorization header" }, 401);
    }

    let ctx: CrmContext;
    try {
      ctx = await getAuth().resolveContext(header.slice(7));
    } catch {
      return c.json({ error: "Invalid or expired token" }, 401);
    }

    const sessionId = c.req.header("mcp-session-id");

    // For existing sessions, delegate directly to the transport
    if (sessionId && mcpTransports.has(sessionId)) {
      mcpSessionLastActivity.set(sessionId, Date.now());
      return mcpTransports.get(sessionId)!.handleRequest(c.req.raw);
    }

    // DELETE with unknown session — no-op
    if (c.req.method === "DELETE") {
      if (sessionId) mcpSessionLastActivity.delete(sessionId);
      return new Response(null, { status: 204 });
    }

    // GET without session — invalid
    if (c.req.method === "GET") {
      return c.json({ error: "Invalid or missing session" }, 400);
    }

    // POST without session — initialize new MCP session
    if (c.req.method === "POST") {
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
      });

      const server = createMCPServer({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        crm: getCRM() as any,
        events: getEvents(),
        ctx,
        db: getDb(),
      });

      await server.connect(transport);

      transport.onclose = () => {
        if (transport.sessionId) {
          mcpTransports.delete(transport.sessionId);
          mcpSessionLastActivity.delete(transport.sessionId);
        }
      };

      const response = await transport.handleRequest(c.req.raw);

      // Store after first request establishes the session ID
      if (transport.sessionId) {
        mcpTransports.set(transport.sessionId, transport);
        mcpSessionLastActivity.set(transport.sessionId, Date.now());
      }

      return response;
    }

    return c.json({ error: "Method not allowed" }, 405);
  }

  app.all("/mcp", handleMcp);
  app.all("/api/mcp", handleMcp);

  // MCP discovery endpoint
  const mcpDiscovery = (c: any) => {
    return c.json({
      name: "headless-crm",
      version: "0.1.0",
      description: "Agent-First Headless CRM — MCP-native interface for AI agents",
      transport: {
        type: "streamable-http",
        url: "/api/mcp",
        authentication: {
          type: "bearer",
          description: "Agent API key from POST /api/agents/provision",
        },
      },
      capabilities: {
        tools: true,
        resources: true,
      },
    });
  };
  app.get("/.well-known/mcp.json", mcpDiscovery);
  // Note: /api/.well-known/mcp.json is intentionally NOT registered here —
  // it would be shadowed by the auth-gated /api group. Use /.well-known/mcp.json.

  return app;
}
