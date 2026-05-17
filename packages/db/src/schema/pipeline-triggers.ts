import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
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
 * triggerType values:
 *   email_event    — fires on email.opened / email.clicked / email.delivered / email.replied
 *   field_change   — fires when a deal field equals conditionValue
 *   time_elapsed   — fires when a deal has been in fromStage for >= checkIntervalMinutes
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
    /** Discriminator: "email_event" | "field_change" | "time_elapsed" */
    triggerType: text("trigger_type").notNull().default("email_event"),
    /** For email_event triggers: "email.opened" | "email.clicked" | "email.delivered" | "email.replied" */
    triggerEvent: text("trigger_event"),
    /** For field_change: which deal field to watch (e.g. "stage", "value") */
    conditionField: text("condition_field"),
    /** For field_change: operator — "eq" | "gt" | "lt" | "contains" */
    conditionOperator: text("condition_operator"),
    /** For field_change: value to compare against */
    conditionValue: text("condition_value"),
    /** For time_elapsed: minutes a deal must stay in fromStage before firing */
    checkIntervalMinutes: integer("check_interval_minutes"),
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
