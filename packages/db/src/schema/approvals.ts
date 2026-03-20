import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const approvals = pgTable(
  "approvals",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    type: text("type", {
      enum: ["agent_provision", "destructive_action", "bulk_operation", "escalation"],
    }).notNull(),
    status: text("status", {
      enum: ["pending", "approved", "rejected", "expired"],
    })
      .notNull()
      .default("pending"),
    requestedByAgentId: text("requested_by_agent_id"),
    reviewedByUserId: text("reviewed_by_user_id"),
    title: text("title").notNull(),
    description: text("description"),
    metadata: jsonb("metadata").default({}),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("approvals_tenant_id_idx").on(table.tenantId),
    index("approvals_status_idx").on(table.status),
    index("approvals_requested_by_agent_id_idx").on(table.requestedByAgentId),
  ]
);
