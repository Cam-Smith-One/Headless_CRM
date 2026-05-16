/**
 * SQLite-compatible schema for Headless CRM local/embedded mode.
 *
 * Differences from the Postgres schema:
 * - pgEnum → text columns (no native enums in SQLite)
 * - jsonb → text (JSON serialized)
 * - vector (pgvector) → omitted entirely
 * - timestamp → text (ISO 8601 strings; SQLite has no native timestamp type)
 * - serial → integer with autoincrement via primaryKey({ autoIncrement: true })
 * - numeric → text (SQLite has no fixed-precision numeric)
 *
 * TODO: Create a unified schema type so the service layer can work with both
 * Postgres and SQLite schemas without type errors. For now, the column names
 * match so runtime behavior is compatible, but the TypeScript types differ.
 */

import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Tenants
// ---------------------------------------------------------------------------

export const tenants = sqliteTable("tenants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  settings: text("settings", { mode: "json" }).default("{}"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  name: text("name").notNull(),
  type: text("type").notNull().default("autonomous"),
  status: text("status").notNull().default("active"),
  role: text("role").notNull().default("operator"),
  apiKey: text("api_key").unique(),
  ownerUserId: text("owner_user_id").references(() => users.id),
  policyId: text("policy_id"),
  metadata: text("metadata", { mode: "json" }).default("{}"),
  lastActiveAt: text("last_active_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

export const companies = sqliteTable(
  "companies",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    domain: text("domain"),
    industry: text("industry"),
    size: text("size"),
    parentCompanyId: text("parent_company_id"),
    stateCode: text("state_code").notNull().default("active"),
    statusCode: text("status_code"),
    customFields: text("custom_fields", { mode: "json" }).default("{}"),
    // embedding omitted — pgvector not available in SQLite
    createdByAgentId: text("created_by_agent_id").references(() => agents.id),
    updatedByAgentId: text("updated_by_agent_id").references(() => agents.id),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("sqlt_companies_tenant_idx").on(table.tenantId),
    index("sqlt_companies_domain_idx").on(table.tenantId, table.domain),
    index("sqlt_companies_parent_idx").on(table.parentCompanyId),
  ]
);

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export const contacts = sqliteTable(
  "contacts",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    firstName: text("first_name"),
    lastName: text("last_name"),
    email: text("email"),
    phone: text("phone"),
    title: text("title"),
    companyId: text("company_id").references(() => companies.id),
    stateCode: text("state_code").notNull().default("active"),
    statusCode: text("status_code"),
    customFields: text("custom_fields", { mode: "json" }).default("{}"),
    // embedding omitted — pgvector not available in SQLite
    createdByAgentId: text("created_by_agent_id").references(() => agents.id),
    updatedByAgentId: text("updated_by_agent_id").references(() => agents.id),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("sqlt_contacts_tenant_idx").on(table.tenantId),
    index("sqlt_contacts_company_idx").on(table.companyId),
    index("sqlt_contacts_email_idx").on(table.tenantId, table.email),
  ]
);

// ---------------------------------------------------------------------------
// Pipelines
// ---------------------------------------------------------------------------

export const pipelines = sqliteTable("pipelines", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  name: text("name").notNull(),
  stages: text("stages", { mode: "json" }).notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// Pipeline triggers — auto-advance deal stages on email engagement.
// ---------------------------------------------------------------------------
export const pipelineTriggers = sqliteTable(
  "pipeline_triggers",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    pipelineId: text("pipeline_id")
      .notNull()
      .references(() => pipelines.id),
    triggerEvent: text("trigger_event").notNull(),
    fromStage: text("from_stage"),
    toStage: text("to_stage").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("sqlt_pipeline_triggers_tenant_idx").on(table.tenantId),
    index("sqlt_pipeline_triggers_pipeline_idx").on(table.pipelineId),
    index("sqlt_pipeline_triggers_event_idx").on(table.tenantId, table.triggerEvent),
  ],
);

// ---------------------------------------------------------------------------
// Deals
// ---------------------------------------------------------------------------

export const deals = sqliteTable(
  "deals",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    value: text("value"),
    currency: text("currency").default("USD"),
    stage: text("stage").notNull(),
    pipelineId: text("pipeline_id")
      .notNull()
      .references(() => pipelines.id),
    companyId: text("company_id").references(() => companies.id),
    closeDate: text("close_date"),
    ownerAgentId: text("owner_agent_id").references(() => agents.id),
    stateCode: text("state_code").notNull().default("active"),
    statusCode: text("status_code"),
    customFields: text("custom_fields", { mode: "json" }).default("{}"),
    createdByAgentId: text("created_by_agent_id").references(() => agents.id),
    updatedByAgentId: text("updated_by_agent_id").references(() => agents.id),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("sqlt_deals_tenant_idx").on(table.tenantId),
    index("sqlt_deals_pipeline_idx").on(table.pipelineId),
    index("sqlt_deals_stage_idx").on(table.tenantId, table.stage),
    index("sqlt_deals_company_idx").on(table.companyId),
  ]
);

export const dealContacts = sqliteTable(
  "deal_contacts",
  {
    dealId: text("deal_id")
      .notNull()
      .references(() => deals.id),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id),
    role: text("role"),
  },
  (table) => [
    primaryKey({ columns: [table.dealId, table.contactId] }),
    index("sqlt_deal_contacts_deal_idx").on(table.dealId),
    index("sqlt_deal_contacts_contact_idx").on(table.contactId),
  ]
);

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

export const activities = sqliteTable(
  "activities",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    type: text("type", { enum: ["call", "email", "meeting", "note", "task", "agent_action"] }).notNull(),
    subject: text("subject"),
    body: text("body"),
    direction: text("direction"),
    contactId: text("contact_id").references(() => contacts.id),
    companyId: text("company_id").references(() => companies.id),
    dealId: text("deal_id").references(() => deals.id),
    metadata: text("metadata", { mode: "json" }).default("{}"),
    occurredAt: text("occurred_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    createdByAgentId: text("created_by_agent_id").references(() => agents.id),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("sqlt_activities_tenant_idx").on(table.tenantId),
    index("sqlt_activities_contact_idx").on(table.contactId),
    index("sqlt_activities_company_idx").on(table.companyId),
    index("sqlt_activities_deal_idx").on(table.dealId),
    index("sqlt_activities_occurred_idx").on(table.tenantId, table.occurredAt),
  ]
);

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

export const cases = sqliteTable(
  "cases",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("open"),
    priority: text("priority").notNull().default("medium"),
    category: text("category"),
    contactId: text("contact_id").references(() => contacts.id),
    companyId: text("company_id").references(() => companies.id),
    dealId: text("deal_id").references(() => deals.id),
    assignedAgentId: text("assigned_agent_id").references(() => agents.id),
    resolvedAt: text("resolved_at"),
    customFields: text("custom_fields", { mode: "json" }).default("{}"),
    createdByAgentId: text("created_by_agent_id").references(() => agents.id),
    updatedByAgentId: text("updated_by_agent_id").references(() => agents.id),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("sqlt_cases_tenant_idx").on(table.tenantId),
    index("sqlt_cases_status_idx").on(table.tenantId, table.status),
    index("sqlt_cases_contact_idx").on(table.contactId),
    index("sqlt_cases_company_idx").on(table.companyId),
    index("sqlt_cases_assigned_agent_idx").on(table.assignedAgentId),
  ]
);

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export const crmEvents = sqliteTable(
  "crm_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    eventType: text("event_type").notNull(),
    recordType: text("record_type").notNull(),
    recordId: text("record_id").notNull(),
    agentId: text("agent_id"),
    userId: text("user_id"),
    changes: text("changes", { mode: "json" }).default("{}"),
    metadata: text("metadata", { mode: "json" }).default("{}"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("sqlt_crm_events_tenant_idx").on(table.tenantId),
    index("sqlt_crm_events_record_idx").on(table.recordType, table.recordId),
    index("sqlt_crm_events_type_idx").on(table.tenantId, table.eventType),
    index("sqlt_crm_events_created_idx").on(table.tenantId, table.createdAt),
  ]
);

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

export const webhooks = sqliteTable(
  "webhooks",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    url: text("url").notNull(),
    secret: text("secret").notNull(),
    eventTypes: text("event_types", { mode: "json" }).notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    description: text("description"),
    createdByAgentId: text("created_by_agent_id"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [index("sqlt_webhooks_tenant_idx").on(table.tenantId)]
);

export const webhookDeliveries = sqliteTable(
  "webhook_deliveries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    webhookId: text("webhook_id")
      .notNull()
      .references(() => webhooks.id, { onDelete: "cascade" }),
    eventId: integer("event_id").references(() => crmEvents.id),
    status: text("status").notNull().default("pending"),
    statusCode: integer("status_code"),
    responseBody: text("response_body"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    nextRetryAt: text("next_retry_at"),
    lastAttemptAt: text("last_attempt_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("sqlt_webhook_deliveries_webhook_idx").on(table.webhookId),
    index("sqlt_webhook_deliveries_status_idx").on(table.status),
  ]
);

// ---------------------------------------------------------------------------
// Custom Field Definitions
// ---------------------------------------------------------------------------

export const customFieldDefinitions = sqliteTable(
  "custom_field_definitions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    collection: text("collection").notNull(),
    fieldName: text("field_name").notNull(),
    fieldType: text("field_type").notNull(),
    required: integer("required", { mode: "boolean" }).notNull().default(false),
    options: text("options", { mode: "json" }),
    defaultValue: text("default_value", { mode: "json" }),
    description: text("description"),
    displayOrder: integer("display_order").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("sqlt_cfd_tenant_idx").on(table.tenantId),
    index("sqlt_cfd_collection_idx").on(table.tenantId, table.collection),
    uniqueIndex("sqlt_cfd_tenant_collection_field").on(
      table.tenantId,
      table.collection,
      table.fieldName
    ),
  ]
);

// ---------------------------------------------------------------------------
// Approvals
// ---------------------------------------------------------------------------

export const approvals = sqliteTable(
  "approvals",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    type: text("type").notNull(),
    status: text("status").notNull().default("pending"),
    requestedByAgentId: text("requested_by_agent_id"),
    reviewedByUserId: text("reviewed_by_user_id"),
    title: text("title").notNull(),
    description: text("description"),
    metadata: text("metadata", { mode: "json" }).default("{}"),
    expiresAt: text("expires_at"),
    reviewedAt: text("reviewed_at"),
    reviewNote: text("review_note"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("sqlt_approvals_tenant_id_idx").on(table.tenantId),
    index("sqlt_approvals_status_idx").on(table.status),
    index("sqlt_approvals_requested_by_agent_id_idx").on(
      table.requestedByAgentId
    ),
  ]
);

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    type: text("type").notNull().default("info"),
    title: text("title").notNull(),
    message: text("message"),
    recordType: text("record_type"),
    recordId: text("record_id"),
    agentId: text("agent_id"),
    read: integer("read", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("sqlt_notifications_tenant_id_idx").on(table.tenantId),
    index("sqlt_notifications_tenant_read_idx").on(table.tenantId, table.read),
    index("sqlt_notifications_created_at_idx").on(table.createdAt),
  ]
);

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export const attachments = sqliteTable(
  "attachments",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    recordType: text("record_type").notNull(),
    recordId: text("record_id").notNull(),
    filename: text("filename").notNull(),
    url: text("url"),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    data: text("data"),
    uploadedByAgentId: text("uploaded_by_agent_id").references(() => agents.id),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("sqlt_attachments_tenant_idx").on(table.tenantId),
    index("sqlt_attachments_record_idx").on(
      table.tenantId,
      table.recordType,
      table.recordId
    ),
  ]
);

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  name: text("name").notNull(),
  color: text("color"),
  objectType: text("object_type").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const recordTags = sqliteTable(
  "record_tags",
  {
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id),
    recordId: text("record_id").notNull(),
    recordType: text("record_type").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tagId, table.recordId, table.recordType] }),
    index("sqlt_record_tags_tag_idx").on(table.tagId),
    index("sqlt_record_tags_record_idx").on(table.recordId, table.recordType),
  ]
);

// ---------------------------------------------------------------------------
// Agent Memories
// ---------------------------------------------------------------------------

export const agentMemories = sqliteTable(
  "agent_memories",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id),
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    content: text("content").notNull(),
    confidence: real("confidence").notNull().default(0.5),
    ttlSeconds: integer("ttl_seconds"),
    promotedAt: text("promoted_at"),
    metadata: text("metadata", { mode: "json" }).default("{}"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("sqlt_agent_memories_tenant_idx").on(table.tenantId),
    index("sqlt_agent_memories_agent_idx").on(table.agentId),
    index("sqlt_agent_memories_subject_idx").on(
      table.subjectType,
      table.subjectId
    ),
  ]
);

// ---------------------------------------------------------------------------
// Human Users (Better Auth tables)
// ---------------------------------------------------------------------------

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("member"),
  tenantId: text("tenant_id").references(() => tenants.id),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: text("expires_at").notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => users.id),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: text("access_token_expires_at"),
  refreshTokenExpiresAt: text("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const verifications = sqliteTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const invites = sqliteTable("invites", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  role: text("role").notNull().default("member"),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  invitedByUserId: text("invited_by_user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  acceptedAt: text("accepted_at"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});
