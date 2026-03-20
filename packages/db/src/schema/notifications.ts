import {
  pgTable,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    type: text("type", {
      enum: ["info", "warning", "error", "success"],
    }).notNull().default("info"),
    title: text("title").notNull(),
    message: text("message"),
    recordType: text("record_type"),
    recordId: text("record_id"),
    agentId: text("agent_id"),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("notifications_tenant_id_idx").on(table.tenantId),
    index("notifications_tenant_read_idx").on(table.tenantId, table.read),
    index("notifications_created_at_idx").on(table.createdAt),
  ]
);
