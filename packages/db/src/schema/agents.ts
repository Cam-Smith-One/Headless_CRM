import {
  pgTable,
  text,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

export const agentTypeEnum = pgEnum("agent_type", [
  "autonomous",
  "supervised",
  "scheduled",
  "reactive",
]);

export const agentStatusEnum = pgEnum("agent_status", [
  "active",
  "suspended",
  "decommissioned",
  "pending_approval",
]);

export const agentRoleEnum = pgEnum("agent_role", [
  "reader",
  "operator",
  "developer",
  "auditor",
]);

export const agents = pgTable("agents", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  name: text("name").notNull(),
  type: agentTypeEnum("type").notNull().default("autonomous"),
  status: agentStatusEnum("status").notNull().default("active"),
  role: agentRoleEnum("role").notNull().default("operator"),
  apiKey: text("api_key").unique(),
  ownerUserId: text("owner_user_id").references(() => users.id, { onDelete: "set null" }),
  policyId: text("policy_id"),
  metadata: jsonb("metadata").default({}),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
