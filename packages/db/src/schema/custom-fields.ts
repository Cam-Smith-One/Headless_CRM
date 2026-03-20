import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  integer,
  boolean,
  unique,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const customFieldDefinitions = pgTable(
  "custom_field_definitions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    collection: text("collection").notNull(), // contacts, companies, deals, cases
    fieldName: text("field_name").notNull(),
    fieldType: text("field_type").notNull(), // text, number, boolean, date, select, multiselect, url, email
    required: boolean("required").notNull().default(false),
    options: jsonb("options"), // for select/multiselect: string[]
    defaultValue: jsonb("default_value"),
    description: text("description"),
    displayOrder: integer("display_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cfd_tenant_idx").on(table.tenantId),
    index("cfd_collection_idx").on(table.tenantId, table.collection),
    unique("cfd_tenant_collection_field").on(
      table.tenantId,
      table.collection,
      table.fieldName
    ),
  ]
);
