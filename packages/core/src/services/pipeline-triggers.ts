import { eq, and } from "drizzle-orm";
import { pipelineTriggers, activities, deals, pipelines } from "@headless-crm/db";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { CrmContext, EventEmitter } from "../types";

export const createTriggerSchema = z.discriminatedUnion("triggerType", [
  z.object({
    triggerType: z.literal("email_event"),
    pipelineId: z.string().min(1),
    triggerEvent: z.enum(["email.opened", "email.clicked", "email.delivered", "email.replied"]),
    fromStage: z.string().nullable().optional(),
    toStage: z.string().min(1),
    active: z.boolean().optional(),
  }),
  z.object({
    triggerType: z.literal("field_change"),
    pipelineId: z.string().min(1),
    conditionField: z.string().min(1),
    conditionOperator: z.enum(["eq", "gt", "lt", "contains"]),
    conditionValue: z.string().min(1),
    fromStage: z.string().nullable().optional(),
    toStage: z.string().min(1),
    active: z.boolean().optional(),
  }),
  z.object({
    triggerType: z.literal("time_elapsed"),
    pipelineId: z.string().min(1),
    fromStage: z.string().min(1),
    toStage: z.string().min(1),
    checkIntervalMinutes: z.number().int().positive(),
    active: z.boolean().optional(),
  }),
]);

export const updateTriggerSchema = z.object({
  triggerType: z.enum(["email_event", "field_change", "time_elapsed"]).optional(),
  triggerEvent: z.enum(["email.opened", "email.clicked", "email.delivered", "email.replied"]).optional(),
  conditionField: z.string().optional(),
  conditionOperator: z.enum(["eq", "gt", "lt", "contains"]).optional(),
  conditionValue: z.string().optional(),
  checkIntervalMinutes: z.number().int().positive().optional(),
  fromStage: z.string().nullable().optional(),
  toStage: z.string().min(1).optional(),
  active: z.boolean().optional(),
});

export type CreateTriggerInput = z.infer<typeof createTriggerSchema>;
export type UpdateTriggerInput = z.infer<typeof updateTriggerSchema>;

export function createPipelineTriggersService(db: any, events: EventEmitter) {
  return {
    async list(ctx: CrmContext, pipelineId?: string) {
      const conditions = [eq(pipelineTriggers.tenantId, ctx.tenantId)];
      if (pipelineId) conditions.push(eq(pipelineTriggers.pipelineId, pipelineId));
      return db.select().from(pipelineTriggers).where(and(...conditions));
    },

    async getById(ctx: CrmContext, id: string) {
      const [record] = await db
        .select()
        .from(pipelineTriggers)
        .where(
          and(
            eq(pipelineTriggers.id, id),
            eq(pipelineTriggers.tenantId, ctx.tenantId)
          )
        );
      return record ?? null;
    },

    async create(ctx: CrmContext, input: CreateTriggerInput) {
      const parsed = createTriggerSchema.parse(input);
      const id = nanoid();
      const [record] = await db
        .insert(pipelineTriggers)
        .values({
          id,
          tenantId: ctx.tenantId,
          pipelineId: parsed.pipelineId,
          triggerType: parsed.triggerType,
          triggerEvent: "triggerEvent" in parsed ? parsed.triggerEvent : null,
          conditionField: "conditionField" in parsed ? parsed.conditionField : null,
          conditionOperator: "conditionOperator" in parsed ? parsed.conditionOperator : null,
          conditionValue: "conditionValue" in parsed ? parsed.conditionValue : null,
          checkIntervalMinutes: "checkIntervalMinutes" in parsed ? parsed.checkIntervalMinutes : null,
          fromStage: parsed.fromStage ?? null,
          toStage: parsed.toStage,
          active: parsed.active ?? true,
        })
        .returning();
      await events.emit({
        tenantId: ctx.tenantId,
        eventType: "pipeline_triggers.created",
        recordType: "pipeline_triggers",
        recordId: id,
        agentId: ctx.agentId,
        userId: ctx.userId,
        changes: {},
      });
      return record;
    },

    async update(ctx: CrmContext, id: string, input: UpdateTriggerInput) {
      const parsed = updateTriggerSchema.parse(input);
      const existing = await this.getById(ctx, id);
      if (!existing) throw new Error(`PipelineTrigger ${id} not found`);
      const [record] = await db
        .update(pipelineTriggers)
        .set({ ...parsed, updatedAt: new Date() })
        .where(
          and(
            eq(pipelineTriggers.id, id),
            eq(pipelineTriggers.tenantId, ctx.tenantId)
          )
        )
        .returning();
      return record;
    },

    async delete(ctx: CrmContext, id: string) {
      const existing = await this.getById(ctx, id);
      if (!existing) throw new Error(`PipelineTrigger ${id} not found`);
      const [record] = await db
        .delete(pipelineTriggers)
        .where(
          and(
            eq(pipelineTriggers.id, id),
            eq(pipelineTriggers.tenantId, ctx.tenantId)
          )
        )
        .returning();
      return record;
    },

    /**
     * Fire a trigger event for a specific deal.
     * Looks up active triggers for the deal's pipeline + event type,
     * then advances the deal stage if the fromStage matches (or is null).
     * Returns the updated deal, or null if no trigger matched.
     */
    async fireForDeal(
      ctx: CrmContext,
      dealId: string,
      triggerEvent: string
    ): Promise<{ dealId: string; fromStage: string; toStage: string } | null> {
      // Load the deal
      const [deal] = await db
        .select()
        .from(deals)
        .where(and(eq(deals.id, dealId), eq(deals.tenantId, ctx.tenantId)));
      if (!deal) return null;

      // Load the pipeline to validate stages
      const [pipeline] = await db
        .select()
        .from(pipelines)
        .where(
          and(
            eq(pipelines.id, deal.pipelineId),
            eq(pipelines.tenantId, ctx.tenantId)
          )
        );
      if (!pipeline) return null;

      const stageNames = (pipeline.stages as Array<{ name: string; order: number }>)
        .sort((a, b) => a.order - b.order)
        .map((s) => s.name);

      // Find matching active triggers
      const matchingTriggers = await db
        .select()
        .from(pipelineTriggers)
        .where(
          and(
            eq(pipelineTriggers.tenantId, ctx.tenantId),
            eq(pipelineTriggers.pipelineId, deal.pipelineId),
            eq(pipelineTriggers.triggerEvent, triggerEvent),
            eq(pipelineTriggers.active, true)
          )
        );

      // Pick the first trigger where fromStage matches or is null
      const trigger = matchingTriggers.find(
        (t: { fromStage: string | null; toStage: string }) =>
          (t.fromStage === null || t.fromStage === deal.stage) &&
          stageNames.includes(t.toStage)
      );

      if (!trigger) return null;

      // Don't go backwards
      const currentIdx = stageNames.indexOf(deal.stage);
      const targetIdx = stageNames.indexOf(trigger.toStage);
      if (targetIdx <= currentIdx) return null;

      // Advance the deal
      const fromStage = deal.stage;
      await db
        .update(deals)
        .set({ stage: trigger.toStage, updatedAt: new Date() })
        .where(and(eq(deals.id, dealId), eq(deals.tenantId, ctx.tenantId)));

      await events.emit({
        tenantId: ctx.tenantId,
        eventType: "deals.stage_changed",
        recordType: "deals",
        recordId: dealId,
        agentId: ctx.agentId,
        userId: ctx.userId,
        changes: {
          stage: { before: fromStage, after: trigger.toStage },
        },
        metadata: { trigger: triggerEvent, triggerId: trigger.id, auto: true },
      });

      return { dealId, fromStage, toStage: trigger.toStage };
    },

    /**
     * Handle an email engagement event (from Resend webhook or inbound email log).
     * Finds all activities with this resendId and fires triggers for their associated deals.
     */
    async handleEmailEvent(
      ctx: CrmContext,
      triggerEvent: string,
      resendId: string
    ): Promise<Array<{ dealId: string; fromStage: string; toStage: string }>> {
      // Find activities referencing this resendId
      const allActivities = await db
        .select()
        .from(activities)
        .where(eq(activities.tenantId, ctx.tenantId));

      const matched = allActivities.filter(
        (a: { metadata: unknown; dealId: string | null }) =>
          a.dealId &&
          a.metadata &&
          typeof a.metadata === "object" &&
          (a.metadata as Record<string, unknown>).resendId === resendId
      );

      const results: Array<{ dealId: string; fromStage: string; toStage: string }> = [];
      for (const activity of matched) {
        if (!activity.dealId) continue;
        const result = await this.fireForDeal(ctx, activity.dealId, triggerEvent);
        if (result) results.push(result);
      }
      return results;
    },
  };
}
