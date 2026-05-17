/**
 * Backend-aware schema export.
 *
 * At module-load time we detect the backend from `DATABASE_URL`:
 *   `file:./foo.db` or `sqlite:...`  → re-export sqlite-schema tables
 *   anything else                     → re-export Postgres schema tables
 *
 * Service code does `import { contacts } from "@headless-crm/db"` and gets
 * the right table object for the active backend, so generated SQL matches
 * the driver. Both schemas are imported so TypeScript can typecheck against
 * either at build time; the runtime check picks one.
 *
 * Things that stay backend-agnostic in service code (Drizzle's tagged
 * template helpers): `eq`, `and`, `or`, `desc`, `asc`, `count`, `like`.
 *
 * Things that DON'T translate cleanly and need helpers:
 *   - `ilike` → use `like(lower(col), lower(val))` via the helper in this
 *     file (`ilikeCompat`).
 *   - JSON paths (`metadata->>'key'`) → use sql template with backend check.
 *
 * Old code that did `import * as schema from "@headless-crm/db"` continues
 * to work via the wildcard re-export below.
 */

import * as pgSchema from "./schema/index";
import * as sqliteSchema from "./sqlite-schema";

const databaseUrl = process.env.DATABASE_URL ?? "";
const _isSqlite = databaseUrl.startsWith("file:") || databaseUrl.startsWith("sqlite:");

// `any` here is intentional: the table types differ between backends (timestamp
// vs text columns, for example). At runtime the driver matches the schema, so
// generated SQL works. Service code uses Drizzle's column-agnostic helpers.
const active: any = _isSqlite ? sqliteSchema : pgSchema;

// ---------------------------------------------------------------------------
// Explicit table re-exports — keep this list in sync with both schema files.
// ---------------------------------------------------------------------------
export const tenants = active.tenants;
export const users = active.users;
export const sessions = active.sessions;
export const accounts = active.accounts;
export const verifications = active.verifications;
export const invites = active.invites;
export const agents = active.agents;
export const agentMemories = active.agentMemories;
export const contacts = active.contacts;
export const companies = active.companies;
export const deals = active.deals;
export const dealContacts = active.dealContacts;
export const pipelines = active.pipelines;
export const pipelineTriggers = active.pipelineTriggers;
export const activities = active.activities;
export const cases = active.cases;
export const crmEvents = active.crmEvents;
export const webhooks = active.webhooks;
export const webhookDeliveries = active.webhookDeliveries;
export const customFieldDefinitions = active.customFieldDefinitions;
export const approvals = active.approvals;
export const notifications = active.notifications;
export const attachments = active.attachments;
export const tags = active.tags;
export const recordTags = active.recordTags;
export const savedSearches = active.savedSearches;

// Postgres-only enums (SQLite uses raw text columns instead). Re-export for
// code that referenced them; on SQLite they'll be undefined and any code
// that actually reads them is Postgres-only anyway.
export const activityTypeEnum = pgSchema.activityTypeEnum;
export const agentTypeEnum = pgSchema.agentTypeEnum;
export const agentStatusEnum = pgSchema.agentStatusEnum;
export const agentRoleEnum = pgSchema.agentRoleEnum;

// Namespaced exports for code that wants either schema explicitly.
export { pgSchema, sqliteSchema };

// Adapter / SQLite client helpers (legacy paths still used by setup script).
export { createSQLiteClient, type SQLiteDatabase } from "./sqlite-client";
export { createDatabase, type DatabaseInstance } from "./adapter";
export { getClient, getDb, isSqlite } from "./client";
export { ilikeCompat } from "./sql-helpers";

export type { InferSelectModel, InferInsertModel } from "drizzle-orm";
