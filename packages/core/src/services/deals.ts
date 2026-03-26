import { eq, and, sql } from "drizzle-orm";
import { deals, dealContacts } from "@headless-crm/db";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { CrmContext, EventEmitter, PaginatedResult } from "../types";

export const createDealSchema = z.object({
  name: z.string().min(1),
  value: z.string().optional(),
  currency: z.string().default("USD"),
  stage: z.string().min(1),
  pipelineId: z.string().optional(),
  companyId: z.string().optional(),
  closeDate: z.string().datetime().optional(),
  ownerAgentId: z.string().optional(),
  statusCode: z.string().optional(),
  customFields: z.record(z.unknown()).optional(),
});

export const updateDealSchema = createDealSchema.partial();

export type CreateDealInput = z.infer<typeof createDealSchema>;
export type UpdateDealInput = z.infer<typeof updateDealSchema>;

export function createDealsService(
  db: any,
  events: EventEmitter,
  customFieldValidator?: (ctx: CrmContext, collection: string, customFields: Record<string, unknown> | undefined) => Promise<{ valid: boolean; errors: string[] }>
) {
  return {
    async create(ctx: CrmContext, input: CreateDealInput) {
      const parsed = createDealSchema.parse(input);
      if (customFieldValidator) {
        const { valid, errors } = await customFieldValidator(ctx, "deals", parsed.customFields);
        if (!valid) throw new Error(`Custom field validation failed: ${errors.join("; ")}`);
      }
      const id = nanoid();

      const [record] = await db
        .insert(deals)
        .values({
          id,
          tenantId: ctx.tenantId,
          ...parsed,
          closeDate: parsed.closeDate ? new Date(parsed.closeDate) : undefined,
          createdByAgentId: ctx.agentId,
          updatedByAgentId: ctx.agentId,
        })
        .returning();

      await events.emit({
        tenantId: ctx.tenantId,
        eventType: "deals.created",
        recordType: "deals",
        recordId: id,
        agentId: ctx.agentId,
        userId: ctx.userId,
        changes: {},
      });

      return record;
    },

    async getById(ctx: CrmContext, id: string) {
      const [record] = await db
        .select()
        .from(deals)
        .where(and(eq(deals.id, id), eq(deals.tenantId, ctx.tenantId)));
      return record ?? null;
    },

    async update(ctx: CrmContext, id: string, input: UpdateDealInput) {
      const parsed = updateDealSchema.parse(input);
      if (customFieldValidator) {
        const { valid, errors } = await customFieldValidator(ctx, "deals", parsed.customFields);
        if (!valid) throw new Error(`Custom field validation failed: ${errors.join("; ")}`);
      }
      const existing = await this.getById(ctx, id);
      if (!existing) throw new Error(`Deal ${id} not found`);

      const changes: Record<string, { before: unknown; after: unknown }> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (value !== undefined && (existing as any)[key] !== value) {
          changes[key] = { before: (existing as any)[key], after: value };
        }
      }

      // Special event for stage changes
      const eventType =
        parsed.stage && parsed.stage !== existing.stage
          ? "deals.stage_changed"
          : "deals.updated";

      const [record] = await db
        .update(deals)
        .set({
          ...parsed,
          closeDate: parsed.closeDate ? new Date(parsed.closeDate) : undefined,
          updatedByAgentId: ctx.agentId,
          updatedAt: new Date(),
        })
        .where(and(eq(deals.id, id), eq(deals.tenantId, ctx.tenantId)))
        .returning();

      if (Object.keys(changes).length > 0) {
        await events.emit({
          tenantId: ctx.tenantId,
          eventType,
          recordType: "deals",
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
      if (!existing) throw new Error(`Deal ${id} not found`);

      const [record] = await db
        .update(deals)
        .set({ stateCode: "archived", updatedAt: new Date() })
        .where(and(eq(deals.id, id), eq(deals.tenantId, ctx.tenantId)))
        .returning();

      await events.emit({
        tenantId: ctx.tenantId,
        eventType: "deals.deleted",
        recordType: "deals",
        recordId: id,
        agentId: ctx.agentId,
        userId: ctx.userId,
        changes: { stateCode: { before: existing.stateCode, after: "archived" } },
      });

      return record;
    },

    async query(
      ctx: CrmContext,
      options: { limit?: number; offset?: number; stage?: string; pipelineId?: string; companyId?: string }
    ): Promise<PaginatedResult<typeof deals.$inferSelect>> {
      const limit = options.limit ?? 50;
      const offset = options.offset ?? 0;

      const whereCondition = and(
        eq(deals.tenantId, ctx.tenantId),
        eq(deals.stateCode, "active"),
        options.stage ? eq(deals.stage, options.stage) : undefined,
        options.pipelineId ? eq(deals.pipelineId, options.pipelineId) : undefined,
        options.companyId ? eq(deals.companyId, options.companyId) : undefined
      );

      const data = await db
        .select()
        .from(deals)
        .where(whereCondition)
        .limit(limit)
        .offset(offset);

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(deals)
        .where(whereCondition);

      return { data, total: Number(count), limit, offset, hasMore: offset + data.length < Number(count) };
    },

    async addContact(ctx: CrmContext, dealId: string, contactId: string) {
      const deal = await this.getById(ctx, dealId);
      if (!deal) throw new Error(`Deal ${dealId} not found`);

      await db.insert(dealContacts).values({ dealId, contactId }).onConflictDoNothing();

      await events.emit({
        tenantId: ctx.tenantId,
        eventType: "deals.contact_added",
        recordType: "deals",
        recordId: dealId,
        agentId: ctx.agentId,
        userId: ctx.userId,
        changes: { contactId: { before: null, after: contactId } },
      });

      return { dealId, contactId };
    },

    async removeContact(ctx: CrmContext, dealId: string, contactId: string) {
      const deal = await this.getById(ctx, dealId);
      if (!deal) throw new Error(`Deal ${dealId} not found`);

      await db.delete(dealContacts)
        .where(and(eq(dealContacts.dealId, dealId), eq(dealContacts.contactId, contactId)));

      await events.emit({
        tenantId: ctx.tenantId,
        eventType: "deals.contact_removed",
        recordType: "deals",
        recordId: dealId,
        agentId: ctx.agentId,
        userId: ctx.userId,
        changes: { contactId: { before: contactId, after: null } },
      });

      return { dealId, contactId };
    },

    async getContacts(ctx: CrmContext, dealId: string) {
      const rows = await db.select().from(dealContacts).where(eq(dealContacts.dealId, dealId));
      return rows.map((r: any) => r.contactId);
    },
  };
}
