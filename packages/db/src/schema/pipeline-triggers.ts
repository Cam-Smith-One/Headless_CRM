import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { pipelines } from "./pipelines";

/**
 * Pipeline auto-advance triggers.
 *
 * When a trigger event fires for a deal currently in `fromStage`,
 * the deal is automatically moved to `toStage`.
 *
 * Supported trigger events:
 *   email.opened   — Resend webhook: email was opened
 *   email.clicked  — Resend webhook: link in email was clicked
 *   email.replied  — inbound email logged against the deal
 *   email.delivered — Resend webhook: email was delivered
 */
export const pipelineTriggers = pgTable(
  "pipeline_triggers",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    pipelineId: text("pipeline_id")
      .notNull()
      .references(() => pipelines.id),
    /** Event that fires the trigger, e.g. "email.opened" */
    triggerEvent: text("trigger_event").notNull(),
    /** Stage the deal must currently be in (null = any stage) */
    fromStage: text("from_stage"),
    /** Stage to advance the deal to */
    toStage: text("to_stage").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("pipeline_triggers_tenant_idx").on(table.tenantId),
    index("pipeline_triggers_pipeline_idx").on(table.pipelineId),
    index("pipeline_triggers_event_idx").on(table.tenantId, table.triggerEvent),
  ]
);
