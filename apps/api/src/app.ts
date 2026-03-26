import { timingSafeEqual } from "crypto";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createCRM, type CRM, type CrmContext } from "@headless-crm/core";
import { createAuthService, type AuthService } from "@headless-crm/auth";
import { createEventBus, type EventBus } from "@headless-crm/events";
import { createMCPServer } from "@headless-crm/mcp-server";
import { getOpenAPISpec } from "./openapi";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@headless-crm/db";

// ---------------------------------------------------------------------------
// In-memory sliding-window rate limiter
// ---------------------------------------------------------------------------
class RateLimiter {
  private windows = new Map<string, { count: number; resetAt: number }>();
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor() {
    // Purge expired entries every 60 s
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.windows) {
        if (now >= entry.resetAt) this.windows.delete(key);
      }
    }, 60_000);
    // Allow the process to exit without waiting for the timer
    if (this.cleanupTimer.unref) this.cleanupTimer.unref();
  }

  /**
   * Returns { allowed, limit, remaining, resetAt (epoch ms) }.
   */
  check(key: string, limit: number, windowMs: number) {
    const now = Date.now();
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
  "/api/.well-known/mcp.json",
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
    const client = postgres(process.env.DATABASE_URL!);
    _db = drizzle(client, { schema });
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
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
}

export function createApp() {
  const app = new Hono();

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

    // Try to extract agentId from JWT for authenticated keying
    let key: string;
    let limit: number;
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const token = authHeader.slice(7);
        key = `agent:${token.slice(-16)}`;
        limit = AUTHENTICATED_LIMIT;
      } catch {
        key = `ip:${c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"}`;
        limit = UNAUTHENTICATED_LIMIT;
      }
    } else {
      key = `ip:${c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"}`;
      limit = UNAUTHENTICATED_LIMIT;
    }

    const result = rateLimiter.check(key, limit, WINDOW_MS);
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

  // Setup status endpoint — no auth required, returns non-sensitive config status
  app.get("/api/setup/status", async (c) => {
    const adminKeySet = !!process.env.ADMIN_API_KEY;
    let agentCount = 0;
    try {
      const { agents } = require("@headless-crm/db");
      const rows = await getDb().select().from(agents);
      agentCount = rows.length;
    } catch {
      // DB may not be available yet
    }
    return c.json({ configured: adminKeySet, agentCount, adminKeySet });
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
    const body = await c.req.json();
    if (!body.name || !body.tenantId) {
      return c.json({ error: "name and tenantId are required" }, 400);
    }
    const result = await getAuth().provisionAgent(body.tenantId, {
      name: body.name,
      type: body.type,
      role: body.role,
    });
    return c.json(result, 201);
  });

  // Protected API routes
  const api = new Hono<{ Variables: { ctx: CrmContext } }>();
  api.use("*", authenticate);

  // Contacts
  api.get("/contacts", async (c) => {
    try {
      const ctx = c.get("ctx");
      const limit = parseInt(c.req.query("limit") || "") || 20;
      const offset = parseInt(c.req.query("offset") || "") || 0;
      const search = c.req.query("search") || undefined;
      return c.json(await getCRM().contacts.query(ctx, { limit, offset, search }));
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.get("/contacts/:id", async (c) => {
    try {
      const record = await getCRM().contacts.getById(c.get("ctx"), c.req.param("id"));
      return record ? c.json(record) : c.json({ error: "Not found" }, 404);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.post("/contacts", requireWrite, async (c) => {
    try {
      const record = await getCRM().contacts.create(c.get("ctx"), await c.req.json());
      return c.json(record, 201);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.patch("/contacts/:id", requireWrite, async (c) => {
    try {
      const record = await getCRM().contacts.update(c.get("ctx"), c.req.param("id"), await c.req.json());
      return c.json(record);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.delete("/contacts/:id", requireDelete, async (c) => {
    try {
      const record = await getCRM().contacts.delete(c.get("ctx"), c.req.param("id"));
      return c.json(record);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
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
      return c.json({ error: e.message }, 500);
    }
  });

  api.get("/companies/:id", async (c) => {
    try {
      const record = await getCRM().companies.getById(c.get("ctx"), c.req.param("id"));
      return record ? c.json(record) : c.json({ error: "Not found" }, 404);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.post("/companies", requireWrite, async (c) => {
    try {
      const record = await getCRM().companies.create(c.get("ctx"), await c.req.json());
      return c.json(record, 201);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.patch("/companies/:id", requireWrite, async (c) => {
    try {
      const record = await getCRM().companies.update(c.get("ctx"), c.req.param("id"), await c.req.json());
      return c.json(record);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.delete("/companies/:id", requireDelete, async (c) => {
    try {
      const record = await getCRM().companies.delete(c.get("ctx"), c.req.param("id"));
      return c.json(record);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
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
      return c.json(await getCRM().deals.query(ctx, { limit, offset, stage, pipelineId }));
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.get("/deals/:id", async (c) => {
    try {
      const record = await getCRM().deals.getById(c.get("ctx"), c.req.param("id"));
      return record ? c.json(record) : c.json({ error: "Not found" }, 404);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.post("/deals", requireWrite, async (c) => {
    try {
      const record = await getCRM().deals.create(c.get("ctx"), await c.req.json());
      return c.json(record, 201);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.patch("/deals/:id", requireWrite, async (c) => {
    try {
      const record = await getCRM().deals.update(c.get("ctx"), c.req.param("id"), await c.req.json());
      return c.json(record);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.delete("/deals/:id", requireDelete, async (c) => {
    try {
      const record = await getCRM().deals.delete(c.get("ctx"), c.req.param("id"));
      return c.json(record);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  // Pipelines
  api.get("/pipelines", async (c) => {
    try {
      const records = await getCRM().pipelines.list(c.get("ctx"));
      return c.json(records);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.get("/pipelines/:id", async (c) => {
    try {
      const record = await getCRM().pipelines.getById(c.get("ctx"), c.req.param("id"));
      return record ? c.json(record) : c.json({ error: "Not found" }, 404);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.post("/pipelines", requireWrite, async (c) => {
    try {
      const record = await getCRM().pipelines.create(c.get("ctx"), await c.req.json());
      return c.json(record, 201);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.patch("/pipelines/:id", requireWrite, async (c) => {
    try {
      const record = await getCRM().pipelines.update(c.get("ctx"), c.req.param("id"), await c.req.json());
      return c.json(record);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.delete("/pipelines/:id", requireDelete, async (c) => {
    try {
      const record = await getCRM().pipelines.delete(c.get("ctx"), c.req.param("id"));
      return c.json(record);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
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
      return c.json(await getCRM().cases.query(ctx, { limit, offset, search, status, priority }));
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.get("/cases/:id", async (c) => {
    try {
      const record = await getCRM().cases.getById(c.get("ctx"), c.req.param("id"));
      return record ? c.json(record) : c.json({ error: "Not found" }, 404);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.post("/cases", requireWrite, async (c) => {
    try {
      const record = await getCRM().cases.create(c.get("ctx"), await c.req.json());
      return c.json(record, 201);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.patch("/cases/:id", requireWrite, async (c) => {
    try {
      const record = await getCRM().cases.update(c.get("ctx"), c.req.param("id"), await c.req.json());
      return c.json(record);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.delete("/cases/:id", requireDelete, async (c) => {
    try {
      const record = await getCRM().cases.delete(c.get("ctx"), c.req.param("id"));
      return c.json(record);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  // ---------------------------------------------------------------------------
  // Export endpoints
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

        if (format === "json") {
          return c.json(data);
        }

        const csv = toCsv(data);
        c.header("Content-Type", "text/csv");
        c.header("Content-Disposition", `attachment; filename="${collection}-export.csv"`);
        return c.body(csv);
      } catch (e: any) {
        return c.json({ error: e.message }, 500);
      }
    });
  }

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
        return c.json({ error: e.message }, 500);
      }
    });
  }

  // Emails
  api.post("/emails/send", requireWrite, async (c) => {
    try {
      const result = await getCRM().emails.send(c.get("ctx"), await c.req.json());
      return c.json(result, 201);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.post("/emails/log", requireWrite, async (c) => {
    try {
      const record = await getCRM().emails.log(c.get("ctx"), await c.req.json());
      return c.json(record, 201);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
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
      return c.json({ error: e.message }, 500);
    }
  });

  // Activities
  api.post("/activities", requireWrite, async (c) => {
    try {
      const record = await getCRM().activities.log(c.get("ctx"), await c.req.json());
      return c.json(record, 201);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  // Events (audit trail)
  api.get("/events", async (c) => {
    try {
      const { desc, eq } = require("drizzle-orm");
      const { crmEvents } = require("@headless-crm/db");
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
      return c.json({ error: e.message }, 500);
    }
  });

  // Agents management
  api.get("/agents", async (c) => {
    try {
      const { eq } = require("drizzle-orm");
      const { agents } = require("@headless-crm/db");
      const records = await getDb().select().from(agents).where(eq(agents.tenantId, c.get("ctx").tenantId));
      return c.json(records);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.post("/agents", requireManage, async (c) => {
    try {
      const result = await getAuth().provisionAgent(c.get("ctx").tenantId, await c.req.json());
      return c.json(result, 201);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.post("/agents/:id/suspend", requireManage, async (c) => {
    try {
      const agent = await getAuth().suspendAgent(c.get("ctx").tenantId, c.req.param("id"));
      return c.json(agent);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.post("/agents/:id/approve", requireManage, async (c) => {
    try {
      const agent = await getAuth().activateAgent(c.get("ctx").tenantId, c.req.param("id"));
      return c.json(agent);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.post("/agents/:id/reject", requireManage, async (c) => {
    try {
      const agent = await getAuth().suspendAgent(c.get("ctx").tenantId, c.req.param("id"));
      return c.json(agent);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  // Agent logs — events filtered by agentId
  api.get("/agents/:id/logs", async (c) => {
    try {
      const { desc, eq, and, gte } = require("drizzle-orm");
      const { crmEvents } = require("@headless-crm/db");
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
      return c.json({ error: e.message }, 500);
    }
  });

  // Stats endpoint — aggregated counts for the dashboard
  api.get("/stats", async (c) => {
    try {
    const { eq, and, gte, sql, count } = require("drizzle-orm");
    const {
      contacts,
      companies,
      deals,
      cases,
      agents,
      crmEvents,
    } = require("@headless-crm/db");
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
      getDb().select({ pipelineValue: sql<string>`coalesce(sum(${deals.value}::numeric), 0)` }).from(deals).where(and(eq(deals.tenantId, tenantId), eq(deals.stateCode, "active"))),
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
      return c.json({ error: e.message }, 500);
    }
  });

  // Webhooks
  api.get("/webhooks", async (c) => {
    try {
      const records = await getCRM().webhooks.list(c.get("ctx"));
      return c.json(records);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.post("/webhooks", requireWrite, async (c) => {
    try {
      const record = await getCRM().webhooks.register(c.get("ctx"), await c.req.json());
      return c.json(record, 201);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.get("/webhooks/:id", async (c) => {
    try {
      const record = await getCRM().webhooks.getById(c.get("ctx"), c.req.param("id"));
      return record ? c.json(record) : c.json({ error: "Not found" }, 404);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.patch("/webhooks/:id", requireWrite, async (c) => {
    try {
      const record = await getCRM().webhooks.update(c.get("ctx"), c.req.param("id"), await c.req.json());
      return c.json(record);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.delete("/webhooks/:id", requireDelete, async (c) => {
    try {
      const result = await getCRM().webhooks.delete(c.get("ctx"), c.req.param("id"));
      return c.json(result);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
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
      return c.json({ error: e.message }, 500);
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
      return c.json({ error: e.message }, 500);
    }
  });

  // Custom Fields
  api.get("/custom-fields", async (c) => {
    try {
      const { collection } = c.req.query();
      const records = await getCRM().customFields.list(c.get("ctx"), collection || undefined);
      return c.json(records);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.post("/custom-fields", requireWrite, async (c) => {
    try {
      const record = await getCRM().customFields.define(c.get("ctx"), await c.req.json());
      return c.json(record, 201);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.get("/custom-fields/:id", async (c) => {
    try {
      const record = await getCRM().customFields.getById(c.get("ctx"), c.req.param("id"));
      return record ? c.json(record) : c.json({ error: "Not found" }, 404);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.patch("/custom-fields/:id", requireWrite, async (c) => {
    try {
      const record = await getCRM().customFields.update(c.get("ctx"), c.req.param("id"), await c.req.json());
      return c.json(record);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.delete("/custom-fields/:id", requireDelete, async (c) => {
    try {
      const record = await getCRM().customFields.delete(c.get("ctx"), c.req.param("id"));
      return c.json(record);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
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
      return c.json({ error: e.message }, 500);
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
      return c.json({ error: e.message }, 500);
    }
  });

  // Approvals
  api.get("/approvals", async (c) => {
    try {
      const ctx = c.get("ctx");
      const { status } = c.req.query();
      const records = await getCRM().approvals.list(ctx, { status: status || undefined });
      return c.json(records);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.get("/approvals/pending", async (c) => {
    try {
      const ctx = c.get("ctx");
      const pending = await getCRM().approvals.getPending(ctx);
      return c.json({ count: pending.length, data: pending });
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.get("/approvals/:id", async (c) => {
    try {
      const record = await getCRM().approvals.getById(c.get("ctx"), c.req.param("id"));
      return record ? c.json(record) : c.json({ error: "Not found" }, 404);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.post("/approvals/:id/approve", requireManage, async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const record = await getCRM().approvals.approve(c.get("ctx"), c.req.param("id"), body.reviewNote);

      // If this was an agent_provision approval, activate the agent
      if (record.type === "agent_provision" && record.metadata && typeof record.metadata === "object") {
        const meta = record.metadata as Record<string, unknown>;
        if (meta.agentId) {
          await getAuth().activateAgent(record.tenantId, meta.agentId as string);
        }
      }

      return c.json(record);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.post("/approvals/:id/reject", requireManage, async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const record = await getCRM().approvals.reject(c.get("ctx"), c.req.param("id"), body.reviewNote);

      // If this was an agent_provision approval, suspend the agent
      if (record.type === "agent_provision" && record.metadata && typeof record.metadata === "object") {
        const meta = record.metadata as Record<string, unknown>;
        if (meta.agentId) {
          await getAuth().suspendAgent(record.tenantId, meta.agentId as string);
        }
      }

      return c.json(record);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
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

      const { attachments } = require("@headless-crm/db");
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
      return c.json({ error: e.message }, 500);
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
      const { eq, and } = require("drizzle-orm");
      const { attachments } = require("@headless-crm/db");
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
      return c.json({ error: e.message }, 500);
    }
  });

  api.get("/attachments/:id/download", async (c) => {
    try {
      const ctx = c.get("ctx");
      const { eq, and } = require("drizzle-orm");
      const { attachments } = require("@headless-crm/db");
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
      return c.json({ error: e.message }, 500);
    }
  });

  api.delete("/attachments/:id", requireDelete, async (c) => {
    try {
      const ctx = c.get("ctx");
      const { eq, and } = require("drizzle-orm");
      const { attachments } = require("@headless-crm/db");
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
      return c.json({ error: e.message }, 500);
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
      return c.json({ error: e.message }, 500);
    }
  });

  api.get("/notifications/unread-count", async (c) => {
    try {
      const count = await getCRM().notifications.getUnreadCount(c.get("ctx"));
      return c.json({ count });
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.post("/notifications/:id/read", requireWrite, async (c) => {
    try {
      const record = await getCRM().notifications.markRead(c.get("ctx"), c.req.param("id"));
      return record ? c.json(record) : c.json({ error: "Not found" }, 404);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  api.post("/notifications/read-all", requireWrite, async (c) => {
    try {
      const result = await getCRM().notifications.markAllRead(c.get("ctx"));
      return c.json(result);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
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

  app.route("/api", api);

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
        crm: getCRM(),
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
  app.get("/api/.well-known/mcp.json", mcpDiscovery);

  return app;
}
