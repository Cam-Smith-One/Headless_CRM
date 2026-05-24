import { eq, and } from "drizzle-orm";
import { savedSearches } from "@headless-crm/db";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { CrmContext, EventEmitter } from "../types";

export const createSavedSearchSchema = z.object({
  name: z.string().min(1).max(200),
  collection: z.enum(["contacts", "companies", "deals", "cases", "activities"]),
  filters: z.record(z.string(), z.unknown()).default({}),
}).strict();

export const updateSavedSearchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
}).strict();

export type CreateSavedSearchInput = z.infer<typeof createSavedSearchSchema>;
export type UpdateSavedSearchInput = z.infer<typeof updateSavedSearchSchema>;

export function createSavedSearchesService(db: any, _events: EventEmitter) {
  return {
    async list(ctx: CrmContext, collection?: string) {
      const conditions = [eq(savedSearches.tenantId, ctx.tenantId)];
      if (collection) conditions.push(eq(savedSearches.collection, collection));
      return db.select().from(savedSearches).where(and(...conditions));
    },

    async getById(ctx: CrmContext, id: string) {
      const [record] = await db
        .select()
        .from(savedSearches)
        .where(and(eq(savedSearches.id, id), eq(savedSearches.tenantId, ctx.tenantId)));
      return record ?? null;
    },

    async create(ctx: CrmContext, input: CreateSavedSearchInput) {
      const parsed = createSavedSearchSchema.parse(input);
      const id = `ss_${nanoid(10)}`;
      const [record] = await db
        .insert(savedSearches)
        .values({
          id,
          tenantId: ctx.tenantId,
          ...parsed,
          createdByAgentId: ctx.agentId,
        })
        .returning();
      return record;
    },

    async update(ctx: CrmContext, id: string, input: UpdateSavedSearchInput) {
      const parsed = updateSavedSearchSchema.parse(input);
      const existing = await this.getById(ctx, id);
      if (!existing) throw new Error(`SavedSearch ${id} not found`);
      const [record] = await db
        .update(savedSearches)
        .set({ ...parsed, updatedAt: new Date() })
        .where(and(eq(savedSearches.id, id), eq(savedSearches.tenantId, ctx.tenantId)))
        .returning();
      return record;
    },

    async delete(ctx: CrmContext, id: string) {
      const existing = await this.getById(ctx, id);
      if (!existing) throw new Error(`SavedSearch ${id} not found`);
      await db
        .delete(savedSearches)
        .where(and(eq(savedSearches.id, id), eq(savedSearches.tenantId, ctx.tenantId)));
      return { deleted: true };
    },
  };
}

export type SavedSearchesService = ReturnType<typeof createSavedSearchesService>;
