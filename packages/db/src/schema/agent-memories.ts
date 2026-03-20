import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  real,
  integer,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { agents } from "./agents";

export const agentMemories = pgTable(
  "agent_memories",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id),
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    content: text("content").notNull(),
    confidence: real("confidence").notNull().default(0.5),
    ttlSeconds: integer("ttl_seconds"),
    promotedAt: timestamp("promoted_at", { withTimezone: true }),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("agent_memories_tenant_idx").on(table.tenantId),
    index("agent_memories_agent_idx").on(table.agentId),
    index("agent_memories_subject_idx").on(
      table.subjectType,
      table.subjectId
    ),
  ]
);
