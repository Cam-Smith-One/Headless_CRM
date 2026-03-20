import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const pipelines = pgTable("pipelines", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  name: text("name").notNull(),
  stages: jsonb("stages")
    .notNull()
    .$type<Array<{ name: string; order: number; probability: number }>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
