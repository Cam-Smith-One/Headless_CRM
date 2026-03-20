import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  vector,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { companies } from "./companies";
import { agents } from "./agents";

export const contacts = pgTable(
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
    index("contacts_tenant_idx").on(table.tenantId),
    index("contacts_company_idx").on(table.companyId),
    index("contacts_email_idx").on(table.tenantId, table.email),
  ]
);
