import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  serial,
  boolean,
  integer,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { crmEvents } from "./events";

export const webhooks = pgTable(
  "webhooks",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    url: text("url").notNull(),
    secret: text("secret").notNull(),
    eventTypes: jsonb("event_types").notNull().$type<string[]>(),
    active: boolean("active").notNull().default(true),
    description: text("description"),
    createdByAgentId: text("created_by_agent_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("webhooks_tenant_idx").on(table.tenantId),
  ]
);

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: serial("id").primaryKey(),
    webhookId: text("webhook_id")
      .notNull()
      .references(() => webhooks.id, { onDelete: "cascade" }),
    eventId: integer("event_id").references(() => crmEvents.id),
    status: text("status").notNull().default("pending"),
    statusCode: integer("status_code"),
    responseBody: text("response_body"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("webhook_deliveries_webhook_idx").on(table.webhookId),
    index("webhook_deliveries_status_idx").on(table.status),
  ]
);
