import { eq, and } from "drizzle-orm";
import { pipelines, deals, pipelineTriggers, dealContacts } from "@headless-crm/db";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { CrmContext, EventEmitter } from "../types";

const stageSchema = z.object({
  name: z.string().min(1),
  order: z.number().int().min(0),
  probability: z.number().min(0).max(100),
});

export const createPipelineSchema = z.object({
  name: z.string().min(1),
  stages: z.array(stageSchema).min(1),
});

export const updatePipelineSchema = createPipelineSchema.partial();

export type CreatePipelineInput = z.infer<typeof createPipelineSchema>;
export type UpdatePipelineInput = z.infer<typeof updatePipelineSchema>;

export function createPipelinesService(db: any, events: EventEmitter) {
  return {
    async list(ctx: CrmContext) {
      return db
        .select()
        .from(pipelines)
        .where(eq(pipelines.tenantId, ctx.tenantId));
    },

    async getById(ctx: CrmContext, id: string) {
      const [record] = await db
        .select()
        .from(pipelines)
        .where(and(eq(pipelines.id, id), eq(pipelines.tenantId, ctx.tenantId)));
      return record ?? null;
    },

    async create(ctx: CrmContext, input: CreatePipelineInput) {
      const parsed = createPipelineSchema.parse(input);
      const id = nanoid();

      const [record] = await db
        .insert(pipelines)
        .values({
          id,
          tenantId: ctx.tenantId,
          name: parsed.name,
          stages: parsed.stages,
        })
        .returning();

      await events.emit({
        tenantId: ctx.tenantId,
        eventType: "pipelines.created",
        recordType: "pipelines",
        recordId: id,
        agentId: ctx.agentId,
        userId: ctx.userId,
        changes: {},
      });

      return record;
    },

    async update(ctx: CrmContext, id: string, input: UpdatePipelineInput) {
      const parsed = updatePipelineSchema.parse(input);
      const existing = await this.getById(ctx, id);
      if (!existing) throw new Error(`Pipeline ${id} not found`);

      const changes: Record<string, { before: unknown; after: unknown }> = {};
      if (parsed.name !== undefined && parsed.name !== existing.name) {
        changes.name = { before: existing.name, after: parsed.name };
      }
      if (parsed.stages !== undefined) {
        changes.stages = { before: existing.stages, after: parsed.stages };
      }

      const [record] = await db
        .update(pipelines)
        .set({
          ...parsed,
          updatedAt: new Date(),
        })
        .where(and(eq(pipelines.id, id), eq(pipelines.tenantId, ctx.tenantId)))
        .returning();

      if (Object.keys(changes).length > 0) {
        await events.emit({
          tenantId: ctx.tenantId,
          eventType: "pipelines.updated",
          recordType: "pipelines",
          recordId: id,
          agentId: ctx.agentId,
          userId: ctx.userId,
          changes,
        });
      }

      return record;
    },

    async delete(ctx: CrmContext, id: string) {
      const existing = await this.getById(ctx, id);
      if (!existing) throw new Error(`Pipeline ${id} not found`);

      // Hard-delete archived (soft-deleted) deals that still reference this
      // pipeline — pipelineId is NOT NULL so we can't null it out. Archived
      // deals are already invisible to users; removing their rows is safe.
      const archivedDeals = await db
        .select({ id: deals.id })
        .from(deals)
        .where(and(eq(deals.pipelineId, id), eq(deals.tenantId, ctx.tenantId)));

      for (const d of archivedDeals) {
        // Remove join rows first to satisfy deal_contacts FK.
        await db.delete(dealContacts).where(eq(dealContacts.dealId, d.id));
        await db.delete(deals).where(eq(deals.id, d.id));
      }

      // Delete any pipeline triggers attached to this pipeline.
      await db
        .delete(pipelineTriggers)
        .where(and(eq(pipelineTriggers.pipelineId, id), eq(pipelineTriggers.tenantId, ctx.tenantId)));

      const [record] = await db
        .delete(pipelines)
        .where(and(eq(pipelines.id, id), eq(pipelines.tenantId, ctx.tenantId)))
        .returning();

      await events.emit({
        tenantId: ctx.tenantId,
        eventType: "pipelines.deleted",
        recordType: "pipelines",
        recordId: id,
        agentId: ctx.agentId,
        userId: ctx.userId,
        changes: {},
      });

      return record;
    },
  };
}
