import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { contacts } from "./contacts";
import { companies } from "./companies";
import { deals } from "./deals";
import { agents } from "./agents";

export const cases = pgTable(
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
    dueAt: timestamp("due_at", { withTimezone: true }),
    slaHours: integer("sla_hours"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    customFields: jsonb("custom_fields").default({}),
    createdByAgentId: text("created_by_agent_id").references(() => agents.id),
    updatedByAgentId: text("updated_by_agent_id").references(() => agents.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cases_tenant_idx").on(table.tenantId),
    index("cases_status_idx").on(table.tenantId, table.status),
    index("cases_contact_idx").on(table.contactId),
    index("cases_company_idx").on(table.companyId),
    index("cases_assigned_agent_idx").on(table.assignedAgentId),
  ]
);
