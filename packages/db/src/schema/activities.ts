import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { agents } from "./agents";
import { contacts } from "./contacts";
import { companies } from "./companies";
import { deals } from "./deals";

export const activityTypeEnum = pgEnum("activity_type", [
  "call",
  "email",
  "meeting",
  "note",
  "task",
  "agent_action",
]);

export const activities = pgTable(
  "activities",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    type: activityTypeEnum("type").notNull(),
    subject: text("subject"),
    body: text("body"),
    direction: text("direction"),
    contactId: text("contact_id").references(() => contacts.id),
    companyId: text("company_id").references(() => companies.id),
    dealId: text("deal_id").references(() => deals.id),
    metadata: jsonb("metadata").default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdByAgentId: text("created_by_agent_id").references(() => agents.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("activities_tenant_idx").on(table.tenantId),
    index("activities_contact_idx").on(table.contactId),
    index("activities_company_idx").on(table.companyId),
    index("activities_deal_idx").on(table.dealId),
    index("activities_occurred_idx").on(table.tenantId, table.occurredAt),
  ]
);
