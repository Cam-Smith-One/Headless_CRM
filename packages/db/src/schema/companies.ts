import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  vector,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { agents } from "./agents";

export const companies = pgTable(
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
    parentCompanyId: text("parent_company_id").references((): AnyPgColumn => companies.id),
    stateCode: text("state_code").notNull().default("active"),
    statusCode: text("status_code"),
    customFields: jsonb("custom_fields").default({}),
    embedding: vector("embedding", { dimensions: 1536 }),
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
    index("companies_tenant_idx").on(table.tenantId),
    index("companies_domain_idx").on(table.tenantId, table.domain),
    index("companies_parent_idx").on(table.parentCompanyId),
  ]
);
