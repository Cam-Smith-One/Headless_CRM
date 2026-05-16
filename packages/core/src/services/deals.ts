import { eq, and, sql } from "drizzle-orm";
import { deals, dealContacts, contacts, pipelines } from "@headless-crm/db";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { CrmContext, EventEmitter, PaginatedResult } from "../types";

export const createDealSchema = z.object({
  name: z.string().min(1),
  value: z.number().nonnegative().optional(),
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

// Drizzle returns numeric columns as strings from postgres-js. Coerce here so
// callers always receive a JS number (or null), never a string.
function normalizeDeal(deal: any) {
  return { ...deal, value: deal.value != null ? Number(deal.value) : null };
}

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

      // pipeline_id is NOT NULL in the DB; auto-resolve the tenant's default when omitted.
      let pipelineId = parsed.pipelineId;
      if (!pipelineId) {
        const [defaultPipeline] = await db
          .select({ id: pipelines.id })
          .from(pipelines)
          .where(eq(pipelines.tenantId, ctx.tenantId))
          .limit(1);
        if (!defaultPipeline) throw new Error("No pipeline found for tenant. Create a pipeline first.");
        pipelineId = defaultPipeline.id;
      }

      const id = nanoid();

      const [record] = await db
        .insert(deals)
        .values({
          id,
          tenantId: ctx.tenantId,
          ...parsed,
          pipelineId,
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

      return normalizeDeal(record);
    },

    async getById(ctx: CrmContext, id: string) {
      const [record] = await db
        .select()
        .from(deals)
        .where(and(eq(deals.id, id), eq(deals.tenantId, ctx.tenantId)));
      return record ? normalizeDeal(record) : null;
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

      return normalizeDeal(record);
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

      return normalizeDeal(record);
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

      return { data: data.map(normalizeDeal), total: Number(count), limit, offset, hasMore: offset + data.length < Number(count) };
    },

    async addContact(ctx: CrmContext, dealId: string, contactId: string) {
      // Validate deal belongs to caller's tenant
      const deal = await this.getById(ctx, dealId);
      if (!deal) throw new Error(`Deal ${dealId} not found`);

      // Validate contact belongs to caller's tenant — prevents cross-tenant FK injection
      const [contact] = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, ctx.tenantId)))
        .limit(1);
      if (!contact) throw new Error(`Contact ${contactId} not found`);

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
      // Validate deal belongs to caller's tenant
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
      // Validate the deal belongs to the caller's tenant before listing its contacts.
      // Without this, anyone with a guessed dealId could read another tenant's contact list.
      const deal = await this.getById(ctx, dealId);
      if (!deal) throw new Error(`Deal ${dealId} not found`);

      const rows = await db.select().from(dealContacts).where(eq(dealContacts.dealId, dealId));
      return rows.map((r: any) => r.contactId);
    },
  };
}
