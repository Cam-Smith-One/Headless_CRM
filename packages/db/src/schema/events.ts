import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  serial,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const crmEvents = pgTable(
  "crm_events",
  {
    id: serial("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    eventType: text("event_type").notNull(),
    recordType: text("record_type").notNull(),
    recordId: text("record_id").notNull(),
    agentId: text("agent_id"),
    userId: text("user_id"),
    changes: jsonb("changes").default({}),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("crm_events_tenant_idx").on(table.tenantId),
    index("crm_events_record_idx").on(table.recordType, table.recordId),
    index("crm_events_type_idx").on(table.tenantId, table.eventType),
    index("crm_events_created_idx").on(table.tenantId, table.createdAt),
  ]
);
