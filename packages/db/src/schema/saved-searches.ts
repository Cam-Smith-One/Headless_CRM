import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { agents } from "./agents";

export const savedSearches = pgTable(
  "saved_searches",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    /** Collection this search targets: "contacts" | "companies" | "deals" | "cases" | "activities" */
    collection: text("collection").notNull(),
    /** Arbitrary filter object — stored as JSONB, interpreted by the query layer */
    filters: jsonb("filters").notNull().default({}),
    createdByAgentId: text("created_by_agent_id").references(() => agents.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("saved_searches_tenant_idx").on(table.tenantId),
    index("saved_searches_collection_idx").on(table.tenantId, table.collection),
  ]
);
