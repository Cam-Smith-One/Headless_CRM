import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  numeric,
  primaryKey,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { companies } from "./companies";
import { contacts } from "./contacts";
import { agents } from "./agents";
import { pipelines } from "./pipelines";

export const deals = pgTable(
  "deals",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    value: numeric("value"),
    currency: text("currency").default("USD"),
    stage: text("stage").notNull(),
    pipelineId: text("pipeline_id")
      .notNull()
      .references(() => pipelines.id),
    companyId: text("company_id").references(() => companies.id),
    closeDate: timestamp("close_date", { withTimezone: true }),
    ownerAgentId: text("owner_agent_id").references(() => agents.id),
    stateCode: text("state_code").notNull().default("active"),
    statusCode: text("status_code"),
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
    index("deals_tenant_idx").on(table.tenantId),
    index("deals_pipeline_idx").on(table.pipelineId),
    index("deals_stage_idx").on(table.tenantId, table.stage),
    index("deals_company_idx").on(table.companyId),
  ]
);

export const dealContacts = pgTable(
  "deal_contacts",
  {
    dealId: text("deal_id")
      .notNull()
      .references(() => deals.id),
    contactId: text("contact_id").notNull().references(() => contacts.id),
    role: text("role"),
  },
  (table) => [
    primaryKey({ columns: [table.dealId, table.contactId] }),
    index("deal_contacts_deal_idx").on(table.dealId),
    index("deal_contacts_contact_idx").on(table.contactId),
  ]
);
