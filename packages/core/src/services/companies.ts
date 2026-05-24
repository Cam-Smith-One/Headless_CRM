import { eq, and, sql } from "drizzle-orm";
import { ilikeCompat } from "@headless-crm/db";
import { companies, crmEvents } from "@headless-crm/db";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { CrmContext, EventEmitter, PaginatedResult } from "../types";
import type { EmbeddingsService } from "./embeddings";

export const createCompanySchema = z.object({
  name: z.string().min(1),
  domain: z.string().optional(),
  industry: z.string().optional(),
  size: z.string().optional(),
  parentCompanyId: z.string().optional(),
  statusCode: z.string().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export const updateCompanySchema = createCompanySchema.partial();

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

export function createCompaniesService(
  db: any,
  events: EventEmitter,
  customFieldValidator?: (ctx: CrmContext, collection: string, customFields: Record<string, unknown> | undefined) => Promise<{ valid: boolean; errors: string[] }>,
  embeddingsService?: EmbeddingsService
) {
  return {
    async create(ctx: CrmContext, input: CreateCompanyInput) {
      const parsed = createCompanySchema.parse(input);
      if (customFieldValidator) {
        const { valid, errors } = await customFieldValidator(ctx, "companies", parsed.customFields);
        if (!valid) throw new Error(`Custom field validation failed: ${errors.join("; ")}`);
      }
      const id = nanoid();

      const [record] = await db
        .insert(companies)
        .values({
          id,
          tenantId: ctx.tenantId,
          ...parsed,
          createdByAgentId: ctx.agentId,
          updatedByAgentId: ctx.agentId,
        })
        .returning();

      await events.emit({
        tenantId: ctx.tenantId,
        eventType: "companies.created",
        recordType: "companies",
        recordId: id,
        agentId: ctx.agentId,
        userId: ctx.userId,
        changes: {},
      });

      // Generate embedding asynchronously
      if (embeddingsService) {
        embeddingsService.embedCompany(ctx, id).catch(() => {});
      }

      return record;
    },

    async getById(ctx: CrmContext, id: string) {
      const [record] = await db
        .select()
        .from(companies)
        .where(and(eq(companies.id, id), eq(companies.tenantId, ctx.tenantId)));
      return record ?? null;
    },

    async update(ctx: CrmContext, id: string, input: UpdateCompanyInput) {
      const parsed = updateCompanySchema.parse(input);
      if (customFieldValidator) {
        const { valid, errors } = await customFieldValidator(ctx, "companies", parsed.customFields);
        if (!valid) throw new Error(`Custom field validation failed: ${errors.join("; ")}`);
      }
      const existing = await this.getById(ctx, id);
      if (!existing) throw new Error(`Company ${id} not found`);

      const changes: Record<string, { before: unknown; after: unknown }> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (value !== undefined && (existing as any)[key] !== value) {
          changes[key] = { before: (existing as any)[key], after: value };
        }
      }

      const [record] = await db
        .update(companies)
        .set({ ...parsed, updatedByAgentId: ctx.agentId, updatedAt: new Date() })
        .where(and(eq(companies.id, id), eq(companies.tenantId, ctx.tenantId)))
        .returning();

      if (Object.keys(changes).length > 0) {
        await events.emit({
          tenantId: ctx.tenantId,
          eventType: "companies.updated",
          recordType: "companies",
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
      if (!existing) throw new Error(`Company ${id} not found`);

      const [record] = await db
        .update(companies)
        .set({ stateCode: "archived", updatedAt: new Date() })
        .where(and(eq(companies.id, id), eq(companies.tenantId, ctx.tenantId)))
        .returning();

      await events.emit({
        tenantId: ctx.tenantId,
        eventType: "companies.deleted",
        recordType: "companies",
        recordId: id,
        agentId: ctx.agentId,
        userId: ctx.userId,
        changes: { stateCode: { before: existing.stateCode, after: "archived" } },
      });

      return record;
    },

    async query(
      ctx: CrmContext,
      options: { limit?: number; offset?: number; search?: string }
    ): Promise<PaginatedResult<typeof companies.$inferSelect>> {
      const limit = options.limit ?? 50;
      const offset = options.offset ?? 0;

      const escapedSearch = options.search
        ? options.search.replace(/%/g, '\\%').replace(/_/g, '\\_')
        : undefined;

      const whereCondition = and(
        eq(companies.tenantId, ctx.tenantId),
        eq(companies.stateCode, "active"),
        escapedSearch
          ? ilikeCompat(
              sql`COALESCE(${companies.name}, '') || ' ' || COALESCE(${companies.domain}, '')`,
              `%${escapedSearch}%`
            )
          : undefined
      );

      const data = await db
        .select()
        .from(companies)
        .where(whereCondition)
        .limit(limit)
        .offset(offset);

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(companies)
        .where(whereCondition);

      return { data, total: Number(count), limit, offset, hasMore: offset + data.length < Number(count) };
    },

    /**
     * Apply enrichment data to a company. Standard fields fill in missing
     * values; everything else is merged into customFields.
     */
    async enrich(ctx: CrmContext, id: string, data: Record<string, unknown>) {
      const existing = await this.getById(ctx, id);
      if (!existing) throw new Error(`Company ${id} not found`);

      const standardFields = ["name", "domain", "industry", "size", "website", "phone", "description"] as const;
      const updates: Record<string, unknown> = {};

      for (const field of standardFields) {
        if (data[field] !== undefined && !(existing as any)[field]) {
          updates[field] = data[field];
        }
        delete data[field];
      }

      if (Object.keys(data).length > 0) {
        const existingCF = ((existing as any).customFields as Record<string, unknown>) ?? {};
        updates.customFields = { ...data, ...existingCF };
      }

      if (Object.keys(updates).length === 0) return existing;

      const [record] = await db
        .update(companies)
        .set({ ...updates, updatedByAgentId: ctx.agentId, updatedAt: new Date() })
        .where(and(eq(companies.id, id), eq(companies.tenantId, ctx.tenantId)))
        .returning();

      await events.emit({
        tenantId: ctx.tenantId,
        eventType: "companies.enriched",
        recordType: "companies",
        recordId: id,
        agentId: ctx.agentId,
        userId: ctx.userId,
        changes: Object.fromEntries(
          Object.entries(updates).map(([k, v]) => [k, { before: (existing as any)[k], after: v }])
        ),
      });

      return record;
    },
  };
}
